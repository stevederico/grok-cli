/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockReaddirSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: {
      ...actual.default,
      readdirSync: mockReaddirSync,
      statSync: mockStatSync,
    },
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
  };
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LSTool, LSToolParams } from './ls.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('LSTool', () => {
  let tool: LSTool;
  let mockConfig: Config;
  let mockFileService: any;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockFileService = {
      filterFiles: vi.fn((paths: string[]) => paths),
      shouldGitIgnoreFile: vi.fn().mockReturnValue(false),
    };

    mockConfig = {
      getTargetDir: () => '/test/dir',
      getApprovalMode: vi.fn().mockReturnValue(ApprovalMode.DEFAULT),
      setApprovalMode: vi.fn(),
      getDebugMode: () => false,
      getFileFilteringRespectGitIgnore: vi.fn().mockReturnValue(false),
      getFileService: vi.fn().mockReturnValue(mockFileService),
    } as unknown as Config;

    tool = new LSTool('/test/dir', mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolParams', () => {
    it('returns null for valid absolute path within root', () => {
      const params: LSToolParams = { path: '/test/dir/src' };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for relative path', () => {
      const params: LSToolParams = { path: 'relative/path' };
      const result = tool.validateToolParams(params);
      expect(result).toContain('Path must be absolute');
    });

    it('returns error for path outside root directory', () => {
      const params: LSToolParams = { path: '/other/dir' };
      const result = tool.validateToolParams(params);
      expect(result).toContain('Path must be within the root directory');
    });

    it('accepts the root directory itself', () => {
      const params: LSToolParams = { path: '/test/dir' };
      expect(tool.validateToolParams(params)).toBeNull();
    });
  });

  describe('getDescription', () => {
    it('returns shortened path', () => {
      const params: LSToolParams = { path: '/test/dir/src' };
      const desc = tool.getDescription(params);
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    it('returns validation error for invalid params', async () => {
      const params: LSToolParams = { path: 'relative' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error: Invalid parameters');
    });

    it('returns error when path is not a directory', async () => {
      mockStatSync.mockReturnValue({
        isDirectory: () => false,
      });

      const params: LSToolParams = { path: '/test/dir/file.txt' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('not a directory');
    });

    it('returns empty directory message', async () => {
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockReaddirSync.mockReturnValue([]);

      const params: LSToolParams = { path: '/test/dir' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('empty');
    });

    it('lists directory contents sorted (dirs first, then alphabetical)', async () => {
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath === '/test/dir') {
          return { isDirectory: () => true };
        }
        if (fullPath === '/test/dir/src') {
          return { isDirectory: () => true, size: 0, mtime: new Date() };
        }
        if (fullPath === '/test/dir/README.md') {
          return { isDirectory: () => false, size: 1024, mtime: new Date() };
        }
        if (fullPath === '/test/dir/package.json') {
          return { isDirectory: () => false, size: 500, mtime: new Date() };
        }
        return { isDirectory: () => false, size: 0, mtime: new Date() };
      });
      mockReaddirSync.mockReturnValue(['README.md', 'src', 'package.json']);

      const params: LSToolParams = { path: '/test/dir' };
      const result = await tool.execute(params, new AbortController().signal);

      expect(result.llmContent).toContain('Directory listing');
      expect(result.llmContent).toContain('[DIR] src');
      expect(result.llmContent).toContain('README.md');
      expect(result.llmContent).toContain('package.json');

      // Directories should come first
      const content = result.llmContent as string;
      const dirIndex = content.indexOf('[DIR] src');
      const readmeIndex = content.indexOf('README.md');
      expect(dirIndex).toBeLessThan(readmeIndex);
    });

    it('handles file stat errors gracefully', async () => {
      mockStatSync.mockImplementation((fullPath: string) => {
        if (fullPath === '/test/dir') {
          return { isDirectory: () => true };
        }
        if (fullPath === '/test/dir/bad-file') {
          throw new Error('Permission denied');
        }
        return { isDirectory: () => false, size: 100, mtime: new Date() };
      });
      mockReaddirSync.mockReturnValue(['bad-file', 'good.txt']);

      const params: LSToolParams = { path: '/test/dir' };
      const result = await tool.execute(params, new AbortController().signal);
      // Should still return a result with the accessible entries
      expect(result.llmContent).toContain('Directory listing');
    });

    it('handles fs.statSync throwing for the directory itself', async () => {
      mockStatSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const params: LSToolParams = { path: '/test/dir' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error listing directory');
    });
  });
});
