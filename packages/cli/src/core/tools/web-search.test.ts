/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFetchWithTimeout = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetch.js', () => ({
  fetchWithTimeout: mockFetchWithTimeout,
}));

vi.mock('html-to-text', () => ({
  convert: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSearchTool, WebSearchToolParams } from './web-search.js';
import { Config, ApprovalMode } from '../config/config.js';

describe('WebSearchTool', () => {
  let tool: WebSearchTool;
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

    tool = new WebSearchTool(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateParams', () => {
    it('returns null for valid query', () => {
      const params: WebSearchToolParams = { query: 'vitest testing' };
      expect(tool.validateParams(params)).toBeNull();
    });

    it('returns error for empty query', () => {
      const params: WebSearchToolParams = { query: '' };
      const result = tool.validateParams(params);
      expect(result).toContain("'query' parameter cannot be empty");
    });

    it('returns error for whitespace-only query', () => {
      const params: WebSearchToolParams = { query: '   ' };
      const result = tool.validateParams(params);
      expect(result).toContain("'query' parameter cannot be empty");
    });
  });

  describe('getDescription', () => {
    it('returns description with query', () => {
      const params: WebSearchToolParams = { query: 'vitest docs' };
      const desc = tool.getDescription(params);
      expect(desc).toContain('vitest docs');
    });
  });

  describe('execute', () => {
    it('returns validation error for invalid params', async () => {
      const params: WebSearchToolParams = { query: '' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error:');
    });

    it('parses DuckDuckGo results successfully', async () => {
      const ddgHtml = `
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Example Title</a>
          <a class="result__snippet">This is a snippet about the result.</a>
        </div>
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fother.com">Other Title</a>
          <a class="result__snippet">Another snippet here.</a>
        </div>
      `;

      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(ddgHtml),
        status: 200,
        statusText: 'OK',
      });

      const params: WebSearchToolParams = { query: 'example search' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Web search results');
      expect(result.llmContent).toContain('Example Title');
      expect(result.llmContent).toContain('https://example.com');
      expect(result.returnDisplay).toContain('Found');
    });

    it('returns empty results message when no results found', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>No results</body></html>'),
        status: 200,
        statusText: 'OK',
      });

      const params: WebSearchToolParams = { query: 'xyznonexistent123' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('No results found');
    });

    it('handles HTTP errors', async () => {
      mockFetchWithTimeout.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const params: WebSearchToolParams = { query: 'test query' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error');
      expect(result.llmContent).toContain('503');
    });

    it('handles network/fetch errors', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Network error'));

      const params: WebSearchToolParams = { query: 'test query' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error performing web search');
      expect(result.llmContent).toContain('Network error');
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false in AUTO_EDIT mode', async () => {
      (mockConfig.getApprovalMode as any).mockReturnValue(ApprovalMode.AUTO_EDIT);
      const params: WebSearchToolParams = { query: 'test' };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).toBe(false);
    });

    it('returns false when validation fails', async () => {
      const params: WebSearchToolParams = { query: '' };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).toBe(false);
    });

    it('returns confirmation details for valid params', async () => {
      const params: WebSearchToolParams = { query: 'vitest docs' };
      const result = await tool.shouldConfirmExecute(params);
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('info');
        expect((result as any).urls).toBeDefined();
        expect((result as any).urls[0]).toContain('duckduckgo.com');
      }
    });
  });
});
