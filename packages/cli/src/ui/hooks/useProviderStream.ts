/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useInput } from 'ink';
import {
  Config,
  getErrorMessage,
  isNodeError,
  MessageSenderType,
  ToolCallRequestInfo,
  GitService,
  EditorType,
  ThoughtSummary,
  UnauthorizedError,
} from '../../core/index.js';
import { getProvider } from '../../core/providers/registry.js';
import { ToolCallResponse } from '../../core/providers/index.js';
// Generic types for provider responses
type Part = any;
type PartListUnion = any;
import {
  StreamingState,
  HistoryItem,
  HistoryItemWithoutId,
  HistoryItemToolGroup,
  MessageType,
  ToolCallStatus,
} from '../types.js';
import { isAtCommand } from '../utils/commandUtils.js';
import { parseAndFormatApiError } from '../utils/errorParsing.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findLastSafeSplitPoint } from '../utils/markdownUtilities.js';
import { useStateAndRef } from './useStateAndRef.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';
import { useLogger } from './useLogger.js';
import { promises as fs } from 'fs';
import path from 'path';
import {
  useReactToolScheduler,
  mapToDisplay as mapTrackedToolCallsToDisplay,
  TrackedToolCall,
  TrackedCompletedToolCall,
  TrackedCancelledToolCall,
} from './useReactToolScheduler.js';
import { useSessionStats } from '../contexts/SessionContext.js';

export function mergePartListUnions(list: PartListUnion[]): PartListUnion {
  const resultParts: PartListUnion = [];
  for (const item of list) {
    if (Array.isArray(item)) {
      resultParts.push(...item);
    } else {
      resultParts.push(item);
    }
  }
  return resultParts;
}

enum StreamProcessingStatus {
  Completed,
  UserCancelled,
  Error,
}

/**
 * Manages the Gemini stream, including user input, command processing,
 * API interaction, and tool call lifecycle.
 */
