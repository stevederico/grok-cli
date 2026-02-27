/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockLstatSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: mockExistsSync,
      lstatSync: mockLstatSync,
      readFileSync: mockReadFileSync,
      writeFileSync: mockWriteFileSync,
      mkdirSync: mockMkdirSync,
    },
    existsSync: mockExistsSync,
    lstatSync: mockLstatSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  };
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WriteFileTool, WriteFileToolParams } from './write-file.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
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

    tool = new WriteFileTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolParams', () => {
    it('returns null for valid absolute path within root', () => {
      mockExistsSync.mockReturnValue(false);
      const params: WriteFileToolParams = {
        file_path: '/test/dir/file.txt',
        content: 'hello',
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for relative path', () => {
      const params: WriteFileToolParams = {
        file_path: 'relative/file.txt',
        content: 'hello',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('File path must be absolute');
    });

    it('returns error for path outside root directory', () => {
      const params: WriteFileToolParams = {
        file_path: '/other/dir/file.txt',
        content: 'hello',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('File path must be within the root directory');
    });

    it('returns error when path is a directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockLstatSync.mockReturnValue({ isDirectory: () => true });
      const params: WriteFileToolParams = {
        file_path: '/test/dir/subdir',
        content: 'hello',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('Path is a directory, not a file');
    });

    it('returns null for new file (does not exist)', () => {
      mockExistsSync.mockReturnValue(false);
      const params: WriteFileToolParams = {
        file_path: '/test/dir/newfile.txt',
        content: 'hello',
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns null for existing file that is not a directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockLstatSync.mockReturnValue({ isDirectory: () => false });
      const params: WriteFileToolParams = {
        file_path: '/test/dir/existing.txt',
        content: 'hello',
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });
  });

  describe('getDescription', () => {
    it('returns description with shortened path', () => {
      const params: WriteFileToolParams = {
        file_path: '/test/dir/src/app.js',
        content: 'code',
      };
      const desc = tool.getDescription(params);
      expect(desc).toContain('Writing to');
    });

    it('returns fallback when params are missing', () => {
      const params = { file_path: '', content: '' } as WriteFileToolParams;
      const desc = tool.getDescription(params);
      expect(desc).toContain('Model did not provide valid parameters');
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false when approval mode is AUTO_EDIT', async () => {
      (mockConfig.getApprovalMode as any).mockReturnValue(
        ApprovalMode.AUTO_EDIT,
      );
      const params: WriteFileToolParams = {
        file_path: '/test/dir/file.txt',
        content: 'hello',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns false when validation fails', async () => {
      const params: WriteFileToolParams = {
        file_path: 'relative.txt',
        content: 'hello',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns confirmation details with diff for valid params', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileSync.mockImplementation(() => {
        const err: any = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });

      const params: WriteFileToolParams = {
        file_path: '/test/dir/newfile.txt',
        content: 'new content',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('edit');
        expect((result as any).fileDiff).toBeDefined();
      }
    });
  });

  describe('execute', () => {
    it('returns error when validation fails', async () => {
      const params: WriteFileToolParams = {
        file_path: 'relative.txt',
        content: 'hello',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error: Invalid parameters');
    });

    it('creates new file successfully', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        // Parent dir exists, file does not
        if (p === '/test/dir') return true;
        if (p === '/test/dir/newfile.txt') return false;
        return true;
      });
      mockReadFileSync.mockImplementation(() => {
        const err: any = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      mockWriteFileSync.mockImplementation(() => {});

      const params: WriteFileToolParams = {
        file_path: '/test/dir/newfile.txt',
        content: 'hello world',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Successfully created and wrote to new file');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/test/dir/newfile.txt',
        'hello world',
        'utf8',
      );
    });

    it('overwrites existing file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockLstatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('old content');
      mockWriteFileSync.mockImplementation(() => {});

      const params: WriteFileToolParams = {
        file_path: '/test/dir/existing.txt',
        content: 'new content',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Successfully overwrote file');
    });

    it('creates parent directories with mkdir -p', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p === '/test/dir/deep/nested') return false;
        if (p === '/test/dir/deep/nested/file.txt') return false;
        return false;
      });
      mockReadFileSync.mockImplementation(() => {
        const err: any = new Error('ENOENT');
        err.code = 'ENOENT';
        throw err;
      });
      mockWriteFileSync.mockImplementation(() => {});
      mockMkdirSync.mockImplementation(() => {});

      const params: WriteFileToolParams = {
        file_path: '/test/dir/deep/nested/file.txt',
        content: 'content',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(mockMkdirSync).toHaveBeenCalledWith('/test/dir/deep/nested', {
        recursive: true,
      });
      expect(result.llmContent).toContain('Successfully created');
    });

    it('handles write errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockLstatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('old');
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const params: WriteFileToolParams = {
        file_path: '/test/dir/file.txt',
        content: 'new',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error writing to file');
    });
  });
});
