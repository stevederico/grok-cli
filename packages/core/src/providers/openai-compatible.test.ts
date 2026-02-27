/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OpenAICompatibleCoreProvider,
  createOpenAICoreProvider,
  createAnthropicCoreProvider,
  createGoogleCoreProvider,
  createOpenRouterCoreProvider,
  createGroqCoreProvider,
  createAzureCoreProvider,
  createGitHubCoreProvider,
  createCustomCoreProvider,
} from './openai-compatible.js';

const mockFetch = vi.hoisted(() => vi.fn());

describe('OpenAICompatibleCoreProvider', () => {
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
    it('uses config values over defaults', () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'config-key', model: 'config-model', endpoint: 'http://custom' },
        { model: 'default-model', endpoint: 'http://default' },
      );
      expect(provider.name).toBe('test');
      expect(provider.isConfigured()).toBe(true);
    });

    it('falls back to default values', () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        {},
        { apiKey: 'default-key', model: 'default-model', endpoint: 'http://default' },
      );
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('returns true when apiKey is set', () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'http://test' },
      );
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when no apiKey', () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        {},
        { model: 'model', endpoint: 'http://test' },
      );
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('query', () => {
    it('returns content from OpenAI-shaped response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from OpenAI' } }],
        }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'gpt-4o', endpoint: 'https://api.test.com/v1' },
      );
      const result = await provider.query('hello');
      expect(result).toBe('Hello from OpenAI');
    });

    it('throws when not configured', async () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        {},
        { model: 'model', endpoint: 'http://test', displayName: 'TestProvider' },
      );
      await expect(provider.query('hello')).rejects.toThrow('TestProvider provider not configured');
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'test-model', endpoint: 'https://api.test.com/v1' },
      );
      await provider.query('test prompt', { temperature: 0.3, maxTokens: 512 });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.test.com/v1/chat/completions');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('test-model');
      expect(body.messages[0]).toEqual({ role: 'user', content: 'test prompt' });
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(512);
    });

    it('includes extra headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'https://api.test.com/v1' },
        { 'X-Custom-Header': 'custom-value' },
      );
      await provider.query('hello');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['Authorization']).toBe('Bearer key');
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'http://test', displayName: 'TestProvider' },
      );
      await expect(provider.query('hello')).rejects.toThrow('TestProvider API error: 500');
    });

    it('throws on unexpected response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpected: true }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'http://test', displayName: 'TestProvider' },
      );
      await expect(provider.query('hello')).rejects.toThrow('Unexpected response format from TestProvider');
    });

    it('uses options.model over constructor model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' } }],
        }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'default-model', endpoint: 'http://test' },
      );
      await provider.query('hello', { model: 'override-model' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('override-model');
    });
  });

  describe('getModels', () => {
    it('throws when not configured', async () => {
      const provider = new OpenAICompatibleCoreProvider(
        'test',
        {},
        { model: 'model', endpoint: 'http://test', displayName: 'TestProvider' },
      );
      await expect(provider.getModels()).rejects.toThrow('TestProvider provider not configured');
    });

    it('returns model ids on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
        }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'https://api.test.com/v1' },
      );
      const models = await provider.getModels();
      expect(models).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });

    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'https://api.test.com/v1' },
      );
      await provider.getModels();

      expect(mockFetch.mock.calls[0][0]).toBe('https://api.test.com/v1/models');
    });

    it('returns empty array when no models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const provider = new OpenAICompatibleCoreProvider(
        'test',
        { apiKey: 'key' },
        { model: 'model', endpoint: 'http://test' },
      );
      const models = await provider.getModels();
      expect(models).toEqual([]);
    });
  });
});

describe('factory functions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('createOpenAICoreProvider returns an OpenAI provider', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = createOpenAICoreProvider();
    expect(provider.name).toBe('openai');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createAnthropicCoreProvider returns an Anthropic provider', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const provider = createAnthropicCoreProvider();
    expect(provider.name).toBe('anthropic');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createGoogleCoreProvider returns a Google provider', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const provider = createGoogleCoreProvider();
    expect(provider.name).toBe('google');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createOpenRouterCoreProvider returns an OpenRouter provider', () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const provider = createOpenRouterCoreProvider();
    expect(provider.name).toBe('openrouter');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createGroqCoreProvider returns a Groq provider', () => {
    process.env.GROQ_API_KEY = 'test-key';
    const provider = createGroqCoreProvider();
    expect(provider.name).toBe('groq');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createAzureCoreProvider returns an Azure provider', () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    const provider = createAzureCoreProvider();
    expect(provider.name).toBe('azure');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createGitHubCoreProvider returns a GitHub provider', () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const provider = createGitHubCoreProvider();
    expect(provider.name).toBe('github');
    expect(provider.isConfigured()).toBe(true);
  });

  it('createCustomCoreProvider returns a Custom provider', () => {
    process.env.CUSTOM_API_KEY = 'test-key';
    const provider = createCustomCoreProvider();
    expect(provider.name).toBe('custom');
    expect(provider.isConfigured()).toBe(true);
  });

  it('providers are not configured without env vars', () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const openai = createOpenAICoreProvider();
    const anthropic = createAnthropicCoreProvider();
    const google = createGoogleCoreProvider();
    expect(openai.isConfigured()).toBe(false);
    expect(anthropic.isConfigured()).toBe(false);
    expect(google.isConfigured()).toBe(false);
  });
});