export const useProviderStream = (
  config: Config,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  onDebugMessage: (message: string) => void,
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<
    import('./slashCommandProcessor.js').SlashCommandActionReturn | boolean
  >,
  shellModeActive: boolean,
  getPreferredEditor: () => EditorType | undefined,
  onAuthError: () => void,
  performMemoryRefresh: () => Promise<void>,
) => {
  const [initError, setInitError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnCancelledRef = useRef(false);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [thought, setThought] = useState<ThoughtSummary | null>(null);
  const [pendingHistoryItemRef, setPendingHistoryItem] =
    useStateAndRef<HistoryItemWithoutId | null>(null);
  const processedMemoryToolsRef = useRef<Set<string>>(new Set());
  const logger = useLogger();
  const { startNewTurn, addUsage } = useSessionStats();
  const lastAssistantResponseRef = useRef<ToolCallResponse | null>(null);
  const gitService = useMemo(() => {
    if (!config.getProjectRoot()) {
      return;
    }
    return new GitService(config.getProjectRoot());
  }, [config]);

  const [toolCalls, scheduleToolCalls, markToolsAsSubmitted] =
    useReactToolScheduler(
      (completedToolCallsFromScheduler) => {
        // This onComplete is called when ALL scheduled tools for a given batch are done.
        if (completedToolCallsFromScheduler.length > 0) {
          // Add the final state of these tools to the history for display.
          // The new useEffect will handle submitting their responses.
          addItem(
            mapTrackedToolCallsToDisplay(
              completedToolCallsFromScheduler as TrackedToolCall[],
            ),
            Date.now(),
          );
        }
      },
      config,
      setPendingHistoryItem,
      getPreferredEditor,
    );

  const pendingToolCallGroupDisplay = useMemo(
    () =>
      toolCalls.length ? mapTrackedToolCallsToDisplay(toolCalls) : undefined,
    [toolCalls],
  );

  const onExec = useCallback(async (done: Promise<void>) => {
    setIsResponding(true);
    await done;
    setIsResponding(false);
  }, []);
  const { handleShellCommand } = useShellCommandProcessor(
    addItem,
    setPendingHistoryItem,
    onExec,
    onDebugMessage,
    config,
  );

  const streamingState = useMemo(() => {
    if (toolCalls.some((tc) => tc.status === 'awaiting_approval')) {
      return StreamingState.WaitingForConfirmation;
    }
    if (
      isResponding ||
      toolCalls.some(
        (tc) =>
          tc.status === 'executing' ||
          tc.status === 'scheduled' ||
          tc.status === 'validating' ||
          ((tc.status === 'success' ||
            tc.status === 'error' ||
            tc.status === 'cancelled') &&
            !(tc as TrackedCompletedToolCall | TrackedCancelledToolCall)
              .responseSubmittedToGemini),
      )
    ) {
      return StreamingState.Responding;
    }
    return StreamingState.Idle;
  }, [isResponding, toolCalls]);

  useInput((_input, key) => {
    if (streamingState === StreamingState.Responding && key.escape) {
      if (turnCancelledRef.current) {
        return;
      }
      turnCancelledRef.current = true;
      abortControllerRef.current?.abort();
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, Date.now());
      }
      addItem(
        {
          type: MessageType.INFO,
          text: 'Request cancelled.',
        },
        Date.now(),
      );
      setPendingHistoryItem(null);
      setIsResponding(false);
    }
  });

  const prepareQueryForGemini = useCallback(
    async (
      query: PartListUnion,
      userMessageTimestamp: number,
      abortSignal: AbortSignal,
    ): Promise<{
      queryToSend: PartListUnion | null;
      shouldProceed: boolean;
    }> => {
      if (turnCancelledRef.current) {
        return { queryToSend: null, shouldProceed: false };
      }
      if (typeof query === 'string' && query.trim().length === 0) {
        return { queryToSend: null, shouldProceed: false };
      }

      let localQueryToSendToGemini: PartListUnion | null = null;

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        onDebugMessage(`User query: '${trimmedQuery}'`);
        await logger?.logMessage(MessageSenderType.USER, trimmedQuery);

        // Handle UI-only commands first
        const slashCommandResult = await handleSlashCommand(trimmedQuery);
        if (typeof slashCommandResult === 'boolean' && slashCommandResult) {
          // Command was handled, and it doesn't require a tool call from here
          return { queryToSend: null, shouldProceed: false };
        } else if (
          typeof slashCommandResult === 'object' &&
          slashCommandResult.shouldScheduleTool
        ) {
          // Slash command wants to schedule a tool call (e.g., /memory add)
          const { toolName, toolArgs } = slashCommandResult;
          if (toolName && toolArgs) {
            const toolCallRequest: ToolCallRequestInfo = {
              callId: `${toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              toolName: toolName,
              parameters: toolArgs,
              name: toolName, // Backward compatibility alias
              args: toolArgs, // Backward compatibility alias
              isClientInitiated: true,
            };
            scheduleToolCalls([toolCallRequest], abortSignal);
          }
          return { queryToSend: null, shouldProceed: false }; // Handled by scheduling the tool
        }

        if (shellModeActive && handleShellCommand(trimmedQuery, abortSignal)) {
          return { queryToSend: null, shouldProceed: false };
        }

        // Handle @-commands (which might involve tool calls)
        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            addItem,
            onDebugMessage,
            messageId: userMessageTimestamp,
            signal: abortSignal,
          });
          if (!atCommandResult.shouldProceed) {
            return { queryToSend: null, shouldProceed: false };
          }
          localQueryToSendToGemini = atCommandResult.processedQuery;
        } else {
          // Normal query for Gemini
          addItem(
            { type: MessageType.USER, text: trimmedQuery },
            userMessageTimestamp,
          );
          localQueryToSendToGemini = trimmedQuery;
        }
      } else {
        // It's a function response (PartListUnion that isn't a string)
        localQueryToSendToGemini = query;
      }

      if (localQueryToSendToGemini === null) {
        onDebugMessage(
          'Query processing resulted in null, not sending to Gemini.',
        );
        return { queryToSend: null, shouldProceed: false };
      }
      return { queryToSend: localQueryToSendToGemini, shouldProceed: true };
    },
    [
      config,
      addItem,
      onDebugMessage,
      handleShellCommand,
      handleSlashCommand,
      logger,
      shellModeActive,
      scheduleToolCalls,
    ],
  );

  // Simplified for provider system - no complex streaming events needed

  const submitQuery = useCallback(
    async (query: PartListUnion, options?: { isContinuation: boolean }) => {
      if (config.getDebugMode()) {
        console.debug(`[DEBUG] submitQuery - Called with query:`, query, 'options:', options);
        console.debug(`[DEBUG] submitQuery - streamingState:`, streamingState);
      }
      
      if (
        (streamingState === StreamingState.Responding ||
          streamingState === StreamingState.WaitingForConfirmation) &&
        !options?.isContinuation
      ) {
        if (config.getDebugMode()) {
          console.debug(`[DEBUG] submitQuery - Returning early due to streaming state`);
        }
        return;
      }

      const userMessageTimestamp = Date.now();
      setShowHelp(false);

      // Convert PartListUnion to string prompt and extract tool results
      let promptText: string;
      let toolResults: Array<{ content: string; tool_call_id: string }> | undefined;
      
      if (typeof query === 'string') {
        promptText = query;
      } else if (Array.isArray(query)) {
        // Check if this is a tool response continuation
        if (options?.isContinuation) {
          toolResults = [];
          const textParts: string[] = [];
          
          for (const part of query) {
            if (typeof part === 'object' && 'functionResponse' in part) {
              // Extract tool result
              const functionResponse = part.functionResponse;
              toolResults.push({
                content: JSON.stringify(functionResponse.response),
                tool_call_id: functionResponse.id
              });
            } else if (typeof part === 'string') {
              textParts.push(part);
            } else if ('text' in part) {
              textParts.push(part.text || '');
            }
          }
          
          promptText = textParts.join(' ');
        } else {
          // Normal text query
          promptText = query.map(part => 
            typeof part === 'string' ? part : 
            'text' in part ? part.text : 
            JSON.stringify(part)
          ).join(' ');
        }
      } else {
        promptText = 'text' in query ? query.text || '' : JSON.stringify(query);
      }

      // Skip empty prompt check for continuations with tool results
      if (!options?.isContinuation && !promptText.trim()) {
        if (config.getDebugMode()) {
          console.debug(`[DEBUG] Interactive UI - Skipping empty prompt (not a continuation)`);
        }
        return;
      }
      
      if (options?.isContinuation && config.getDebugMode()) {
        console.debug(`[DEBUG] Interactive UI - Processing continuation with prompt: "${promptText}" and ${toolResults?.length || 0} tool results`);
      }

      // Handle slash commands first (only for non-continuations)
      if (!options?.isContinuation && promptText.startsWith('/')) {
        console.debug(`[DEBUG] Interactive UI - Processing slash command: ${promptText}`);
        const slashCommandResult = await handleSlashCommand(promptText);
        if (typeof slashCommandResult === 'boolean' && slashCommandResult) {
          // Command was handled, don't send to provider
          console.debug(`[DEBUG] Interactive UI - Slash command handled, not sending to provider`);
          return;
        }
        console.debug(`[DEBUG] Interactive UI - Slash command not handled, continuing to provider`);
      }

      // Add user message to history (only for non-continuations)
      if (!options?.isContinuation) {
        addItem(
          {
            type: MessageType.USER,
            text: promptText,
          },
          userMessageTimestamp,
        );
      }

      if (!options?.isContinuation) {
        startNewTurn();
      }

      setIsResponding(true);
      setInitError(null);
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      turnCancelledRef.current = false;

      try {
        // Get provider configuration
        const providerName = config.getProvider() || 
          process.env.GROKCLI_PROVIDER || 
          (process.env.XAI_API_KEY ? 'grok' : 'ollama');
        const model = config.getModel();

        console.debug(`[DEBUG] Interactive UI - Provider: ${providerName}, Model: ${model}`);

        const providerConfig: any = {};
        if (providerName === 'xai') {
          providerConfig.apiKey = process.env.XAI_API_KEY || '';
          providerConfig.contextSize = parseInt(process.env.GROKCLI_CONTEXT_SIZE || '128000', 10);
        } else if (providerName === 'ollama') {
          providerConfig.endpoint = process.env.OLLAMA_HOST || 'http://localhost:11434';
          providerConfig.model = process.env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
        }

        const queryOptions: any = {};
        if (model) {
          queryOptions.model = model;
        }
        
        // Add tool results if this is a continuation with tool responses
        if (toolResults && toolResults.length > 0) {
          queryOptions.tool_results = toolResults;
          // Include the previous assistant response for proper conversation context
          if (lastAssistantResponseRef.current) {
            queryOptions.previous_assistant_response = lastAssistantResponseRef.current;
          }
          console.debug(`[DEBUG] Interactive UI - Including ${toolResults.length} tool results in query`);
        }

        console.debug(`[DEBUG] Interactive UI - ProviderConfig:`, providerConfig);
        console.debug(`[DEBUG] Interactive UI - QueryOptions:`, queryOptions);
        console.debug(`[DEBUG] Interactive UI - Prompt:`, promptText);

        // Get the tool registry and provider
        console.debug(`[DEBUG] Interactive UI - Getting tool registry...`);
        const toolRegistry = await config.getToolRegistry();
        const tools = toolRegistry.getFunctionDeclarations();
        console.debug(`[DEBUG] Interactive UI - Tools available: ${tools.length}`);
        
        const provider = getProvider(providerName, providerConfig);
        
        // Call the provider with tools
        console.debug(`[DEBUG] Interactive UI - Calling provider.queryWithTools...`);
        console.debug(`[DEBUG] Interactive UI - With tool results:`, toolResults?.length || 0);
        const response: ToolCallResponse = await provider.queryWithTools(promptText || '', tools, queryOptions);
        console.debug(`[DEBUG] Interactive UI - Response received:`, response.content?.substring(0, 100));
        console.debug(`[DEBUG] Interactive UI - Tool calls:`, response.tool_calls?.length || 0);

        // Store the response for potential tool result continuation
        if (response.tool_calls && response.tool_calls.length > 0) {
          lastAssistantResponseRef.current = response;
        }
        
        // Handle tool calls if present
        if (response.tool_calls && response.tool_calls.length > 0) {
          console.debug(`[DEBUG] Interactive UI - Processing ${response.tool_calls.length} tool calls...`);
          
          // Add assistant response first if there is any content
          if (response.content) {
            addItem(
              {
                type: 'assistant',
                text: response.content,
              },
              Date.now(),
            );
          }
          
          // Schedule tool calls
          const toolCallRequests: ToolCallRequestInfo[] = response.tool_calls.map(toolCall => {
            const args = JSON.parse(toolCall.function.arguments);
            return {
              toolName: toolCall.function.name,
              parameters: args,
              callId: toolCall.id,
              name: toolCall.function.name,
              args: args
            };
          });
          
          console.debug(`[DEBUG] Interactive UI - Scheduling tool calls:`, toolCallRequests.map(t => t.toolName));
          scheduleToolCalls(toolCallRequests, abortControllerRef.current?.signal);
          
        } else {
          // No tool calls, just add the response
          console.debug(`[DEBUG] Interactive UI - No tool calls, adding assistant response...`);
          console.debug(`[DEBUG] Interactive UI - Is continuation: ${options?.isContinuation}`);
          console.debug(`[DEBUG] Interactive UI - Response content: "${response.content?.substring(0, 200)}"`);
          
          // Always add the response, even for continuations
          if (response.content) {
            addItem(
              {
                type: 'assistant',
                text: response.content,
              },
              Date.now(),
            );
          } else if (options?.isContinuation) {
            console.warn(`[DEBUG] Interactive UI - Continuation response has no content!`);
          }
          
          // Clear last response since no tools were called
          lastAssistantResponseRef.current = null;
        }
        console.debug(`[DEBUG] Interactive UI - Added item to history`);

      } catch (error: unknown) {
        console.error(`[DEBUG] Interactive UI - Error occurred:`, error);
        if (error instanceof UnauthorizedError) {
          onAuthError();
        } else {
          const errorMsg = getErrorMessage(error) || 'Unknown error';
          console.error(`[DEBUG] Interactive UI - Error message:`, errorMsg);
          addItem(
            {
              type: MessageType.ERROR,
              text: errorMsg,
            },
            Date.now(),
          );
        }
      } finally {
        setIsResponding(false);
      }
    },
    [
      streamingState,
      setShowHelp,
      addItem,
      setInitError,
      startNewTurn,
      onAuthError,
      config,
    ],
  );

  /**
   * Automatically submits responses for completed tool calls.
   * This effect runs when `toolCalls` or `isResponding` changes.
   * It ensures that tool responses are sent back to Gemini only when
   * all processing for a given set of tools is finished and Gemini
   * is not already generating a response.
   */
  useEffect(() => {
    const run = async () => {
      if (isResponding) {
        return;
      }

      const completedAndReadyToSubmitTools = toolCalls.filter(
        (
          tc: TrackedToolCall,
        ): tc is TrackedCompletedToolCall | TrackedCancelledToolCall => {
          const isTerminalState =
            tc.status === 'success' ||
            tc.status === 'error' ||
            tc.status === 'cancelled';

          if (isTerminalState) {
            const completedOrCancelledCall = tc as
              | TrackedCompletedToolCall
              | TrackedCancelledToolCall;
            return (
              !completedOrCancelledCall.responseSubmittedToGemini &&
              completedOrCancelledCall.response?.responseParts !== undefined
            );
          }
          return false;
        },
      );

      // Finalize any client-initiated tools as soon as they are done.
      const clientTools = completedAndReadyToSubmitTools.filter(
        (t) => t.request.isClientInitiated,
      );
      if (clientTools.length > 0) {
        markToolsAsSubmitted(clientTools.map((t) => t.request.callId));
      }

      // Identify new, successful save_memory calls that we haven't processed yet.
      const newSuccessfulMemorySaves = completedAndReadyToSubmitTools.filter(
        (t) =>
          t.request.name === 'save_memory' &&
          t.status === 'success' &&
          !processedMemoryToolsRef.current.has(t.request.callId),
      );

      if (newSuccessfulMemorySaves.length > 0) {
        // Perform the refresh only if there are new ones.
        void performMemoryRefresh();
        // Mark them as processed so we don't do this again on the next render.
        newSuccessfulMemorySaves.forEach((t) =>
          processedMemoryToolsRef.current.add(t.request.callId),
        );
      }

      // Only proceed with submitting to Gemini if ALL tools are complete.
      const allToolsAreComplete =
        toolCalls.length > 0 &&
        toolCalls.length === completedAndReadyToSubmitTools.length;

      if (!allToolsAreComplete) {
        return;
      }

      const geminiTools = completedAndReadyToSubmitTools.filter(
        (t) => !t.request.isClientInitiated,
      );

      if (geminiTools.length === 0) {
        return;
      }

      // If all the tools were cancelled, don't submit a response to Gemini.
      const allToolsCancelled = geminiTools.every(
        (tc) => tc.status === 'cancelled',
      );

      if (allToolsCancelled) {
        // For non-Google providers, we don't need to manage history manually
        // The provider system handles this internally

        const callIdsToMarkAsSubmitted = geminiTools.map(
          (toolCall) => toolCall.request.callId,
        );
        markToolsAsSubmitted(callIdsToMarkAsSubmitted);
        return;
      }

      const responsesToSend: PartListUnion[] = geminiTools.map(
        (toolCall) => toolCall.response.responseParts,
      );
      const callIdsToMarkAsSubmitted = geminiTools.map(
        (toolCall) => toolCall.request.callId,
      );

      console.debug(`[DEBUG] useProviderStream - Submitting ${responsesToSend.length} tool responses to provider`);
      console.debug(`[DEBUG] useProviderStream - Tool response parts:`, responsesToSend.map(r => 
        Array.isArray(r) ? `Array[${r.length}]` : typeof r
      ));
      
      markToolsAsSubmitted(callIdsToMarkAsSubmitted);
      const mergedResponses = mergePartListUnions(responsesToSend);
      console.debug(`[DEBUG] useProviderStream - Merged responses type:`, Array.isArray(mergedResponses) ? `Array[${mergedResponses.length}]` : typeof mergedResponses);
      
      // Log the actual content being sent
      if (Array.isArray(mergedResponses)) {
        mergedResponses.forEach((part: any, index: number) => {
          if (part.functionResponse) {
            console.debug(`[DEBUG] useProviderStream - Tool response [${index}] functionResponse:`, {
              id: part.functionResponse.id,
              name: part.functionResponse.name,
              hasResponse: !!part.functionResponse.response
            });
          }
        });
      }
      
      submitQuery(mergedResponses, {
        isContinuation: true,
      });
    };
    void run();
  }, [
    toolCalls,
    isResponding,
    submitQuery,
    markToolsAsSubmitted,
    addItem,
    performMemoryRefresh,
  ]);

  const pendingHistoryItems = [
    pendingHistoryItemRef.current,
    pendingToolCallGroupDisplay,
  ].filter((i) => i !== undefined && i !== null);

  useEffect(() => {
    const saveRestorableToolCalls = async () => {
      if (!config.getCheckpointingEnabled()) {
        return;
      }
      const restorableToolCalls = toolCalls.filter(
        (toolCall) =>
          (toolCall.request.name === 'replace' ||
            toolCall.request.name === 'write_file') &&
          toolCall.status === 'awaiting_approval',
      );

      if (restorableToolCalls.length > 0) {
        const checkpointDir = config.getProjectTempDir()
          ? path.join(config.getProjectTempDir(), 'checkpoints')
          : undefined;

        if (!checkpointDir) {
          return;
        }

        try {
          await fs.mkdir(checkpointDir, { recursive: true });
        } catch (error) {
          if (!isNodeError(error) || error.code !== 'EEXIST') {
            onDebugMessage(
              `Failed to create checkpoint directory: ${getErrorMessage(error)}`,
            );
            return;
          }
        }

        for (const toolCall of restorableToolCalls) {
          const filePath = toolCall.request.args?.['file_path'] as string;
          if (!filePath) {
            onDebugMessage(
              `Skipping restorable tool call due to missing file_path: ${toolCall.request.name}`,
            );
            continue;
          }

          try {
            let commitHash = await gitService?.createFileSnapshot(
              `Snapshot for ${toolCall.request.name}`,
            );

            if (!commitHash) {
              commitHash = await gitService?.getCurrentCommitHash();
            }

            if (!commitHash) {
              onDebugMessage(
                `Failed to create snapshot for ${filePath}. Skipping restorable tool call.`,
              );
              continue;
            }

            const timestamp = new Date()
              .toISOString()
              .replace(/:/g, '-')
              .replace(/\./g, '_');
            const toolName = toolCall.request.name;
            const fileName = path.basename(filePath);
            const toolCallWithSnapshotFileName = `${timestamp}-${fileName}-${toolName}.json`;
            const clientHistory: any[] = []; // Provider system doesn't expose history directly
            const toolCallWithSnapshotFilePath = path.join(
              checkpointDir,
              toolCallWithSnapshotFileName,
            );

            await fs.writeFile(
              toolCallWithSnapshotFilePath,
              JSON.stringify(
                {
                  history,
                  clientHistory,
                  toolCall: {
                    name: toolCall.request.name,
                    args: toolCall.request.args,
                  },
                  commitHash,
                  filePath,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            onDebugMessage(
              `Failed to write restorable tool call file: ${getErrorMessage(
                error,
              )}`,
            );
          }
        }
      }
    };
    saveRestorableToolCalls();
  }, [toolCalls, config, onDebugMessage, gitService, history]);

  return {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems,
    thought,
  };
};
