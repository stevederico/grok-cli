/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getProvider, hasProvider, getAvailableProviders } from './registry.js';

describe('registry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProvider', () => {
    it('returns a provider instance for a valid name', () => {
      const provider = getProvider('grok', { apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(provider.name).toBe('grok');
    });

    it('returns a grok provider for "xai" alias', () => {
      const provider = getProvider('xai', { apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(provider.name).toBe('grok');
    });

    it('throws for unknown provider name', () => {
      expect(() => getProvider('nonexistent')).toThrow('Unknown provider "nonexistent"');
    });

    it('passes config to provider factory', () => {
      const provider = getProvider('grok', { apiKey: 'my-key', model: 'grok-3' });
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('hasProvider', () => {
    it('returns true for registered providers', () => {
      expect(hasProvider('grok')).toBe(true);
      expect(hasProvider('openai')).toBe(true);
      expect(hasProvider('ollama')).toBe(true);
    });

    it('returns true for xai alias', () => {
      expect(hasProvider('xai')).toBe(true);
    });

    it('returns false for unregistered providers', () => {
      expect(hasProvider('unknown')).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('returns all built-in provider names', () => {
      const providers = getAvailableProviders();
      expect(providers).toContain('grok');
      expect(providers).toContain('xai');
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('openrouter');
      expect(providers).toContain('groq');
      expect(providers).toContain('ollama');
      expect(providers).toContain('azure');
      expect(providers).toContain('github');
      expect(providers).toContain('custom');
    });

    it('returns an array of strings', () => {
      const providers = getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      providers.forEach((p) => expect(typeof p).toBe('string'));
    });
  });
});
