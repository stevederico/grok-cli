/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  ToolRegistry,
  ToolResult,
} from '../index.js';
import { Config } from '../config/config.js';
import { convertToFunctionResponse } from './coreToolScheduler.js';

/**
 * Executes a single tool call non-interactively.
 * It does not handle confirmations, multiple calls, or live updates.
 */
export async function executeToolCall(
  config: Config,
  toolCallRequest: ToolCallRequestInfo,
  toolRegistry: ToolRegistry,
  abortSignal?: AbortSignal,
): Promise<ToolCallResponseInfo> {
  const tool = toolRegistry.getTool(toolCallRequest.name || toolCallRequest.toolName);

  const startTime = Date.now();
  if (!tool) {
    const error = new Error(
      `Tool "${toolCallRequest.name || toolCallRequest.toolName}" not found in registry.`,
    );
    const durationMs = Date.now() - startTime;
    // Ensure the response structure matches what the API expects for an error
    return {
      callId: toolCallRequest.callId,
      responseParts: [
        {
          functionResponse: {
            id: toolCallRequest.callId,
            name: toolCallRequest.name,
            response: { error: error.message },
          },
        },
      ],
      resultDisplay: error.message,
      error: error.message,
    };
  }

  try {
    // Directly execute without confirmation or live output handling
    const effectiveAbortSignal = abortSignal ?? new AbortController().signal;
    const toolResult: ToolResult = await tool.execute(
      toolCallRequest.args || toolCallRequest.parameters,
      effectiveAbortSignal,
      // No live output callback for non-interactive mode
    );

    const durationMs = Date.now() - startTime;

    const response = convertToFunctionResponse(
      toolCallRequest.name || toolCallRequest.toolName,
      toolCallRequest.callId,
      toolResult.llmContent,
    );

    return {
      callId: toolCallRequest.callId,
      responseParts: response,
      resultDisplay: typeof toolResult.returnDisplay === 'string' ? toolResult.returnDisplay : undefined,
      error: undefined,
    };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const durationMs = Date.now() - startTime;
    return {
      callId: toolCallRequest.callId,
      responseParts: [
        {
          functionResponse: {
            id: toolCallRequest.callId,
            name: toolCallRequest.name,
            response: { error: error.message },
          },
        },
      ],
      resultDisplay: error.message,
      error: error.message,
    };
  }
}
