/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockProvider = vi.hoisted(() => ({
  query: vi.fn(),
  isConfigured: vi.fn(),
  getModels: vi.fn(),
}));

const mockGetProvider = vi.hoisted(() => vi.fn().mockReturnValue(mockProvider));

vi.mock('./providers/registry.js', () => ({
  getProvider: mockGetProvider,
  getAvailableProviders: vi.fn().mockReturnValue(['grok', 'ollama']),
}));

import { runQuery, getProviderModels, getAvailableProviders } from './query.js';

describe('runQuery', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockProvider.isConfigured.mockReturnValue(true);
    mockProvider.query.mockResolvedValue('Hello from LLM');
    mockGetProvider.mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the provider and returns the response', async () => {
    const result = await runQuery('What is 2+2?', 'grok', {});
    expect(mockGetProvider).toHaveBeenCalledWith('grok', {});
    expect(mockProvider.isConfigured).toHaveBeenCalled();
    expect(mockProvider.query).toHaveBeenCalledWith('What is 2+2?', {});
    expect(result).toBe('Hello from LLM');
  });

  it('throws when provider is not configured', async () => {
    mockProvider.isConfigured.mockReturnValue(false);
    await expect(runQuery('test', 'grok')).rejects.toThrow(
      /not properly configured/,
    );
  });

  it('wraps provider errors in a Query failed message', async () => {
    mockProvider.query.mockRejectedValue(new Error('Network timeout'));
    await expect(runQuery('test', 'grok')).rejects.toThrow(
      'Query failed: Network timeout',
    );
  });

  it('wraps getProvider errors in a Query failed message', async () => {
    mockGetProvider.mockImplementation(() => {
      throw new Error('Unknown provider "bad"');
    });
    await expect(runQuery('test', 'bad')).rejects.toThrow(
      'Query failed: Unknown provider "bad"',
    );
  });

  it('defaults to grok provider when none specified', async () => {
    await runQuery('hello');
    expect(mockGetProvider).toHaveBeenCalledWith('grok', {});
  });

  it('passes options through to provider.query', async () => {
    const options = { model: 'grok-2', temperature: 0.5 };
    await runQuery('test', 'grok', {}, options);
    expect(mockProvider.query).toHaveBeenCalledWith('test', options);
  });
});

describe('getProviderModels', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockProvider.getModels.mockResolvedValue(['grok-2', 'grok-beta']);
    mockGetProvider.mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to provider.getModels()', async () => {
    const models = await getProviderModels('grok', {});
    expect(mockGetProvider).toHaveBeenCalledWith('grok', {});
    expect(models).toEqual(['grok-2', 'grok-beta']);
  });
});

describe('getAvailableProviders', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is re-exported from query module', () => {
    expect(typeof getAvailableProviders).toBe('function');
  });
});
