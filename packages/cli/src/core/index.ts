/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Export provider system
export * from './providers/index.js';
export * from './providers/registry.js';
export * from './providers/xai.js';
export * from './providers/ollama.js';
export * from './providers/systemPrompts.js';

// Export high-level query API
export * from './query.js';

// Export config
export * from './config/config.js';
export { DEFAULT_GROK_MODEL, DEFAULT_GROK_FLASH_MODEL, DEFAULT_GROK_EMBEDDING_MODEL } from './config/models.js';

// Export Core Logic
export * from './core/types.js';
export * from './core/logger.js';
export * from './core/prompts.js';
export * from './core/tokenLimits.js';
export * from './core/coreToolScheduler.js';
export * from './core/nonInteractiveToolExecutor.js';
export * from './core/providerClient.js';


// Export utilities
export * from './utils/paths.js';
export * from './utils/schemaValidator.js';
export * from './utils/errors.js';
export * from './utils/getFolderStructure.js';
export * from './utils/memoryDiscovery.js';
export * from './utils/gitIgnoreParser.js';
export * from './utils/editor.js';
export * from './utils/fileUtils.js';

// Export services
export * from './services/fileDiscoveryService.js';
export * from './services/gitService.js';

// Export base tool definitions
export { Tool, BaseTool, ToolResult, ToolResultDisplay, FileDiff } from './tools/tools.js';
export * from './tools/tool-registry.js';

// Export specific tool logic
export * from './tools/read-file.js';
export * from './tools/ls.js';
export * from './tools/grep.js';
export * from './tools/glob.js';
export * from './tools/edit.js';
export * from './tools/write-file.js';
export * from './tools/web-fetch.js';
export * from './tools/memoryTool.js';
export * from './tools/shell.js';
export * from './tools/read-many-files.js';
export * from './tools/mcp-client.js';
export * from './tools/mcp-tool.js';


// Session ID utility
export const sessionId = () => Math.random().toString(36).substring(2, 15);
