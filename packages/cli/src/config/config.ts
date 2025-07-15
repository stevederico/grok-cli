/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import {
  Config,
  loadServerHierarchicalMemory,
  setGeminiMdFilename as setServerGeminiMdFilename,
  getCurrentGeminiMdFilename,
  ApprovalMode,
  GROKCLI_CONFIG_DIR as GROKCLI_DIR,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  FileDiscoveryService,
} from '../core/index.js';
import { Settings } from './settings.js';

import { Extension } from './extension.js';
import { getCliVersion } from '../utils/version.js';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSandboxConfig } from './sandboxConfig.js';

// Simple console logger for now - replace with actual logger if available
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

interface CliArgs {
  model: string | undefined;
  provider: string | undefined;
  sandbox: boolean | string | undefined;
  'sandbox-image': string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  all_files: boolean | undefined;
  show_memory_usage: boolean | undefined;
  yolo: boolean | undefined;
  checkpointing: boolean | undefined;
}

async function parseArguments(): Promise<CliArgs> {
  // Get provider first to determine default model
  const provider = process.env.GROKCLI_PROVIDER || 'xai';
  let defaultModel = 'llama3.2:latest';
  
  // Set provider-specific default models
  if (provider === 'ollama') {
    defaultModel = process.env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
  } else if (provider === 'xai') {
    defaultModel = process.env.XAI_MODEL || 'grok-4-0709';
  }

  const argv = await yargs(hideBin(process.argv))
    .option('model', {
      alias: 'm',
      type: 'string',
      description: `Model`,
      default: defaultModel,
    })
    .option('provider', {
      type: 'string',
      description: 'LLM Provider (xai, ollama)',
      default: provider,
    })
    .option('prompt', {
      alias: 'p',
      type: 'string',
      description: 'Prompt. Appended to input on stdin (if any).',
    })
    .option('sandbox', {
      alias: 's',
      type: 'boolean',
      description: 'Run in sandbox?',
    })
    .option('sandbox-image', {
      type: 'string',
      description: 'Sandbox image URI.',
    })
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      description: 'Run in debug mode?',
      default: false,
    })
    .option('all_files', {
      alias: 'a',
      type: 'boolean',
      description: 'Include ALL files in context?',
      default: false,
    })
    .option('show_memory_usage', {
      type: 'boolean',
      description: 'Show memory usage in status bar',
      default: false,
    })
    .option('yolo', {
      alias: 'y',
      type: 'boolean',
      description:
        'Automatically accept all actions (aka YOLO mode, see https://www.youtube.com/watch?v=xvFZjo5PgG0 for more details)?',
      default: false,
    })
    .option('checkpointing', {
      alias: 'c',
      type: 'boolean',
      description: 'Enables checkpointing of file edits',
      default: false,
    })
    .version(await getCliVersion()) // This will enable the --version flag based on package.json
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .strict().argv;

  return argv;
}

// This function is now a thin wrapper around the server's implementation.
// It's kept in the CLI for now as App.tsx directly calls it for memory refresh.
// TODO: Consider if App.tsx should get memory via a server call or if Config should refresh itself.
export async function loadHierarchicalMemory(
  currentWorkingDirectory: string,
  debugMode: boolean,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
): Promise<{ memoryContent: string; fileCount: number }> {
  if (debugMode) {
    logger.debug(
      `CLI: Delegating hierarchical memory load to server for CWD: ${currentWorkingDirectory}`,
    );
  }
  // Directly call the server function.
  // The server function will use its own homedir() for the global path.
  return loadServerHierarchicalMemory(
    currentWorkingDirectory,
    debugMode,
    fileService,
    extensionContextFilePaths,
  );
}

// Legacy export for backward compatibility
export const loadHierarchicalGeminiMemory = loadHierarchicalMemory;

