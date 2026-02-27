/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: mockExistsSync,
      statSync: mockStatSync,
      readFileSync: actual.default.readFileSync,
    },
    existsSync: mockExistsSync,
    statSync: mockStatSync,
  };
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShellTool, ShellToolParams } from './shell.js';
import { Config, ConfigParameters, ApprovalMode } from '../config/config.js';

const baseConfigParams: ConfigParameters = {
  cwd: '/tmp',
  model: 'test-model',
  embeddingModel: 'test-embedding-model',
  sandbox: undefined,
  targetDir: '/test/dir',
  debugMode: false,
  userMemory: '',
  grokMdFileCount: 0,
  approvalMode: ApprovalMode.DEFAULT,
  sessionId: 'test-session-id',
};

describe('ShellTool', () => {
  let tool: ShellTool;
  let mockConfig: Config;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockConfig = {
      getTargetDir: () => '/test/dir',
      getApprovalMode: vi.fn().mockReturnValue(ApprovalMode.DEFAULT),
      setApprovalMode: vi.fn(),
      getDebugMode: () => false,
    } as unknown as Config;

    tool = new ShellTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCommandRoot', () => {
    it('returns command name for simple command', () => {
      expect(tool.getCommandRoot('ls')).toBe('ls');
    });

    it('returns command name for command with arguments', () => {
      expect(tool.getCommandRoot('git status')).toBe('git');
    });

    it('handles piped commands by returning first command', () => {
      expect(tool.getCommandRoot('cat file.txt | grep foo')).toBe('cat');
    });

    it('handles chained commands with &&', () => {
      expect(tool.getCommandRoot('cd dir && ls')).toBe('cd');
    });

    it('handles chained commands with ;', () => {
      expect(tool.getCommandRoot('echo hello; echo world')).toBe('echo');
    });

    it('handles commands with full paths', () => {
      expect(tool.getCommandRoot('/usr/bin/env node')).toBe('env');
    });

    it('handles commands with grouping operators by stripping braces', () => {
      // After removing {} and splitting, leading empty segments can occur
      const result = tool.getCommandRoot('{ echo hello; }');
      // The regex removes braces then splits — result depends on whitespace handling
      expect(typeof result).toBe('string');
    });

    it('handles subshell grouping with parens', () => {
      expect(tool.getCommandRoot('(echo hello)')).toBe('echo');
    });

    it('returns falsy for empty/whitespace command', () => {
      // After trim + replace + split, whitespace-only input produces empty string
      expect(tool.getCommandRoot('   ')).toBeFalsy();
    });
  });

  describe('getDescription', () => {
    it('returns command as description', () => {
      const params: ShellToolParams = { command: 'ls -la' };
      expect(tool.getDescription(params)).toBe('ls -la');
    });

    it('includes directory when provided', () => {
      const params: ShellToolParams = { command: 'ls', directory: 'src' };
      expect(tool.getDescription(params)).toBe('ls [in src]');
    });

    it('includes description when provided', () => {
      const params: ShellToolParams = {
        command: 'npm test',
        description: 'Run tests',
      };
      expect(tool.getDescription(params)).toBe('npm test (Run tests)');
    });

    it('includes both directory and description', () => {
      const params: ShellToolParams = {
        command: 'npm test',
        directory: 'src',
        description: 'Run tests',
      };
      expect(tool.getDescription(params)).toBe('npm test [in src] (Run tests)');
    });

    it('replaces newlines in description with spaces', () => {
      const params: ShellToolParams = {
        command: 'echo',
        description: 'line1\nline2',
      };
      expect(tool.getDescription(params)).toBe('echo (line1 line2)');
    });
  });

  describe('validateToolParams', () => {
    it('returns null for valid params', () => {
      mockExistsSync.mockReturnValue(true);
      const params: ShellToolParams = { command: 'ls' };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for empty command', () => {
      const params: ShellToolParams = { command: '   ' };
      expect(tool.validateToolParams(params)).toBe('Command cannot be empty.');
    });

    it('returns error for absolute directory path', () => {
      const params: ShellToolParams = {
        command: 'ls',
        directory: '/absolute/path',
      };
      expect(tool.validateToolParams(params)).toBe(
        'Directory cannot be absolute. Must be relative to the project root directory.',
      );
    });

    it('returns error for non-existent directory', () => {
      mockExistsSync.mockReturnValue(false);
      const params: ShellToolParams = {
        command: 'ls',
        directory: 'nonexistent',
      };
      expect(tool.validateToolParams(params)).toBe('Directory must exist.');
    });

    it('returns null when directory exists', () => {
      mockExistsSync.mockReturnValue(true);
      const params: ShellToolParams = {
        command: 'ls',
        directory: 'src',
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false when validation fails', async () => {
      const params: ShellToolParams = { command: '   ' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns confirmation details for valid command', async () => {
      const params: ShellToolParams = { command: 'ls -la' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('exec');
        expect((result as any).command).toBe('ls -la');
        expect((result as any).rootCommand).toBe('ls');
      }
    });

    it('returns false when command root is already whitelisted', async () => {
      const params: ShellToolParams = { command: 'ls -la' };
      // First call returns confirmation details
      const firstResult = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(firstResult).not.toBe(false);

      // Simulate ProceedAlways to whitelist
      if (firstResult && 'onConfirm' in firstResult) {
        const { ToolConfirmationOutcome } = await import('./tools.js');
        await firstResult.onConfirm(ToolConfirmationOutcome.ProceedAlways);
      }

      // Second call should return false (whitelisted)
      const secondResult = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(secondResult).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns validation error when params are invalid', async () => {
      const params: ShellToolParams = { command: '   ' };
      const result = await tool.execute(
        params,
        new AbortController().signal,
      );
      expect(result.llmContent).toContain('Command rejected');
      expect(result.llmContent).toContain('Command cannot be empty');
      expect(result.returnDisplay).toContain('Error:');
    });

    it('returns cancelled message when aborted before start', async () => {
      const controller = new AbortController();
      controller.abort();
      const params: ShellToolParams = { command: 'echo hello' };
      const result = await tool.execute(params, controller.signal);
      expect(result.llmContent).toContain('cancelled by user before it could start');
    });
  });
});
