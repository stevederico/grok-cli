/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFetchWithTimeout = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetch.js', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
  isPrivateIp: vi.fn().mockReturnValue(false),
}));

vi.mock('html-to-text', () => ({
  convert: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebFetchTool, WebFetchToolParams } from './web-fetch.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('WebFetchTool', () => {
  let tool: WebFetchTool;
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

    tool = new WebFetchTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateParams', () => {
    it('returns null for valid prompt with URL', () => {
      const params: WebFetchToolParams = {
        prompt: 'Get content from https://example.com',
      };
      expect(tool.validateParams(params)).toBeNull();
    });

    it('returns error for empty prompt', () => {
      const params: WebFetchToolParams = { prompt: '' };
      const result = tool.validateParams(params);
      expect(result).toContain("'prompt' parameter cannot be empty");
    });

    it('returns error for prompt without URL', () => {
      const params: WebFetchToolParams = { prompt: 'no url here' };
      const result = tool.validateParams(params);
      expect(result).toContain('must contain at least one valid URL');
    });

    it('accepts prompt with http:// URL', () => {
      const params: WebFetchToolParams = {
        prompt: 'Fetch http://example.com',
      };
      expect(tool.validateParams(params)).toBeNull();
    });
  });

  describe('getDescription', () => {
    it('returns description with prompt', () => {
      const params: WebFetchToolParams = {
        prompt: 'Get https://example.com',
      };
      const desc = tool.getDescription(params);
      expect(desc).toContain('Fetching content');
    });

    it('truncates long prompts', () => {
      const longPrompt = 'a'.repeat(200) + ' https://example.com';
      const params: WebFetchToolParams = { prompt: longPrompt };
      const desc = tool.getDescription(params);
      expect(desc).toContain('...');
    });
  });

  describe('execute', () => {
    it('returns validation error for invalid params', async () => {
      const params: WebFetchToolParams = { prompt: 'no url' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error: Invalid parameters');
    });

    it('fetches URL content successfully', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Hello World</body></html>'),
        status: 200,
        statusText: 'OK',
      });

      const params: WebFetchToolParams = {
        prompt: 'Fetch https://example.com',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Content from https://example.com');
      expect(result.returnDisplay).toContain('Fetched content from 1 URL(s)');
    });

    it('handles HTTP error responses', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const params: WebFetchToolParams = {
        prompt: 'Fetch https://example.com/missing',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error fetching');
      expect(result.llmContent).toContain('404');
    });

    it('handles fetch timeout/network errors', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Timeout'));

      const params: WebFetchToolParams = {
        prompt: 'Fetch https://example.com',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error fetching');
      expect(result.llmContent).toContain('Timeout');
    });

    it('converts GitHub blob URL to raw URL', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('raw content'),
        status: 200,
        statusText: 'OK',
      });

      const params: WebFetchToolParams = {
        prompt: 'Get https://github.com/user/repo/blob/main/file.md',
      };
      await tool.execute(params, new AbortController().signal);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/user/repo/main/file.md',
        expect.any(Number),
      );
    });

    it('fetches multiple URLs', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
        status: 200,
        statusText: 'OK',
      });

      const params: WebFetchToolParams = {
        prompt: 'Get https://example.com and https://other.com',
      };
      const result = await tool.execute(params, new AbortController().signal);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
      expect(result.returnDisplay).toContain('2 URL(s)');
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false in AUTO_EDIT mode', async () => {
      (mockConfig.getApprovalMode as any).mockReturnValue(ApprovalMode.AUTO_EDIT);
      const params: WebFetchToolParams = {
        prompt: 'Get https://example.com',
      };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).toBe(false);
    });

    it('returns false when validation fails', async () => {
      const params: WebFetchToolParams = { prompt: '' };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).toBe(false);
    });

    it('returns confirmation details for valid params', async () => {
      const params: WebFetchToolParams = {
        prompt: 'Get https://example.com',
      };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('info');
        expect((result as any).urls).toContain('https://example.com');
      }
    });
  });
});
