/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo } from 'react';
import { type PartListUnion } from '../../core/__stubs__/types.js';
import open from 'open';
import process from 'node:process';
import os from 'node:os';
import { UseHistoryManagerReturn } from './useHistoryManager.js';
import {
  Config,
  GitService,
  Logger,
  MCPDiscoveryState,
  MCPServerStatus,
  getMCPDiscoveryState,
  getMCPServerStatus,
  getAvailableProviders,
  validateProvider,
  getProvider,
  getEnvVarForProvider,
  GROKCLI_CONFIG_DIR,
} from '../../core/index.js';
import { useSessionStats, calculateCost, MODEL_PRICING } from '../contexts/SessionContext.js';
import { runHooks } from '../../hooks/hookRunner.js';
import {
  Message,
  MessageType,
  HistoryItemWithoutId,
  HistoryItem,
} from '../types.js';
import { promises as fs, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { createShowMemoryAction } from './useShowMemoryCommand.js';
import { GIT_COMMIT_INFO } from '../../generated/git-commit.js';
import { formatDuration, formatMemoryUsage } from '../utils/formatters.js';
import { getCliVersion } from '../../utils/version.js';
import { LoadedSettings } from '../../config/settings.js';

export interface SlashCommandActionReturn {
  shouldScheduleTool?: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  message?: string; // For simple messages or errors
}

export interface SlashCommand {
  name: string;
  altName?: string;
  description?: string;
  completion?: () => Promise<string[]>;
  action: (
    mainCommand: string,
    subCommand?: string,
    args?: string,
  ) =>
    | void
    | SlashCommandActionReturn
    | Promise<void | SlashCommandActionReturn>; // Action can now return this object
}

/**
 * Hook to define and process slash commands (e.g., /help, /clear).
 */
export const useSlashCommandProcessor = (
  config: Config | null,
  settings: LoadedSettings,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  clearItems: UseHistoryManagerReturn['clearItems'],
  loadHistory: UseHistoryManagerReturn['loadHistory'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  onDebugMessage: (message: string) => void,
  openEditorDialog: () => void,
  performMemoryRefresh: () => Promise<void>,
  toggleCorgiMode: () => void,
  showToolDescriptions: boolean = false,
  setQuittingMessages: (message: HistoryItem[]) => void,
  openPrivacyNotice: () => void,
  openProviderDialog: () => void,
  openModelDialog: () => void,
  openThemeDialog: () => void,
  openAuthDialog: () => void,
) => {
  const session = useSessionStats();
  const gitService = useMemo(() => {
    if (!config?.getProjectRoot()) {
      return;
    }
    return new GitService(config.getProjectRoot());
  }, [config]);

  const pendingHistoryItems: HistoryItemWithoutId[] = [];

  const addMessage = useCallback(
    (message: Message) => {
      // Convert Message to HistoryItemWithoutId
      let historyItemContent: HistoryItemWithoutId;
      if (message.type === MessageType.ABOUT) {
        historyItemContent = {
          type: 'about',
          cliVersion: message.cliVersion,
          osVersion: message.osVersion,
          sandboxEnv: message.sandboxEnv,
          modelVersion: message.modelVersion,
          selectedAuthType: message.selectedAuthType,
          cloudProject: message.cloudProject,
        };
      } else if (message.type === MessageType.STATS) {
        historyItemContent = {
          type: 'stats',
          stats: message.stats,
          lastTurnStats: message.lastTurnStats,
          duration: message.duration,
        };
      } else if (message.type === MessageType.QUIT) {
        historyItemContent = {
          type: 'quit',
          stats: message.stats,
          duration: message.duration,
          sessionCost: message.sessionCost,
        };
      } else {
        historyItemContent = {
          type: message.type as
            | MessageType.INFO
            | MessageType.ERROR
            | MessageType.USER,
          text: message.content,
        };
      }
      addItem(historyItemContent, message.timestamp.getTime());
    },
    [addItem],
  );

  const showMemoryAction = useCallback(async () => {
    const actionFn = createShowMemoryAction(config, settings, addMessage);
    await actionFn();
  }, [config, settings, addMessage]);

  const addMemoryAction = useCallback(
    (
      _mainCommand: string,
      _subCommand?: string,
      args?: string,
    ): SlashCommandActionReturn | void => {
      if (!args || args.trim() === '') {
        addMessage({
          type: MessageType.ERROR,
          content: 'Usage: /memory add <text to remember>',
          timestamp: new Date(),
        });
        return;
      }
      // UI feedback for attempting to schedule
      addMessage({
        type: MessageType.INFO,
        content: `Attempting to save to memory: "${args.trim()}"`,
        timestamp: new Date(),
      });
      // Return info for scheduling the tool call
      return {
        shouldScheduleTool: true,
        toolName: 'save_memory',
        toolArgs: { fact: args.trim() },
      };
    },
    [addMessage],
  );

  const savedChatTags = useCallback(async () => {
    const clientDir = config?.getProjectTempDir();
    if (!clientDir) {
      return [];
    }
    try {
      const files = await fs.readdir(clientDir);
      return files
        .filter(
          (file) => file.startsWith('checkpoint-') && file.endsWith('.json'),
        )
        .map((file) => file.replace('checkpoint-', '').replace('.json', ''));
    } catch (_err) {
      return [];
    }
  }, [config]);

  const slashCommands: SlashCommand[] = useMemo(() => {
    const commands: SlashCommand[] = [
      {
        name: 'help',
        altName: '?',
        description: 'for help on grokcli',
        action: (_mainCommand, _subCommand, _args) => {
          onDebugMessage('Opening help.');
          setShowHelp(true);
        },
      },
      {
        name: 'docs',
        description: 'open full Grok CLI documentation in your browser',
        action: async (_mainCommand, _subCommand, _args) => {
          const docsUrl = 'https://goo.gle/grokcli-docs';
          if (process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec') {
            addMessage({
              type: MessageType.INFO,
              content: `Please open the following URL in your browser to view the documentation:\n${docsUrl}`,
              timestamp: new Date(),
            });
          } else {
            addMessage({
              type: MessageType.INFO,
              content: `Opening documentation in your browser: ${docsUrl}`,
              timestamp: new Date(),
            });
            await open(docsUrl);
          }
        },
      },
      {
        name: 'clear',
        description: 'clear the screen and conversation history',
        action: async (_mainCommand, _subCommand, _args) => {
          onDebugMessage('Clearing terminal and resetting chat.');
          clearItems();
          await config?.getGrokClient()?.resetChat();
          console.clear();
          refreshStatic();
        },
      },
      {
        name: 'editor',
        description: 'set external editor preference',
        action: (_mainCommand, _subCommand, _args) => {
          openEditorDialog();
        },
      },
      {
        name: 'privacy',
        description: 'display Grok CLI privacy information',
        action: (_mainCommand, _subCommand, _args) => {
          addMessage({
            type: MessageType.INFO,
            content: `🔒 Grok CLI Privacy Policy

Grok CLI is designed with privacy in mind:

• **No tracking**: Grok CLI collects absolutely no data about your usage, files, or interactions.
• **No analytics**: We don't track commands, queries, or any user behavior.
• **Local operation**: All CLI operations happen locally on your machine.
• **Provider communication**: Grok CLI only communicates with the AI provider you configure (like Grok, Ollama, etc.).
• **Your data stays yours**: Your conversations, files, and settings remain entirely under your control.

**Note**: The AI providers you connect to (Grok, Ollama, etc.) may have their own data policies. Please review their respective privacy policies for information about how they handle your queries.

For more information, visit: https://github.com/stevederico/grok-cli`,
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'stats',
        altName: 'usage',
        description: 'check session stats',
        action: (_mainCommand, _subCommand, _args) => {
          const now = new Date();
          const { sessionStartTime, cumulative, currentTurn } = session.stats;
          const wallDuration = now.getTime() - sessionStartTime.getTime();

          addMessage({
            type: MessageType.STATS,
            stats: cumulative,
            lastTurnStats: currentTurn,
            duration: formatDuration(wallDuration),
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'plan',
        description: 'plan changes before executing (e.g. /plan refactor auth)',
        action: (_mainCommand, _subCommand, args) => {
          const trimmedArgs = (args || '').trim();
          addMessage({
            type: MessageType.INFO,
            content: trimmedArgs
              ? `Plan mode: submit via the input prompt as "/plan ${trimmedArgs}"`
              : 'Usage: /plan <description of task>',
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'cost',
        description: 'show cost breakdown for this session',
        action: (_mainCommand, _subCommand, _args) => {
          const { cumulative, currentTurn } = session.stats;
          const model = config?.getModel() || 'unknown';

          const sessionCost = calculateCost(
            cumulative.promptTokenCount,
            cumulative.candidatesTokenCount,
            model,
          );
          const turnCost = calculateCost(
            currentTurn.promptTokenCount,
            currentTurn.candidatesTokenCount,
            model,
          );

          const pricing = MODEL_PRICING[model];
          const pricingInfo = pricing
            ? `$${pricing.input.toFixed(2)}/$${pricing.output.toFixed(2)} per 1M tokens`
            : 'free / unknown pricing';

          const lines = [
            `\u001b[1mCost Dashboard\u001b[0m`,
            ``,
            `  Model:           ${model}`,
            `  Pricing:         ${pricingInfo}`,
            ``,
            `  \u001b[36mSession Total:\u001b[0m    $${sessionCost.toFixed(6)}`,
            `    Input tokens:  ${cumulative.promptTokenCount.toLocaleString()}`,
            `    Output tokens: ${cumulative.candidatesTokenCount.toLocaleString()}`,
            ``,
            `  \u001b[36mLast Turn:\u001b[0m        $${turnCost.toFixed(6)}`,
            `    Input tokens:  ${currentTurn.promptTokenCount.toLocaleString()}`,
            `    Output tokens: ${currentTurn.candidatesTokenCount.toLocaleString()}`,
          ];

          addMessage({
            type: MessageType.INFO,
            content: lines.join('\n'),
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'mcp',
        description: 'list configured MCP servers and tools',
        action: async (_mainCommand, _subCommand, _args) => {
          // Check if the _subCommand includes a specific flag to control description visibility
          let useShowDescriptions = showToolDescriptions;
          if (_subCommand === 'desc' || _subCommand === 'descriptions') {
            useShowDescriptions = true;
          } else if (
            _subCommand === 'nodesc' ||
            _subCommand === 'nodescriptions'
          ) {
            useShowDescriptions = false;
          } else if (_args === 'desc' || _args === 'descriptions') {
            useShowDescriptions = true;
          } else if (_args === 'nodesc' || _args === 'nodescriptions') {
            useShowDescriptions = false;
          }
          // Check if the _subCommand includes a specific flag to show detailed tool schema
          let useShowSchema = false;
          if (_subCommand === 'schema' || _args === 'schema') {
            useShowSchema = true;
          }

          const toolRegistry = await config?.getToolRegistry();
          if (!toolRegistry) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Could not retrieve tool registry.',
              timestamp: new Date(),
            });
            return;
          }

          const mcpServers = config?.getMcpServers() || {};
          const serverNames = Object.keys(mcpServers);

          if (serverNames.length === 0) {
            const docsUrl = 'https://goo.gle/grokcli-docs-mcp';
            if (process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec') {
              addMessage({
                type: MessageType.INFO,
                content: `No MCP servers configured. Please open the following URL in your browser to view documentation:\n${docsUrl}`,
                timestamp: new Date(),
              });
            } else {
              addMessage({
                type: MessageType.INFO,
                content: `No MCP servers configured. Opening documentation in your browser: ${docsUrl}`,
                timestamp: new Date(),
              });
              await open(docsUrl);
            }
            return;
          }

          // Check if any servers are still connecting
          const connectingServers = serverNames.filter(
            (name) => getMCPServerStatus(name) === MCPServerStatus.CONNECTING,
          );
          const discoveryState = getMCPDiscoveryState();

          let message = '';

          // Add overall discovery status message if needed
          if (
            discoveryState === MCPDiscoveryState.IN_PROGRESS ||
            connectingServers.length > 0
          ) {
            message += `\u001b[33m⏳ MCP servers are starting up (${connectingServers.length} initializing)...\u001b[0m\n`;
            message += `\u001b[90mNote: First startup may take longer. Tool availability will update automatically.\u001b[0m\n\n`;
          }

          message += 'Configured MCP servers:\n\n';

          for (const serverName of serverNames) {
            const serverTools = toolRegistry.getToolsByServer(serverName);
            const status = getMCPServerStatus(serverName);

            // Add status indicator with descriptive text
            let statusIndicator = '';
            let statusText = '';
            switch (status) {
              case MCPServerStatus.CONNECTED:
                statusIndicator = '🟢';
                statusText = 'Ready';
                break;
              case MCPServerStatus.CONNECTING:
                statusIndicator = '🔄';
                statusText = 'Starting... (first startup may take longer)';
                break;
              case MCPServerStatus.DISCONNECTED:
              default:
                statusIndicator = '🔴';
                statusText = 'Disconnected';
                break;
            }

            // Get server description if available
            const server = mcpServers[serverName];

            // Format server header with bold formatting and status
            message += `${statusIndicator} \u001b[1m${serverName}\u001b[0m - ${statusText}`;

            // Add tool count with conditional messaging
            if (status === MCPServerStatus.CONNECTED) {
              message += ` (${serverTools.length} tools)`;
            } else if (status === MCPServerStatus.CONNECTING) {
              message += ` (tools will appear when ready)`;
            } else {
              message += ` (${serverTools.length} tools cached)`;
            }

            // Add server description with proper handling of multi-line descriptions
            if ((useShowDescriptions || useShowSchema) && server?.description) {
              const greenColor = '\u001b[32m';
              const resetColor = '\u001b[0m';

              const descLines = server.description.trim().split('\n');
              if (descLines) {
                message += ':\n';
                for (let i = 0; i < descLines.length; i++) {
                  message += `    ${greenColor}${descLines[i]}${resetColor}\n`;
                }
              } else {
                message += '\n';
              }
            } else {
              message += '\n';
            }

            // Reset formatting after server entry
            message += '\u001b[0m';

            if (serverTools.length > 0) {
              serverTools.forEach((tool) => {
                if (
                  (useShowDescriptions || useShowSchema) &&
                  tool.description
                ) {
                  // Format tool name in cyan using simple ANSI cyan color
                  message += `  - \u001b[36m${tool.name}\u001b[0m`;

                  // Apply green color to the description text
                  const greenColor = '\u001b[32m';
                  const resetColor = '\u001b[0m';

                  // Handle multi-line descriptions by properly indenting and preserving formatting
                  const descLines = tool.description.trim().split('\n');
                  if (descLines) {
                    message += ':\n';
                    for (let i = 0; i < descLines.length; i++) {
                      message += `      ${greenColor}${descLines[i]}${resetColor}\n`;
                    }
                  } else {
                    message += '\n';
                  }
                  // Reset is handled inline with each line now
                } else {
                  // Use cyan color for the tool name even when not showing descriptions
                  message += `  - \u001b[36m${tool.name}\u001b[0m\n`;
                }
                if (useShowSchema) {
                  // Prefix the parameters in cyan
                  message += `    \u001b[36mParameters:\u001b[0m\n`;
                  // Apply green color to the parameter text
                  const greenColor = '\u001b[32m';
                  const resetColor = '\u001b[0m';

                  const paramsLines = JSON.stringify(
                    tool.schema.parameters,
                    null,
                    2,
                  )
                    .trim()
                    .split('\n');
                  if (paramsLines) {
                    for (let i = 0; i < paramsLines.length; i++) {
                      message += `      ${greenColor}${paramsLines[i]}${resetColor}\n`;
                    }
                  }
                }
              });
            } else {
              message += '  No tools available\n';
            }
            message += '\n';
          }

          // Make sure to reset any ANSI formatting at the end to prevent it from affecting the terminal
          message += '\u001b[0m';

          addMessage({
            type: MessageType.INFO,
            content: message,
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'memory',
        description:
          'manage memory. Usage: /memory <show|refresh|add> [text for add]',
        action: (mainCommand, subCommand, args) => {
          switch (subCommand) {
            case 'show':
              showMemoryAction();
              return;
            case 'refresh':
              performMemoryRefresh();
              return;
            case 'add':
              return addMemoryAction(mainCommand, subCommand, args); // Return the object
            case undefined:
              addMessage({
                type: MessageType.ERROR,
                content:
                  'Missing command\nUsage: /memory <show|refresh|add> [text for add]',
                timestamp: new Date(),
              });
              return;
            default:
              addMessage({
                type: MessageType.ERROR,
                content: `Unknown /memory command: ${subCommand}. Available: show, refresh, add`,
                timestamp: new Date(),
              });
              return;
          }
        },
      },
      {
        name: 'tools',
        description: 'list available Grok CLI tools',
        action: async (_mainCommand, _subCommand, _args) => {
          // Check if the _subCommand includes a specific flag to control description visibility
          let useShowDescriptions = showToolDescriptions;
          if (_subCommand === 'desc' || _subCommand === 'descriptions') {
            useShowDescriptions = true;
          } else if (
            _subCommand === 'nodesc' ||
            _subCommand === 'nodescriptions'
          ) {
            useShowDescriptions = false;
          } else if (_args === 'desc' || _args === 'descriptions') {
            useShowDescriptions = true;
          } else if (_args === 'nodesc' || _args === 'nodescriptions') {
            useShowDescriptions = false;
          }

          const toolRegistry = await config?.getToolRegistry();
          const tools = toolRegistry?.getAllTools();
          if (!tools) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Could not retrieve tools.',
              timestamp: new Date(),
            });
            return;
          }

          // Filter out MCP tools by checking if they have a serverName property
          const coreTools = tools.filter((tool) => !('serverName' in tool));

          let message = 'Available Grok CLI tools:\n\n';

          if (coreTools.length > 0) {
            coreTools.forEach((tool) => {
              if (useShowDescriptions && tool.description) {
                // Format tool name in cyan using simple ANSI cyan color
                message += `  - \u001b[36m${tool.displayName} (${tool.name})\u001b[0m:\n`;

                // Apply green color to the description text
                const greenColor = '\u001b[32m';
                const resetColor = '\u001b[0m';

                // Handle multi-line descriptions by properly indenting and preserving formatting
                const descLines = tool.description.trim().split('\n');

                // If there are multiple lines, add proper indentation for each line
                if (descLines) {
                  for (let i = 0; i < descLines.length; i++) {
                    message += `      ${greenColor}${descLines[i]}${resetColor}\n`;
                  }
                }
              } else {
                // Use cyan color for the tool name even when not showing descriptions
                message += `  - \u001b[36m${tool.displayName}\u001b[0m\n`;
              }
            });
          } else {
            message += '  No tools available\n';
          }
          message += '\n';

          // Make sure to reset any ANSI formatting at the end to prevent it from affecting the terminal
          message += '\u001b[0m';

          addMessage({
            type: MessageType.INFO,
            content: message,
            timestamp: new Date(),
          });
        },
      },
      {
        name: 'provider',
        description: 'manage AI providers. Usage: /provider [list|current|set <provider>|select]',
        action: async (_mainCommand, subCommand, args) => {
          try {
            switch (subCommand) {
              case 'select':
              case undefined: {
                // Open interactive provider selection dialog
                openProviderDialog();
                return;
              }
              
              case 'list': {
                const availableProviders = getAvailableProviders();
                const currentProvider = config?.getProvider() || process.env.GROKCLI_PROVIDER || 'ollama';
              
                let message = '🔌 Available AI Providers:\n\n';
                
                // Check health of each provider
                for (const provider of availableProviders) {
                  const isActive = provider === currentProvider;
                  const indicator = isActive ? '●' : '○';
                  const color = isActive ? '\u001b[32m' : '\u001b[90m'; // Green for active, gray for inactive
                  
                  // Check provider health
                  const validation = await validateProvider(provider);
                  const healthIndicator = validation.healthy ? '✅' : '⚠️';
                  
                  message += `  ${color}${indicator} ${provider}${isActive ? ' (current)' : ''} ${healthIndicator}\u001b[0m\n`;
                  
                  // Show issues if any
                  if (!validation.healthy) {
                    message += `    \u001b[33m⚠️  ${validation.issues.join(', ')}\u001b[0m\n`;
                  }
                }
                
                message += '\n💡 Usage:\n';
                message += '  • /provider list - show all providers with health status\n';
                message += '  • /provider current - show current provider\n';
                message += '  • /provider set <name> - switch to a provider\n';
                message += '\n⚠️  Note: Provider changes require a CLI restart to take effect.';
                
                addMessage({
                  type: MessageType.INFO,
                  content: message,
                  timestamp: new Date(),
                });
                return;
              }
              
              case 'current': {
                const currentProvider = config?.getProvider() || process.env.GROKCLI_PROVIDER || 'ollama';
                const currentModel = config?.getModel() || 'Unknown';
                
                addMessage({
                  type: MessageType.INFO,
                  content: `🔌 Current AI Provider: ${currentProvider}\n📦 Current Model: ${currentModel}`,
                  timestamp: new Date(),
                });
                return;
              }
              
              case 'set': {
                if (!args || args.trim() === '') {
                  addMessage({
                    type: MessageType.ERROR,
                    content: 'Usage: /provider set <provider_name>\nExample: /provider set ollama',
                    timestamp: new Date(),
                  });
                  return;
                }
                
                const providerName = args.trim().toLowerCase();
                const availableProviders = getAvailableProviders();
                
                if (!availableProviders.includes(providerName)) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Unknown provider: ${providerName}\nAvailable providers: ${availableProviders.join(', ')}`,
                    timestamp: new Date(),
                  });
                  return;
                }
                
                // Check if provider requires API key
                if (providerName === 'xai') {
                  const hasApiKey = !!(process.env.XAI_API_KEY);
                  if (!hasApiKey) {
                    addMessage({
                      type: MessageType.ERROR,
                      content: `❌ XAI provider requires XAI_API_KEY environment variable.\n\n💡 Set your API key:\n  export XAI_API_KEY="your-api-key-here"\n  npm start`,
                      timestamp: new Date(),
                    });
                    return;
                  }
                } else if (providerName === 'ollama') {
                  // Validate Ollama is running
                  const validation = await validateProvider('ollama');
                  if (!validation.healthy) {
                    addMessage({
                      type: MessageType.ERROR,
                      content: `❌ Ollama provider validation failed:\n${validation.issues.map(issue => `  • ${issue}`).join('\n')}\n\n💡 Make sure Ollama is installed and running:\n  ollama serve`,
                      timestamp: new Date(),
                    });
                    return;
                  }
                }

                // Switch the provider
                config?.setProvider(providerName);
                
                // Get the provider's default model and switch to it
                try {
                  const provider = getProvider(providerName);
                  let defaultModel: string;
                  
                  if (providerName === 'xai') {
                    defaultModel = process.env.XAI_MODEL || 'grok-code-fast-1';
                  } else if (providerName === 'ollama') {
                    defaultModel = process.env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
                  } else {
                    // For other providers, try to get the first available model
                    try {
                      const models = await provider.getModels();
                      defaultModel = models.length > 0 ? models[0] : 'unknown';
                    } catch {
                      defaultModel = 'unknown';
                    }
                  }
                  
                  // Update the model
                  config?.setModel(defaultModel);
                  
                  addMessage({
                    type: MessageType.INFO,
                    content: `✅ Successfully switched to provider: ${providerName} (model: ${defaultModel})`,
                    timestamp: new Date(),
                  });
                } catch (error) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Provider switched but failed to update model: ${error instanceof Error ? error.message : String(error)}`,
                    timestamp: new Date(),
                  });
                }
                return;
              }
              
              default: {
                addMessage({
                  type: MessageType.ERROR,
                  content: `Unknown /provider command: ${subCommand}. Available: list, current, set`,
                  timestamp: new Date(),
                });
                return;
              }
            }
          } catch (error) {
            addMessage({
              type: MessageType.ERROR,
              content: `Error in /provider command: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            });
          }
        },
      },
      {
        name: 'model',
        description: 'manage AI models. Usage: /model [list|current|set <model>|select]',
        action: async (_mainCommand, subCommand, args) => {
          try {
            const currentProvider = config?.getProvider() || process.env.GROKCLI_PROVIDER || 'ollama';
            
            switch (subCommand) {
              case 'select':
              case undefined: {
                // Open interactive model selection dialog
                openModelDialog();
                return;
              }
              
              case 'list': {
                try {
                  const provider = getProvider(currentProvider);
                  const availableModels = await provider.getModels();
                  const currentModel = config?.getModel() || 'Unknown';
                  
                  let message = `🤖 Available Models for ${currentProvider}:\n\n`;
                  
                  if (availableModels.length === 0) {
                    message += '  No models available\n';
                    if (currentProvider === 'ollama') {
                      message += '\n💡 Install a model:\n  ollama pull llama3.2\n  ollama pull mistral\n  ollama pull codellama';
                    }
                  } else {
                    availableModels.forEach((model, index) => {
                      const isActive = model === currentModel;
                      const indicator = isActive ? '●' : '○';
                      const color = isActive ? '\u001b[32m' : '\u001b[90m';
                      message += `  ${color}${indicator} ${model}${isActive ? ' (current)' : ''}\u001b[0m\n`;
                    });
                  }
                  
                  message += '\n💡 Usage:\n';
                  message += '  • /model list - show all models\n';
                  message += '  • /model current - show current model\n';
                  message += '  • /model set <name> - switch to a model\n';
                  
                  addMessage({
                    type: MessageType.INFO,
                    content: message,
                    timestamp: new Date(),
                  });
                } catch (error) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Failed to fetch models for ${currentProvider}: ${error instanceof Error ? error.message : String(error)}`,
                    timestamp: new Date(),
                  });
                }
                return;
              }
              
              case 'current': {
                const currentModel = config?.getModel() || 'Unknown';
                addMessage({
                  type: MessageType.INFO,
                  content: `🤖 Current Model: ${currentModel}\n🔌 Provider: ${currentProvider}`,
                  timestamp: new Date(),
                });
                return;
              }
              
              case 'set': {
                if (!args || args.trim() === '') {
                  addMessage({
                    type: MessageType.ERROR,
                    content: 'Usage: /model set <model_name>\nExample: /model set llama3.2:latest',
                    timestamp: new Date(),
                  });
                  return;
                }
                
                const modelName = args.trim();
                
                try {
                  const provider = getProvider(currentProvider);
                  const availableModels = await provider.getModels();
                  
                  if (!availableModels.includes(modelName)) {
                    addMessage({
                      type: MessageType.ERROR,
                      content: `❌ Model '${modelName}' not found.\nAvailable models: ${availableModels.join(', ')}`,
                      timestamp: new Date(),
                    });
                    return;
                  }
                  
                  // Switch the model
                  config?.setModel(modelName);
                  
                  addMessage({
                    type: MessageType.INFO,
                    content: `✅ Successfully switched to model: ${modelName}`,
                    timestamp: new Date(),
                  });
                } catch (error) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Failed to switch model: ${error instanceof Error ? error.message : String(error)}`,
                    timestamp: new Date(),
                  });
                }
                return;
              }
              
              default: {
                addMessage({
                  type: MessageType.ERROR,
                  content: `Unknown /model command: ${subCommand}. Available: list, current, set`,
                  timestamp: new Date(),
                });
                return;
              }
            }
          } catch (error) {
            addMessage({
              type: MessageType.ERROR,
              content: `Error in /model command: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            });
          }
        },
      },
      {
        name: 'context-size',
        description: 'manage context size limit. Usage: /context-size [current|set <size>]',
        action: async (_mainCommand, subCommand, args) => {
          try {
            switch (subCommand) {
              case 'current':
              case undefined: {
                const currentContextSize = parseInt(process.env.GROKCLI_CONTEXT_SIZE || '128000', 10);
                addMessage({
                  type: MessageType.INFO,
                  content: `🧠 Current Context Size: ${currentContextSize.toLocaleString()} tokens\n\n💡 Usage:\n  • /context-size current - show current context size\n  • /context-size set <size> - set context size (e.g., 256000)`,
                  timestamp: new Date(),
                });
                return;
              }
              
              case 'set': {
                if (!args || args.trim() === '') {
                  addMessage({
                    type: MessageType.ERROR,
                    content: 'Usage: /context-size set <size>\nExample: /context-size set 256000',
                    timestamp: new Date(),
                  });
                  return;
                }
                
                const sizeString = args.trim();
                const newSize = parseInt(sizeString, 10);
                
                if (isNaN(newSize) || newSize <= 0) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Invalid context size: ${sizeString}\nContext size must be a positive number.`,
                    timestamp: new Date(),
                  });
                  return;
                }
                
                if (newSize > 1000000) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `❌ Context size too large: ${newSize.toLocaleString()}\nMaximum recommended size is 1,000,000 tokens.`,
                    timestamp: new Date(),
                  });
                  return;
                }
                
                // Set the environment variable
                process.env.GROKCLI_CONTEXT_SIZE = newSize.toString();
                
                addMessage({
                  type: MessageType.INFO,
                  content: `✅ Context size updated to: ${newSize.toLocaleString()} tokens\n\n⚠️  Note: This change applies to new conversations. Current conversation context may still use the previous limit.`,
                  timestamp: new Date(),
                });
                return;
              }
              
              default: {
                addMessage({
                  type: MessageType.ERROR,
                  content: `Unknown /context-size command: ${subCommand}. Available: current, set`,
                  timestamp: new Date(),
                });
                return;
              }
            }
          } catch (error) {
            addMessage({
              type: MessageType.ERROR,
              content: `Error in /context-size command: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            });
          }
        },
      },
      {
        name: 'corgi',
        action: (_mainCommand, _subCommand, _args) => {
          toggleCorgiMode();
        },
      },
      {
        name: 'about',
        description: 'show Grok CLI version and system info',
        action: async (_mainCommand, _subCommand, _args) => {
          const osVersion = process.platform;
          let sandboxEnv = 'no sandbox';
          if (process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec') {
            sandboxEnv = process.env.SANDBOX;
          } else if (process.env.SANDBOX === 'sandbox-exec') {
            sandboxEnv = `sandbox-exec (${
              process.env.SEATBELT_PROFILE || 'unknown'
            })`;
          }
          const modelVersion = config?.getModel() || 'Unknown';
          const cliVersion = await getCliVersion();
          const selectedAuthType = settings.merged.selectedAuthType || '';
          const cloudProject = process.env.CLOUD_PROJECT || '';
          addMessage({
            type: MessageType.ABOUT,
            timestamp: new Date(),
            cliVersion,
            osVersion,
            sandboxEnv,
            modelVersion,
            selectedAuthType,
            cloudProject,
          });
        },
      },
      {
        name: 'bug',
        description: 'submit a Grok CLI bug report',
        action: async (_mainCommand, _subCommand, args) => {
          let bugDescription = _subCommand || '';
          if (args) {
            bugDescription += ` ${args}`;
          }
          bugDescription = bugDescription.trim();

          const osVersion = `${process.platform} ${process.version}`;
          let sandboxEnv = 'no sandbox';
          if (process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec') {
            sandboxEnv = process.env.SANDBOX.replace(/^grokcli-(?:code-)?/, '');
          } else if (process.env.SANDBOX === 'sandbox-exec') {
            sandboxEnv = `sandbox-exec (${
              process.env.SEATBELT_PROFILE || 'unknown'
            })`;
          }
          const modelVersion = config?.getModel() || 'Unknown';
          const cliVersion = await getCliVersion();
          const memoryUsage = formatMemoryUsage(process.memoryUsage().rss);

          const info = `
*   **CLI Version:** ${cliVersion}
*   **Git Commit:** ${GIT_COMMIT_INFO}
*   **Operating System:** ${osVersion}
*   **Sandbox Environment:** ${sandboxEnv}
*   **Model Version:** ${modelVersion}
*   **Memory Usage:** ${memoryUsage}
`;

          let bugReportUrl =
            'https://github.com/stevederico/grok-cli/issues/new?template=bug_report.yml&title={title}&info={info}';
          const bugCommand = config?.getBugCommand();
          if (bugCommand?.urlTemplate) {
            bugReportUrl = bugCommand.urlTemplate;
          }
          bugReportUrl = bugReportUrl
            .replace('{title}', encodeURIComponent(bugDescription))
            .replace('{info}', encodeURIComponent(info));

          addMessage({
            type: MessageType.INFO,
            content: `To submit your bug report, please open the following URL in your browser:\n${bugReportUrl}`,
            timestamp: new Date(),
          });
          (async () => {
            try {
              await open(bugReportUrl);
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              addMessage({
                type: MessageType.ERROR,
                content: `Could not open URL in browser: ${errorMessage}`,
                timestamp: new Date(),
              });
            }
          })();
        },
      },
      {
        name: 'chat',
        description:
          'Manage conversation history. Usage: /chat <list|save|resume> [tag]',
        action: async (_mainCommand, subCommand, args) => {
          const tag = (args || '').trim();
          const logger = new Logger(config?.getSessionId() || '');
          await logger.initialize();
          const chat = await config?.getGrokClient()?.getChat();
          if (!chat) {
            addMessage({
              type: MessageType.ERROR,
              content: 'No chat client available for conversation status.',
              timestamp: new Date(),
            });
            return;
          }
          if (!subCommand) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Missing command\nUsage: /chat <list|save|resume> [tag]',
              timestamp: new Date(),
            });
            return;
          }
          switch (subCommand) {
            case 'save': {
              const history = chat.getHistory();
              if (history.length > 0) {
                await logger.saveCheckpoint(chat?.getHistory() || [], tag);
                addMessage({
                  type: MessageType.INFO,
                  content: `Conversation checkpoint saved${tag ? ' with tag: ' + tag : ''}.`,
                  timestamp: new Date(),
                });
              } else {
                addMessage({
                  type: MessageType.INFO,
                  content: 'No conversation found to save.',
                  timestamp: new Date(),
                });
              }
              return;
            }
            case 'resume':
            case 'restore':
            case 'load': {
              const conversation = await logger.loadCheckpoint(tag);
              if (conversation.length === 0) {
                addMessage({
                  type: MessageType.INFO,
                  content: `No saved checkpoint found${tag ? ' with tag: ' + tag : ''}.`,
                  timestamp: new Date(),
                });
                return;
              }

              clearItems();
              chat.clearHistory();
              const rolemap: { [key: string]: MessageType } = {
                user: MessageType.USER,
                model: MessageType.GROK,
              };
              let hasSystemPrompt = false;
              let i = 0;
              for (const item of conversation) {
                i += 1;

                // Add each item to history regardless of whether we display
                // it.
                chat.addHistory(item);

                const text =
                  item.parts
                    ?.filter((m: any) => !!m.text)
                    .map((m: any) => m.text)
                    .join('') || '';
                if (!text) {
                  // Parsing Part[] back to various non-text output not yet implemented.
                  continue;
                }
                if (i === 1 && text.match(/context for our chat/)) {
                  hasSystemPrompt = true;
                }
                if (i > 2 || !hasSystemPrompt) {
                  addItem(
                    {
                      type:
                        (item.role && rolemap[item.role]) || MessageType.GROK,
                      text,
                    } as HistoryItemWithoutId,
                    i,
                  );
                }
              }
              console.clear();
              refreshStatic();
              return;
            }
            case 'list':
              addMessage({
                type: MessageType.INFO,
                content:
                  'list of saved conversations: ' +
                  (await savedChatTags()).join(', '),
                timestamp: new Date(),
              });
              return;
            default:
              addMessage({
                type: MessageType.ERROR,
                content: `Unknown /chat command: ${subCommand}. Available: list, save, resume`,
                timestamp: new Date(),
              });
              return;
          }
        },
        completion: async () =>
          (await savedChatTags()).map((tag) => 'resume ' + tag),
      },
      {
        name: 'quit',
        altName: 'exit',
        description: 'exit the cli',
        action: async (mainCommand, _subCommand, _args) => {
          const now = new Date();
          const { sessionStartTime, cumulative } = session.stats;
          const wallDuration = now.getTime() - sessionStartTime.getTime();

          const sessionCost = config
            ? calculateCost(
                cumulative.promptTokenCount,
                cumulative.candidatesTokenCount,
                config.getModel(),
              )
            : 0;

          setQuittingMessages([
            {
              type: 'user',
              text: `/${mainCommand}`,
              id: now.getTime() - 1,
            },
            {
              type: 'quit',
              stats: cumulative,
              duration: formatDuration(wallDuration),
              sessionCost,
              id: now.getTime(),
            },
          ]);

          setTimeout(async () => {
            if (config) {
              await runHooks('SessionEnd', config.getHooksSettings(), {
                GROK_SESSION_ID: config.getSessionId(),
              }, { blocking: true });
            }
            process.exit(0);
          }, 100);
        },
      },
      {
        name: 'theme',
        description: 'open theme selection dialog',
        action: () => {
          openThemeDialog();
        },
      },
      {
        name: 'auth',
        altName: 'setup',
        description: 'set API key or base URL: /auth <key> | /auth baseurl <url>',
        action: async (_mainCommand: string, subCommand?: string, args?: string) => {
          if (!subCommand) {
            openAuthDialog();
            return;
          }

          // Helper to read/write the env file
          const configDir = path.join(os.homedir(), GROKCLI_CONFIG_DIR);
          const envFilePath = path.join(configDir, '.env');

          const readEnvFile = async (): Promise<string> => {
            try {
              return await fs.readFile(envFilePath, 'utf-8');
            } catch {
              return '';
            }
          };

          const setEnvVar = async (varName: string, value: string) => {
            await fs.mkdir(configDir, { recursive: true });
            let envContent = await readEnvFile();
            const line = `${varName}=${value}`;
            if (envContent.includes(`${varName}=`)) {
              envContent = envContent.replace(new RegExp(`^${varName}=.*$`, 'm'), line);
            } else {
              envContent = envContent ? envContent.trimEnd() + '\n' + line + '\n' : line + '\n';
            }
            await fs.writeFile(envFilePath, envContent, 'utf-8');
            process.env[varName] = value;
          };

          try {
            if (subCommand === 'show') {
              const lines: string[] = [];
              const allProviders = getAvailableProviders();
              for (const pName of allProviders) {
                const envVar = getEnvVarForProvider(pName);
                if (!envVar) continue; // skip ollama
                const value = process.env[envVar];
                const masked = value
                  ? value.slice(0, 7) + '...' + value.slice(-4)
                  : '(not set)';
                lines.push(`${envVar}: ${masked}`);
              }
              const baseUrl = process.env.XAI_BASE_URL || 'https://api.x.ai/v1 (default)';
              lines.push(`XAI_BASE_URL: ${baseUrl}`);
              addMessage({
                type: MessageType.INFO,
                content: lines.join('\n'),
                timestamp: new Date(),
              });
              return;
            }

            if (subCommand === 'baseurl') {
              const url = args?.trim();
              if (!url) {
                addMessage({
                  type: MessageType.ERROR,
                  content: 'Usage: /auth baseurl <url>',
                  timestamp: new Date(),
                });
                return;
              }
              await setEnvVar('XAI_BASE_URL', url);
              addMessage({
                type: MessageType.INFO,
                content: `Base URL saved to ${envFilePath} and loaded into current session.`,
                timestamp: new Date(),
              });
              return;
            }

            // Default: treat subCommand as the API key for current provider
            const apiKey = args ? `${subCommand} ${args}`.trim() : subCommand;
            const currentProvider = config?.getProvider() || 'xai';
            const envVar = getEnvVarForProvider(currentProvider);
            if (!envVar) {
              addMessage({
                type: MessageType.ERROR,
                content: `Provider "${currentProvider}" does not use an API key.`,
                timestamp: new Date(),
              });
              return;
            }
            await setEnvVar(envVar, apiKey);
            addMessage({
              type: MessageType.INFO,
              content: `${envVar} saved to ${envFilePath} and loaded into current session.`,
              timestamp: new Date(),
            });
          } catch (e) {
            addMessage({
              type: MessageType.ERROR,
              content: `Failed to save: ${e instanceof Error ? e.message : String(e)}`,
              timestamp: new Date(),
            });
          }
        },
      },
      {
        name: 'compress',
        description: 'replace chat context with a compressed summary to reduce token usage',
        action: async () => {
          try {
            const chat = await config?.getGrokClient()?.getChat();
            if (!chat) {
              addMessage({
                type: MessageType.ERROR,
                content: 'No chat client available for compression.',
                timestamp: new Date(),
              });
              return;
            }

            const chatHistory = chat.getHistory();
            if (chatHistory.length === 0 && history.length === 0) {
              addMessage({
                type: MessageType.INFO,
                content: 'Nothing to compress — conversation is empty.',
                timestamp: new Date(),
              });
              return;
            }

            // Build condensed text from history
            const condensedParts: string[] = [];
            for (const item of history) {
              if (item.type === 'user' && item.text) {
                condensedParts.push(`User: ${item.text}`);
              } else if (item.type === 'assistant' && item.text) {
                const truncated = item.text.length > 200
                  ? item.text.substring(0, 200) + '...'
                  : item.text;
                condensedParts.push(`Assistant: ${truncated}`);
              }
            }

            const compressedSummary = condensedParts.length > 0
              ? `[Compressed conversation context]\n${condensedParts.join('\n')}`
              : '[Compressed conversation context]\n(no extractable messages)';

            // Clear UI history and chat client history
            clearItems();
            chat.clearHistory();

            // Add compressed summary as info message in UI
            addMessage({
              type: MessageType.INFO,
              content: `Conversation compressed. ${condensedParts.length} messages summarized.`,
              timestamp: new Date(),
            });

            // Re-add compressed content to chat client so LLM has context
            chat.addHistory({
              role: 'user',
              parts: [{ text: compressedSummary }],
            });
            chat.addHistory({
              role: 'model',
              parts: [{ text: 'Understood. I have the compressed context of our previous conversation. How can I help?' }],
            });

            console.clear();
            refreshStatic();
          } catch (error) {
            addMessage({
              type: MessageType.ERROR,
              content: `Error compressing conversation: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
            });
          }
        },
      },
    ];

    // --- /init command ---
    commands.push({
      name: 'init',
      description: 'initialize .grok-cli/ project config with GROKCLI.md template and .grok-cli-ignore',
      action: async (_mainCommand, _subCommand, _args) => {
        const projectRoot = config?.getProjectRoot();
        if (!projectRoot) {
          addMessage({
            type: MessageType.ERROR,
            content: 'Could not determine project root.',
            timestamp: new Date(),
          });
          return;
        }
        const grokDir = path.join(projectRoot, '.grok-cli');
        const mdPath = path.join(grokDir, 'GROKCLI.md');
        const ignorePath = path.join(projectRoot, '.grok-cli-ignore');
        const commandsDir = path.join(grokDir, 'commands');

        try {
          await fs.mkdir(grokDir, { recursive: true });
          await fs.mkdir(commandsDir, { recursive: true });

          // Create GROKCLI.md template if it doesn't exist
          try {
            await fs.access(mdPath);
          } catch {
            await fs.writeFile(mdPath, [
              '# Project Instructions',
              '',
              '## Overview',
              'Describe your project here.',
              '',
              '## Conventions',
              '- Add coding conventions, style guides, etc.',
              '',
              '## Custom Commands',
              'Place .md files in `.grok-cli/commands/` to create custom slash commands.',
              '',
            ].join('\n'), 'utf-8');
          }

          // Create .grok-cli-ignore if it doesn't exist
          try {
            await fs.access(ignorePath);
          } catch {
            await fs.writeFile(ignorePath, [
              'node_modules/',
              'dist/',
              'build/',
              '.git/',
              '*.log',
              '.env',
              '.env.*',
              '',
            ].join('\n'), 'utf-8');
          }

          addMessage({
            type: MessageType.INFO,
            content: `Initialized .grok-cli/ project config:\n  ${mdPath}\n  ${ignorePath}\n  ${commandsDir}/`,
            timestamp: new Date(),
          });
        } catch (error) {
          addMessage({
            type: MessageType.ERROR,
            content: `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          });
        }
      },
    });

    // --- /undo and /redo commands ---
    const undoRedoStack: string[] = []; // redo stack (in-memory)

    commands.push({
      name: 'undo',
      description: 'undo the last change by restoring to the previous checkpoint',
      action: async (_mainCommand, _subCommand, _args) => {
        if (!config?.getCheckpointingEnabled()) {
          addMessage({
            type: MessageType.INFO,
            content: 'Checkpointing is not enabled. Enable it to use /undo.',
            timestamp: new Date(),
          });
          return;
        }
        if (!gitService) {
          addMessage({
            type: MessageType.ERROR,
            content: 'Git service not available.',
            timestamp: new Date(),
          });
          return;
        }
        try {
          await gitService.initialize();
          const repo = (gitService as any).shadowGitRepository;
          if (!repo) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Shadow git repository not available.',
              timestamp: new Date(),
            });
            return;
          }
          // Get the current HEAD hash before undoing
          const currentHash = (await repo.revparse(['HEAD'])).trim();
          // Get the parent commit
          const parentHash = (await repo.revparse(['HEAD~1'])).trim();

          if (!parentHash) {
            addMessage({
              type: MessageType.INFO,
              content: 'Nothing to undo — no previous checkpoint found.',
              timestamp: new Date(),
            });
            return;
          }

          // Push current hash to redo stack
          undoRedoStack.push(currentHash);

          // Restore to parent
          await gitService.restoreProjectFromSnapshot(parentHash);

          addMessage({
            type: MessageType.INFO,
            content: `Undo successful. Restored to previous checkpoint.`,
            timestamp: new Date(),
          });
        } catch (error) {
          addMessage({
            type: MessageType.ERROR,
            content: `Undo failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          });
        }
      },
    });

    commands.push({
      name: 'redo',
      description: 'redo the last undone change',
      action: async (_mainCommand, _subCommand, _args) => {
        if (!config?.getCheckpointingEnabled()) {
          addMessage({
            type: MessageType.INFO,
            content: 'Checkpointing is not enabled. Enable it to use /redo.',
            timestamp: new Date(),
          });
          return;
        }
        if (!gitService) {
          addMessage({
            type: MessageType.ERROR,
            content: 'Git service not available.',
            timestamp: new Date(),
          });
          return;
        }
        if (undoRedoStack.length === 0) {
          addMessage({
            type: MessageType.INFO,
            content: 'Nothing to redo.',
            timestamp: new Date(),
          });
          return;
        }
        try {
          const redoHash = undoRedoStack.pop()!;
          await gitService.restoreProjectFromSnapshot(redoHash);
          addMessage({
            type: MessageType.INFO,
            content: `Redo successful. Restored to checkpoint.`,
            timestamp: new Date(),
          });
        } catch (error) {
          addMessage({
            type: MessageType.ERROR,
            content: `Redo failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          });
        }
      },
    });

    // --- /share command ---
    commands.push({
      name: 'share',
      description: 'export conversation history to a markdown file and copy path to clipboard',
      action: async (_mainCommand, _subCommand, _args) => {
        try {
          const tempDir = config?.getProjectTempDir();
          if (!tempDir) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Could not determine project temp directory.',
              timestamp: new Date(),
            });
            return;
          }

          const shareDir = path.join(tempDir, 'shared');
          await fs.mkdir(shareDir, { recursive: true });

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filePath = path.join(shareDir, `conversation-${timestamp}.md`);

          // Build markdown from history
          const lines: string[] = ['# Grok CLI Conversation', '', `Exported: ${new Date().toLocaleString()}`, ''];

          for (const item of history) {
            if (item.type === 'user' && item.text) {
              lines.push(`## User\n\n${item.text}\n`);
            } else if (item.type === 'assistant' && item.text) {
              lines.push(`## Assistant\n\n${item.text}\n`);
            } else if (item.type === 'info' && item.text) {
              lines.push(`> ${item.text}\n`);
            }
          }

          await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

          // Copy path to clipboard (macOS)
          try {
            const { execSync } = await import('child_process');
            execSync(`echo "${filePath}" | pbcopy`);
          } catch {
            // Clipboard copy is best-effort
          }

          addMessage({
            type: MessageType.INFO,
            content: `Conversation exported to:\n${filePath}\n\nPath copied to clipboard.`,
            timestamp: new Date(),
          });
        } catch (error) {
          addMessage({
            type: MessageType.ERROR,
            content: `Share failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          });
        }
      },
    });

    // --- /commands command (custom commands) ---
    commands.push({
      name: 'commands',
      description: 'manage custom commands. Usage: /commands [list|create <name>]',
      action: async (_mainCommand, subCommand, args) => {
        const projectRoot = config?.getProjectRoot();
        if (!projectRoot) {
          addMessage({
            type: MessageType.ERROR,
            content: 'Could not determine project root.',
            timestamp: new Date(),
          });
          return;
        }
        const commandsDir = path.join(projectRoot, '.grok-cli', 'commands');

        switch (subCommand) {
          case 'list':
          case undefined: {
            try {
              await fs.mkdir(commandsDir, { recursive: true });
              const files = await fs.readdir(commandsDir);
              const mdFiles = files.filter((f) => f.endsWith('.md'));
              if (mdFiles.length === 0) {
                addMessage({
                  type: MessageType.INFO,
                  content: `No custom commands found.\nCreate one with: /commands create <name>`,
                  timestamp: new Date(),
                });
                return;
              }
              const names = mdFiles.map((f) => `  /${f.replace('.md', '')}`).join('\n');
              addMessage({
                type: MessageType.INFO,
                content: `Custom commands:\n${names}`,
                timestamp: new Date(),
              });
            } catch (error) {
              addMessage({
                type: MessageType.ERROR,
                content: `Failed to list commands: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date(),
              });
            }
            return;
          }

          case 'create': {
            const cmdName = (args || '').trim();
            if (!cmdName) {
              addMessage({
                type: MessageType.ERROR,
                content: 'Usage: /commands create <name>',
                timestamp: new Date(),
              });
              return;
            }
            try {
              await fs.mkdir(commandsDir, { recursive: true });
              const cmdPath = path.join(commandsDir, `${cmdName}.md`);
              try {
                await fs.access(cmdPath);
                addMessage({
                  type: MessageType.ERROR,
                  content: `Command "/${cmdName}" already exists at ${cmdPath}`,
                  timestamp: new Date(),
                });
                return;
              } catch {
                // File doesn't exist, good
              }
              await fs.writeFile(cmdPath, [
                `# /${cmdName}`,
                '',
                'Describe what this command should do.',
                'This text will be injected as a prompt to the AI when you run the command.',
                '',
              ].join('\n'), 'utf-8');
              addMessage({
                type: MessageType.INFO,
                content: `Created custom command template: ${cmdPath}\nEdit the file, then use /${cmdName} to run it.`,
                timestamp: new Date(),
              });
            } catch (error) {
              addMessage({
                type: MessageType.ERROR,
                content: `Failed to create command: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date(),
              });
            }
            return;
          }

          default: {
            addMessage({
              type: MessageType.ERROR,
              content: `Unknown /commands subcommand: ${subCommand}. Available: list, create`,
              timestamp: new Date(),
            });
            return;
          }
        }
      },
    });

    // --- Dynamic custom commands: scan .grok-cli/commands/ and register each .md as a slash command ---
    {
      const dynProjectRoot = config?.getProjectRoot();
      if (dynProjectRoot) {
        const commandsDir = path.join(dynProjectRoot, '.grok-cli', 'commands');
        try {
          const files: string[] = readdirSync(commandsDir);
          for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const cmdName = file.replace('.md', '');
            // Don't override built-in commands
            if (commands.some((c) => c.name === cmdName)) continue;
            commands.push({
              name: cmdName,
              description: `Custom command from .grok-cli/commands/${file}`,
              action: async () => {
                try {
                  const content = readFileSync(path.join(commandsDir, file), 'utf-8');
                  return {
                    shouldScheduleTool: false,
                    message: content,
                  };
                } catch (error) {
                  addMessage({
                    type: MessageType.ERROR,
                    content: `Failed to load command /${cmdName}: ${error instanceof Error ? error.message : String(error)}`,
                    timestamp: new Date(),
                  });
                }
              },
            });
          }
        } catch {
          // Commands dir doesn't exist yet, that's fine
        }
      }
    }

    commands.push({
      name: 'restore',
      description:
        'restore a tool call. This will reset the conversation and file history to the state it was in when the tool call was suggested',
        completion: async () => {
          const checkpointDir = config?.getProjectTempDir()
            ? path.join(config.getProjectTempDir(), 'checkpoints')
            : undefined;
          if (!checkpointDir) {
            return [];
          }
          try {
            const files = await fs.readdir(checkpointDir);
            return files
              .filter((file) => file.endsWith('.json'))
              .map((file) => file.replace('.json', ''));
          } catch (_err) {
            return [];
          }
        },
        action: async (_mainCommand, subCommand, _args) => {
          if (!config?.getCheckpointingEnabled()) {
            addMessage({
              type: MessageType.INFO,
              content: 'Checkpointing is not enabled. Enable it to use /restore.',
              timestamp: new Date(),
            });
            return;
          }
          const checkpointDir = config?.getProjectTempDir()
            ? path.join(config.getProjectTempDir(), 'checkpoints')
            : undefined;

          if (!checkpointDir) {
            addMessage({
              type: MessageType.ERROR,
              content: 'Could not determine the .grok-cli directory path.',
              timestamp: new Date(),
            });
            return;
          }

          try {
            // Ensure the directory exists before trying to read it.
            await fs.mkdir(checkpointDir, { recursive: true });
            const files = await fs.readdir(checkpointDir);
            const jsonFiles = files.filter((file) => file.endsWith('.json'));

            if (!subCommand) {
              if (jsonFiles.length === 0) {
                addMessage({
                  type: MessageType.INFO,
                  content: 'No restorable tool calls found.',
                  timestamp: new Date(),
                });
                return;
              }
              const truncatedFiles = jsonFiles.map((file) => {
                const components = file.split('.');
                if (components.length <= 1) {
                  return file;
                }
                components.pop();
                return components.join('.');
              });
              const fileList = truncatedFiles.join('\n');
              addMessage({
                type: MessageType.INFO,
                content: `Available tool calls to restore:\n\n${fileList}`,
                timestamp: new Date(),
              });
              return;
            }

            const selectedFile = subCommand.endsWith('.json')
              ? subCommand
              : `${subCommand}.json`;

            if (!jsonFiles.includes(selectedFile)) {
              addMessage({
                type: MessageType.ERROR,
                content: `File not found: ${selectedFile}`,
                timestamp: new Date(),
              });
              return;
            }

            const filePath = path.join(checkpointDir, selectedFile);
            const data = await fs.readFile(filePath, 'utf-8');
            const toolCallData = JSON.parse(data);

            if (toolCallData.history) {
              loadHistory(toolCallData.history);
            }

            if (toolCallData.clientHistory) {
              await config
                ?.getGrokClient()
                ?.setHistory(toolCallData.clientHistory);
            }

            if (toolCallData.commitHash) {
              await gitService?.restoreProjectFromSnapshot(
                toolCallData.commitHash,
              );
              addMessage({
                type: MessageType.INFO,
                content: `Restored project to the state before the tool call.`,
                timestamp: new Date(),
              });
            }

            return {
              shouldScheduleTool: true,
              toolName: toolCallData.toolCall.name,
              toolArgs: toolCallData.toolCall.args,
            };
          } catch (error) {
            addMessage({
              type: MessageType.ERROR,
              content: `Could not read restorable tool calls. This is the error: ${error}`,
              timestamp: new Date(),
            });
          }
        },
      });
    return commands;
  }, [
    onDebugMessage,
    setShowHelp,
    refreshStatic,
    openEditorDialog,
    clearItems,
    performMemoryRefresh,
    showMemoryAction,
    addMemoryAction,
    addMessage,
    toggleCorgiMode,
    savedChatTags,
    config,
    settings,
    showToolDescriptions,
    session,
    gitService,
    loadHistory,
    addItem,
    setQuittingMessages,
    openPrivacyNotice,
    openThemeDialog,
    openAuthDialog,
  ]);

  const handleSlashCommand = useCallback(
    async (
      rawQuery: PartListUnion,
    ): Promise<SlashCommandActionReturn | boolean> => {
      if (typeof rawQuery !== 'string') {
        return false;
      }
      const trimmed = rawQuery.trim();
      if (!trimmed.startsWith('/') && !trimmed.startsWith('?')) {
        return false;
      }
      const userMessageTimestamp = Date.now();
      if (trimmed !== '/quit' && trimmed !== '/exit') {
        addItem(
          { type: MessageType.USER, text: trimmed },
          userMessageTimestamp,
        );
      }

      let subCommand: string | undefined;
      let args: string | undefined;

      const commandToMatch = (() => {
        if (trimmed.startsWith('?')) {
          return 'help';
        }
        const parts = trimmed.substring(1).trim().split(/\s+/);
        if (parts.length > 1) {
          subCommand = parts[1];
        }
        if (parts.length > 2) {
          args = parts.slice(2).join(' ');
        }
        return parts[0];
      })();

      const mainCommand = commandToMatch;

      for (const cmd of slashCommands) {
        if (mainCommand === cmd.name || mainCommand === cmd.altName) {
          const actionResult = await cmd.action(mainCommand, subCommand, args);
          if (
            typeof actionResult === 'object' &&
            (actionResult?.shouldScheduleTool || actionResult?.message)
          ) {
            return actionResult; // Return the object for useProviderStream
          }
          return true; // Command was handled, but no tool to schedule
        }
      }

      addMessage({
        type: MessageType.ERROR,
        content: `Unknown command: ${trimmed}`,
        timestamp: new Date(),
      });
      return true; // Indicate command was processed (even if unknown)
    },
    [addItem, slashCommands, addMessage],
  );

  return { handleSlashCommand, slashCommands, pendingHistoryItems };
};