export async function loadCliConfig(
  settings: Settings,
  extensions: Extension[],
  sessionId: string,
): Promise<Config> {
  loadEnvironment();

  const argv = await parseArguments();
  const debugMode = argv.debug || false;
  
  if (debugMode) {
    logger.debug(`Config - argv.prompt: '${argv.prompt}', type: ${typeof argv.prompt}`);
    logger.debug(`Config - 'prompt' in argv:`, 'prompt' in argv);
    logger.debug(`Config - argv.hasOwnProperty('prompt'):`, argv.hasOwnProperty('prompt'));
    logger.debug(`Config - Object.keys(argv):`, Object.keys(argv));
  }

  // Set the context filename in the server's memoryTool module BEFORE loading memory
  // TODO(b/343434939): This is a bit of a hack. The contextFileName should ideally be passed
  // directly to the Config constructor in core, and have core handle setGeminiMdFilename.
  // However, loadHierarchicalGeminiMemory is called *before* createServerConfig.
  if (settings.contextFileName) {
    setServerGeminiMdFilename(settings.contextFileName);
  } else {
    // Reset to default if not provided in settings.
    setServerGeminiMdFilename(getCurrentGeminiMdFilename());
  }

  const extensionContextFilePaths = extensions.flatMap((e) => e.contextFiles);

  const fileService = new FileDiscoveryService(process.cwd());
  // Call the (now wrapper) loadHierarchicalMemory which calls the server's version
  const { memoryContent, fileCount } = await loadHierarchicalMemory(
    process.cwd(),
    debugMode,
    fileService,
    extensionContextFilePaths,
  );

  const mcpServers = mergeMcpServers(settings, extensions);

  const sandboxConfig = await loadSandboxConfig(settings, argv);

  const question = (argv.prompt && argv.prompt !== 'undefined' && typeof argv.prompt === 'string') ? argv.prompt : undefined;
  if (debugMode) {
    logger.debug(`Config - setting question: '${question}', type: ${typeof question}`);
  }
  
  const configInstance = new Config({
    sessionId,
    embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
    sandbox: sandboxConfig,
    targetDir: process.cwd(),
    debugMode,
    question,
    fullContext: argv.all_files || false,
    coreTools: settings.coreTools || undefined,
    excludeTools: settings.excludeTools || undefined,
    toolDiscoveryCommand: settings.toolDiscoveryCommand,
    toolCallCommand: settings.toolCallCommand,
    mcpServerCommand: settings.mcpServerCommand,
    mcpServers,
    userMemory: memoryContent,
    geminiMdFileCount: fileCount,
    approvalMode: argv.yolo || false ? ApprovalMode.YOLO : ApprovalMode.DEFAULT,
    showMemoryUsage:
      argv.show_memory_usage || settings.showMemoryUsage || false,
    accessibility: settings.accessibility,
    // Git-aware file filtering settings
    fileFiltering: {
      respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
      enableRecursiveFileSearch:
        settings.fileFiltering?.enableRecursiveFileSearch,
    },
    checkpointing: argv.checkpointing || settings.checkpointing?.enabled,
    proxy:
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy,
    cwd: process.cwd(),
    fileDiscoveryService: fileService,
    bugCommand: settings.bugCommand,
    model: argv.model!,
    provider: argv.provider!,
    extensionContextFilePaths,
  });
  
  // Initialize the tool registry for non-Google providers
  // For Google providers, this would normally be done after auth selection
  // But since we're using alternative providers, we can initialize immediately
  await configInstance.refreshAuth('none' as any);
  
  return configInstance;
}

function mergeMcpServers(settings: Settings, extensions: Extension[]) {
  const mcpServers = { ...(settings.mcpServers || {}) };
  for (const extension of extensions) {
    Object.entries(extension.config.mcpServers || {}).forEach(
      ([key, server]) => {
        if (mcpServers[key]) {
          logger.warn(
            `Skipping extension MCP config for server with key "${key}" as it already exists.`,
          );
          return;
        }
        mcpServers[key] = server;
      },
    );
  }
  return mcpServers;
}
function findEnvFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    // prefer grok-cli-specific .env under GROKCLI_DIR
    const grokcliEnvPath = path.join(currentDir, GROKCLI_DIR, '.env');
    if (fs.existsSync(grokcliEnvPath)) {
      return grokcliEnvPath;
    }
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir || !parentDir) {
      // check .env under home as fallback, again preferring grok-cli-specific .env
      const homeGrokcliEnvPath = path.join(os.homedir(), GROKCLI_DIR, '.env');
      if (fs.existsSync(homeGrokcliEnvPath)) {
        return homeGrokcliEnvPath;
      }
      const homeEnvPath = path.join(os.homedir(), '.env');
      if (fs.existsSync(homeEnvPath)) {
        return homeEnvPath;
      }
      return null;
    }
    currentDir = parentDir;
  }
}

export function loadEnvironment(): void {
  const envFilePath = findEnvFile(process.cwd());
  if (envFilePath) {
    dotenv.config({ path: envFilePath });
  }
  
  // Remove key validation for multi-provider support
}
