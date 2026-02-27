/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('fs', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  };
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatchTool, PatchToolParams } from './patch.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('PatchTool', () => {
  let tool: PatchTool;
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

    tool = new PatchTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolParams', () => {
    it('returns null for valid patch text', () => {
      const params: PatchToolParams = {
        patch: '--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n line1\n-line2\n+line2modified\n line3',
      };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for empty patch', () => {
      const params: PatchToolParams = { patch: '' };
      expect(tool.validateToolParams(params)).toContain('non-empty string');
    });

    it('returns error for whitespace-only patch', () => {
      const params: PatchToolParams = { patch: '   ' };
      expect(tool.validateToolParams(params)).toContain('non-empty string');
    });
  });

  describe('getDescription', () => {
    it('extracts filename from patch header', () => {
      const params: PatchToolParams = {
        patch: '--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1 +1 @@\n-old\n+new',
      };
      const desc = tool.getDescription(params);
      expect(desc).toContain('src/main.ts');
    });

    it('returns fallback for patch without header', () => {
      const params: PatchToolParams = { patch: 'some random text' };
      expect(tool.getDescription(params)).toBe('Apply unified diff patch');
    });
  });

  describe('execute', () => {
    it('returns error when validation fails', async () => {
      const params: PatchToolParams = { patch: '' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error:');
    });

    it('returns error when patch cannot be parsed', async () => {
      const params: PatchToolParams = { patch: 'not a valid patch' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Could not parse any patches');
    });

    it('applies a single-hunk patch successfully', async () => {
      const originalContent = 'line1\nline2\nline3\n';
      mockReadFileSync.mockReturnValue(originalContent);
      mockExistsSync.mockReturnValue(true);
      mockWriteFileSync.mockImplementation(() => {});

      const params: PatchToolParams = {
        patch: [
          '--- a/file.txt',
          '+++ b/file.txt',
          '@@ -1,3 +1,3 @@',
          ' line1',
          '-line2',
          '+line2modified',
          ' line3',
        ].join('\n'),
      };

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Patched: file.txt');
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('line2modified');
      expect(writtenContent).not.toContain('line2\n');
    });

    it('applies a multi-hunk patch successfully', async () => {
      const originalContent = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n';
      mockReadFileSync.mockReturnValue(originalContent);
      mockExistsSync.mockReturnValue(true);
      mockWriteFileSync.mockImplementation(() => {});

      const params: PatchToolParams = {
        patch: [
          '--- a/file.txt',
          '+++ b/file.txt',
          '@@ -1,3 +1,3 @@',
          ' a',
          '-b',
          '+B',
          ' c',
          '@@ -8,3 +8,3 @@',
          ' h',
          '-i',
          '+I',
          ' j',
        ].join('\n'),
      };

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Patched: file.txt');

      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('B');
      expect(writtenContent).toContain('I');
    });

    it('handles new file creation from /dev/null', async () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p.includes('newfile')) return false;
        return true;
      });
      mockWriteFileSync.mockImplementation(() => {});

      const params: PatchToolParams = {
        patch: [
          '--- /dev/null',
          '+++ b/newfile.txt',
          '@@ -0,0 +1,3 @@',
          '+line1',
          '+line2',
          '+line3',
        ].join('\n'),
      };

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Patched: newfile.txt');
      expect(mockWriteFileSync).toHaveBeenCalled();

      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('line1');
      expect(writtenContent).toContain('line2');
      expect(writtenContent).toContain('line3');
    });

    it('handles file read errors gracefully', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      mockExistsSync.mockReturnValue(true);

      const params: PatchToolParams = {
        patch: [
          '--- a/file.txt',
          '+++ b/file.txt',
          '@@ -1,1 +1,1 @@',
          '-old',
          '+new',
        ].join('\n'),
      };

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Failed to patch');
      expect(result.llmContent).toContain('Permission denied');
    });

    it('applies patches to multiple files', async () => {
      mockReadFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes('a.txt')) return 'aaa\n';
        if (filePath.includes('b.txt')) return 'bbb\n';
        return '';
      });
      mockExistsSync.mockReturnValue(true);
      mockWriteFileSync.mockImplementation(() => {});

      const params: PatchToolParams = {
        patch: [
          '--- a/a.txt',
          '+++ b/a.txt',
          '@@ -1,1 +1,1 @@',
          '-aaa',
          '+AAA',
          '--- a/b.txt',
          '+++ b/b.txt',
          '@@ -1,1 +1,1 @@',
          '-bbb',
          '+BBB',
        ].join('\n'),
      };

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Patched: a.txt');
      expect(result.llmContent).toContain('Patched: b.txt');
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false in AUTO_EDIT mode', async () => {
      (mockConfig.getApprovalMode as any).mockReturnValue(ApprovalMode.AUTO_EDIT);
      const params: PatchToolParams = {
        patch: '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns false in YOLO mode', async () => {
      (mockConfig.getApprovalMode as any).mockReturnValue(ApprovalMode.YOLO);
      const params: PatchToolParams = {
        patch: '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns confirmation details for valid patch in DEFAULT mode', async () => {
      const params: PatchToolParams = {
        patch: '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new',
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('edit');
        expect((result as any).fileName).toBe('file.txt');
      }
    });

    it('returns false when patch is invalid', async () => {
      const params: PatchToolParams = { patch: '' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });
  });
});
