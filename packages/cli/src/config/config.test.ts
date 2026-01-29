/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { loadCliConfig } from './config.js';
import { Settings } from './settings.js';
import { Extension } from './extension.js';
import * as ServerConfig from '../core/index.js';

vi.mock('os', async (importOriginal) => {
  const actualOs = await importOriginal<typeof os>();
  return {
    ...actualOs,
    homedir: vi.fn(() => '/mock/home/user'),
  };
});

vi.mock('open', () => ({
  default: vi.fn(),
}));

vi.mock('read-package-up', () => ({
  readPackageUp: vi.fn(() =>
    Promise.resolve({ packageJson: { version: 'test-version' } }),
  ),
}));

vi.mock('@grok-cli/core', async () => {
  const actualServer = await vi.importActual<typeof ServerConfig>(
    '@grok-cli/core',
  );
  return {
    ...actualServer,
    loadEnvironment: vi.fn(),
    loadServerHierarchicalMemory: vi.fn(
      (cwd, debug, fileService, extensionPaths) =>
        Promise.resolve({
          memoryContent: extensionPaths?.join(',') || '',
          fileCount: extensionPaths?.length || 0,
        }),
    ),
  };
});

describe('loadCliConfig', () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should set showMemoryUsage to true when --memory flag is present', async () => {
    process.argv = ['node', 'script.js', '--show_memory_usage'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(true);
  });

  it('should set showMemoryUsage to false when --memory flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(false);
  });

  it('should set showMemoryUsage to false by default from settings if CLI flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { showMemoryUsage: false };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(false);
  });

  it('should prioritize CLI flag over settings for showMemoryUsage (CLI true, settings false)', async () => {
    process.argv = ['node', 'script.js', '--show_memory_usage'];
    const settings: Settings = { showMemoryUsage: false };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(true);
  });
});


describe('Hierarchical Memory Loading (config.ts) - Placeholder Suite', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
    // Other common mocks would be reset here.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass extension context file paths to loadServerHierarchicalMemory', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {};
    const extensions: Extension[] = [
      {
        config: {
          name: 'ext1',
          version: '1.0.0',
        },
        contextFiles: ['/path/to/ext1/GROKCLI.md'],
      },
      {
        config: {
          name: 'ext2',
          version: '1.0.0',
        },
        contextFiles: [],
      },
      {
        config: {
          name: 'ext3',
          version: '1.0.0',
        },
        contextFiles: [
          '/path/to/ext3/context1.md',
          '/path/to/ext3/context2.md',
        ],
      },
    ];
    await loadCliConfig(settings, extensions, 'session-id');
    expect(ServerConfig.loadServerHierarchicalMemory).toHaveBeenCalledWith(
      expect.any(String),
      false,
      expect.any(Object),
      [
        '/path/to/ext1/GROKCLI.md',
        '/path/to/ext3/context1.md',
        '/path/to/ext3/context2.md',
      ],
    );
  });

  // NOTE TO FUTURE DEVELOPERS:
  // To re-enable tests for loadHierarchicalGrokMemory, ensure that:
  // 1. os.homedir() is reliably mocked *before* the config.ts module is loaded
  //    and its functions (which use os.homedir()) are called.
  // 2. fs/promises and fs mocks correctly simulate file/directory existence,
  //    readability, and content based on paths derived from the mocked os.homedir().
  // 3. Spies on console functions (for logger output) are correctly set up if needed.
  // Example of a previously failing test structure:
  /*
  it('should correctly use mocked homedir for global path', async () => {
    const MOCK_GROK_DIR_LOCAL = path.join('/mock/home/user', '.grokcli');
    const MOCK_GLOBAL_PATH_LOCAL = path.join(MOCK_GROK_DIR_LOCAL, 'GROKCLI.md');
    mockFs({
      [MOCK_GLOBAL_PATH_LOCAL]: { type: 'file', content: 'GlobalContentOnly' }
    });
    const memory = await loadHierarchicalGrokMemory("/some/other/cwd", false);
    expect(memory).toBe('GlobalContentOnly');
    expect(vi.mocked(os.homedir)).toHaveBeenCalled();
    expect(fsPromises.readFile).toHaveBeenCalledWith(MOCK_GLOBAL_PATH_LOCAL, 'utf-8');
  });
  */
});

describe('mergeMcpServers', () => {
  it('should not modify the original settings object', async () => {
    const settings: Settings = {
      mcpServers: {
        'test-server': {
          url: 'http://localhost:8080',
        },
      },
    };
    const extensions: Extension[] = [
      {
        config: {
          name: 'ext1',
          version: '1.0.0',
          mcpServers: {
            'ext1-server': {
              url: 'http://localhost:8081',
            },
          },
        },
        contextFiles: [],
      },
    ];
    const originalSettings = JSON.parse(JSON.stringify(settings));
    await loadCliConfig(settings, extensions, 'test-session');
    expect(settings).toEqual(originalSettings);
  });
});
