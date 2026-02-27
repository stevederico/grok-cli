/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrokProvider, createGrokProvider } from './grok.js';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('global', () => ({}));

describe('GrokProvider', () => {
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
    it('uses default model and endpoint when no config provided', () => {
      delete process.env.XAI_API_KEY;
      delete process.env.XAI_MODEL;
      const provider = new GrokProvider();
      expect(provider.name).toBe('grok');
      expect(provider.isConfigured()).toBe(false);
    });

    it('uses apiKey from config over env', () => {
      process.env.XAI_API_KEY = 'env-key';
      const provider = new GrokProvider({ apiKey: 'config-key' });
      expect(provider.isConfigured()).toBe(true);
    });

    it('falls back to XAI_API_KEY env var', () => {
      process.env.XAI_API_KEY = 'env-key';
      const provider = new GrokProvider();
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is set', () => {
      const provider = new GrokProvider({ apiKey: 'test-key' });
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when no apiKey', () => {
      delete process.env.XAI_API_KEY;
      const provider = new GrokProvider();
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('query', () => {
    it('throws when not configured', async () => {
      delete process.env.XAI_API_KEY;
      const provider = new GrokProvider();
      await expect(provider.query('hello')).rejects.toThrow('Grok provider not configured');
    });

    it('returns content on successful response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from Grok' } }],
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const result = await provider.query('hello');
      expect(result).toBe('Hello from Grok');
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key', model: 'grok-3' });
      await provider.query('test prompt', { temperature: 0.5, maxTokens: 1024 });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.x.ai/v1/chat/completions');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('grok-3');
      expect(body.messages[0]).toEqual({ role: 'user', content: 'test prompt' });
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(1024);
    });

    it('includes Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new GrokProvider({ apiKey: 'my-secret-key' });
      await provider.query('hello');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-secret-key');
    });

    it('throws on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
        headers: { entries: () => [] },
      });

      const provider = new GrokProvider({ apiKey: 'bad-key' });
      await expect(provider.query('hello')).rejects.toThrow('Grok query failed');
    });

    it('throws on 429 rate limit response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
        headers: { entries: () => [] },
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await expect(provider.query('hello')).rejects.toThrow('Grok query failed');
    });

    it('throws on unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'unexpected' }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await expect(provider.query('hello')).rejects.toThrow('Grok query failed');
    });

    it('uses options.model over constructor model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new GrokProvider({ apiKey: 'key', model: 'grok-code-fast-1' });
      await provider.query('hello', { model: 'grok-3' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('grok-3');
    });
  });

  describe('getModels', () => {
    it('throws when not configured', async () => {
      delete process.env.XAI_API_KEY;
      const provider = new GrokProvider();
      await expect(provider.getModels()).rejects.toThrow('Grok provider not configured');
    });

    it('returns model ids on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'grok-3' }, { id: 'grok-code-fast-1' }],
        }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      const models = await provider.getModels();
      expect(models).toEqual(['grok-3', 'grok-code-fast-1']);
    });

    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await provider.getModels();

      expect(mockFetch.mock.calls[0][0]).toBe('https://api.x.ai/v1/models');
    });

    it('throws on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new GrokProvider({ apiKey: 'test-key' });
      await expect(provider.getModels()).rejects.toThrow('Failed to fetch Grok models');
    });
  });

  describe('createGrokProvider', () => {
    it('returns a GrokProvider instance', () => {
      const provider = createGrokProvider({ apiKey: 'test' });
      expect(provider).toBeInstanceOf(GrokProvider);
      expect(provider.name).toBe('grok');
    });
  });
});
