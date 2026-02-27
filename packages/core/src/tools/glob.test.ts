/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockGlob = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockStatSync = vi.hoisted(() => vi.fn());

vi.mock('glob', () => ({
  glob: mockGlob,
}));

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    default: {
      ...actual.default,
      existsSync: mockExistsSync,
      statSync: mockStatSync,
    },
    existsSync: mockExistsSync,
    statSync: mockStatSync,
  };
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GlobTool, GlobToolParams, GlobPath, sortFileEntries } from './glob.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('sortFileEntries', () => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  function makePath(fullpathVal: string, mtimeMs: number): GlobPath {
    return { fullpath: () => fullpathVal, mtimeMs };
  }

  it('sorts recent files newest first', () => {
    const entries: GlobPath[] = [
      makePath('/a.ts', now - 1000),
      makePath('/b.ts', now - 500),
      makePath('/c.ts', now - 2000),
    ];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted.map((e) => e.fullpath())).toEqual(['/b.ts', '/a.ts', '/c.ts']);
  });

  it('sorts old files alphabetically', () => {
    const oldTime = now - oneDayMs - 1000;
    const entries: GlobPath[] = [
      makePath('/z.ts', oldTime),
      makePath('/a.ts', oldTime - 100),
      makePath('/m.ts', oldTime - 50),
    ];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted.map((e) => e.fullpath())).toEqual(['/a.ts', '/m.ts', '/z.ts']);
  });

  it('puts recent files before old files', () => {
    const oldTime = now - oneDayMs - 1000;
    const entries: GlobPath[] = [
      makePath('/old.ts', oldTime),
      makePath('/recent.ts', now - 1000),
    ];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted[0].fullpath()).toBe('/recent.ts');
    expect(sorted[1].fullpath()).toBe('/old.ts');
  });

  it('handles entries without mtimeMs', () => {
    const entries: GlobPath[] = [
      { fullpath: () => '/b.ts', mtimeMs: undefined },
      { fullpath: () => '/a.ts', mtimeMs: undefined },
    ];
    const sorted = sortFileEntries(entries, now, oneDayMs);
    expect(sorted.map((e) => e.fullpath())).toEqual(['/a.ts', '/b.ts']);
  });
});

describe('GlobTool', () => {
  let tool: GlobTool;
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

    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isDirectory: () => true });

    tool = new GlobTool('/test/dir', mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolParams', () => {
    it('returns null for valid params', () => {
      const params: GlobToolParams = { pattern: '**/*.ts' };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for empty pattern', () => {
      const params: GlobToolParams = { pattern: '' };
      const result = tool.validateToolParams(params);
      expect(result).toContain("'pattern' parameter cannot be empty");
    });

    it('returns error for path outside root', () => {
      const params: GlobToolParams = {
        pattern: '*.ts',
        path: '/other/dir',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('resolves outside');
    });

    it('returns error when search path does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const params: GlobToolParams = {
        pattern: '*.ts',
        path: '/test/dir/nonexistent',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('does not exist');
    });

    it('returns error when search path is not a directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      const params: GlobToolParams = {
        pattern: '*.ts',
        path: '/test/dir/file.txt',
      };
      const result = tool.validateToolParams(params);
      expect(result).toContain('not a directory');
    });
  });

  describe('getDescription', () => {
    it('returns pattern as description', () => {
      const params: GlobToolParams = { pattern: '**/*.ts' };
      expect(tool.getDescription(params)).toContain('**/*.ts');
    });

    it('includes path when provided', () => {
      const params: GlobToolParams = { pattern: '*.ts', path: '/test/dir/src' };
      const desc = tool.getDescription(params);
      expect(desc).toContain('*.ts');
      expect(desc).toContain('within');
    });
  });

  describe('execute', () => {
    it('returns validation error for invalid params', async () => {
      const params: GlobToolParams = { pattern: '' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error: Invalid parameters');
    });

    it('returns no files found message when glob returns empty', async () => {
      mockGlob.mockResolvedValue([]);
      const params: GlobToolParams = { pattern: '**/*.xyz' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('No files found');
      expect(result.returnDisplay).toContain('No files found');
    });

    it('returns matching files sorted by recency', async () => {
      const now = Date.now();
      const mockEntries: GlobPath[] = [
        { fullpath: () => '/test/dir/old.ts', mtimeMs: now - 100000000 },
        { fullpath: () => '/test/dir/new.ts', mtimeMs: now - 100 },
      ];
      mockGlob.mockResolvedValue(mockEntries);

      const params: GlobToolParams = { pattern: '**/*.ts' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Found 2 file(s)');
      expect(result.llmContent).toContain('/test/dir/new.ts');
      expect(result.llmContent).toContain('/test/dir/old.ts');
      expect(result.returnDisplay).toContain('Found 2 matching file(s)');
    });

    it('handles glob errors gracefully', async () => {
      mockGlob.mockRejectedValue(new Error('Glob failed'));
      const params: GlobToolParams = { pattern: '**/*.ts' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error during glob search');
      expect(result.llmContent).toContain('Glob failed');
    });
  });
});
