/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaProvider, createOllamaProvider } from './ollama.js';

const mockFetch = vi.hoisted(() => vi.fn());

describe('OllamaProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    global.fetch = mockFetch;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('uses default model and endpoint', () => {
      delete process.env.GROKCLI_OLLAMA_MODEL;
      delete process.env.GROKCLI_OLLAMA_ENDPOINT;
      const provider = new OllamaProvider();
      expect(provider.name).toBe('ollama');
    });

    it('uses env vars for model and endpoint', () => {
      process.env.GROKCLI_OLLAMA_MODEL = 'codellama';
      process.env.GROKCLI_OLLAMA_ENDPOINT = 'http://remote:11434';
      const provider = new OllamaProvider();
      expect(provider.name).toBe('ollama');
    });

    it('uses config over env vars', () => {
      process.env.GROKCLI_OLLAMA_MODEL = 'env-model';
      const provider = new OllamaProvider({ model: 'config-model', endpoint: 'http://custom:1234' });
      expect(provider.name).toBe('ollama');
    });
  });

  describe('isConfigured', () => {
    it('always returns true since Ollama is local', () => {
      const provider = new OllamaProvider();
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('query', () => {
    it('returns response content on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'Hello from Ollama' }),
      });

      const provider = new OllamaProvider();
      const result = await provider.query('hello');
      expect(result).toBe('Hello from Ollama');
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'ok' }),
      });

      const provider = new OllamaProvider({ model: 'codellama' });
      await provider.query('test prompt', { temperature: 0.5, maxTokens: 512 });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/generate');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('codellama');
      expect(body.prompt).toBe('test prompt');
      expect(body.stream).toBe(false);
      expect(body.options.temperature).toBe(0.5);
      expect(body.options.num_predict).toBe(512);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const provider = new OllamaProvider();
      await expect(provider.query('hello')).rejects.toThrow('Ollama query failed');
    });

    it('throws on connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      const provider = new OllamaProvider();
      await expect(provider.query('hello')).rejects.toThrow('Ollama query failed');
    });

    it('throws on unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'unexpected' }),
      });

      const provider = new OllamaProvider();
      await expect(provider.query('hello')).rejects.toThrow('Unexpected response format');
    });

    it('uses custom endpoint from config', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: 'ok' }),
      });

      const provider = new OllamaProvider({ endpoint: 'http://remote:11434' });
      await provider.query('hello');

      expect(mockFetch.mock.calls[0][0]).toBe('http://remote:11434/api/generate');
    });
  });

  describe('getModels', () => {
    it('returns model names on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:latest' }, { name: 'codellama:7b' }],
        }),
      });

      const provider = new OllamaProvider();
      const models = await provider.getModels();
      expect(models).toEqual(['llama3.2:latest', 'codellama:7b']);
    });

    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const provider = new OllamaProvider();
      await provider.getModels();

      expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:11434/api/tags');
    });

    it('returns empty array when no models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const provider = new OllamaProvider();
      const models = await provider.getModels();
      expect(models).toEqual([]);
    });

    it('throws on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const provider = new OllamaProvider();
      await expect(provider.getModels()).rejects.toThrow('Failed to fetch Ollama models');
    });
  });

  describe('queryWithToolsStreaming', () => {
    it('streams NDJSON chunks and accumulates content', async () => {
      const chunks = [
        JSON.stringify({ response: 'Hello' }) + '\n',
        JSON.stringify({ response: ' world' }) + '\n',
        JSON.stringify({ response: '', done: true }) + '\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            const encoder = new TextEncoder();
            return { done: false, value: encoder.encode(chunks[chunkIndex++]) };
          }
          return { done: true, value: undefined };
        }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const provider = new OllamaProvider({ model: 'llama3.2:latest' });
      const receivedChunks: any[] = [];
      const onChunk = vi.fn((chunk: any) => receivedChunks.push(chunk));

      const result = await provider.queryWithToolsStreaming('hello', [], {}, onChunk);

      expect(result.content).toBe('Hello world');
      expect(onChunk).toHaveBeenCalledWith({ type: 'content', content: 'Hello' });
      expect(onChunk).toHaveBeenCalledWith({ type: 'content', content: ' world' });
      expect(onChunk).toHaveBeenCalledWith({ type: 'done' });
    });

    it('throws when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const provider = new OllamaProvider();
      const onChunk = vi.fn();

      await expect(
        provider.queryWithToolsStreaming('hello', [], {}, onChunk),
      ).rejects.toThrow('Ollama streaming query failed');
    });

    it('throws when no response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const provider = new OllamaProvider();
      const onChunk = vi.fn();

      await expect(
        provider.queryWithToolsStreaming('hello', [], {}, onChunk),
      ).rejects.toThrow('No response body for streaming');
    });

    it('skips malformed NDJSON lines', async () => {
      const chunks = [
        'not-json\n' + JSON.stringify({ response: 'ok' }) + '\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (chunkIndex < chunks.length) {
            const encoder = new TextEncoder();
            return { done: false, value: encoder.encode(chunks[chunkIndex++]) };
          }
          return { done: true, value: undefined };
        }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const provider = new OllamaProvider();
      const onChunk = vi.fn();

      const result = await provider.queryWithToolsStreaming('hello', [], {}, onChunk);

      expect(result.content).toBe('ok');
      expect(onChunk).toHaveBeenCalledWith({ type: 'content', content: 'ok' });
    });
  });

  describe('createOllamaProvider', () => {
    it('returns an OllamaProvider instance', () => {
      const provider = createOllamaProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe('ollama');
    });
  });
});
