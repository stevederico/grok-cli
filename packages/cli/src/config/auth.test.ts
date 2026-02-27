/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockLoadEnvironment = vi.hoisted(() => vi.fn());
const mockGetEnvVarForProvider = vi.hoisted(() => vi.fn());

vi.mock('./config.js', () => ({
  loadEnvironment: mockLoadEnvironment,
}));

vi.mock('../core/index.js', () => ({
  AuthType: { API_KEY: 'api_key', LOCAL: 'local' },
  getEnvVarForProvider: mockGetEnvVarForProvider,
}));

import { validateAuthMethod } from './auth.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mockLoadEnvironment.mockReset();
  mockGetEnvVarForProvider.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateAuthMethod', () => {
  it('returns null when API_KEY provider env var is set', () => {
    mockGetEnvVarForProvider.mockReturnValue('XAI_API_KEY');
    process.env.XAI_API_KEY = 'test-key';

    const result = validateAuthMethod('api_key', 'xai');
    expect(result).toBeNull();

    delete process.env.XAI_API_KEY;
  });

  it('returns error when provider env var is not set', () => {
    mockGetEnvVarForProvider.mockReturnValue('ANTHROPIC_API_KEY');
    delete process.env.ANTHROPIC_API_KEY;

    const result = validateAuthMethod('api_key', 'anthropic');
    expect(result).toContain('ANTHROPIC_API_KEY');
    expect(result).toContain('not set');
  });

  it('returns null for provider that needs no key', () => {
    mockGetEnvVarForProvider.mockReturnValue(undefined);

    const result = validateAuthMethod('api_key', 'ollama');
    expect(result).toBeNull();
  });

  it('returns error when no provider and XAI_API_KEY missing', () => {
    delete process.env.XAI_API_KEY;

    const result = validateAuthMethod('api_key');
    expect(result).toContain('XAI_API_KEY');
  });

  it('returns null when no provider and XAI_API_KEY is set', () => {
    process.env.XAI_API_KEY = 'key-value';

    const result = validateAuthMethod('api_key');
    expect(result).toBeNull();

    delete process.env.XAI_API_KEY;
  });

  it('returns null for LOCAL auth type', () => {
    const result = validateAuthMethod('local');
    expect(result).toBeNull();
  });

  it('calls loadEnvironment on every invocation', () => {
    mockGetEnvVarForProvider.mockReturnValue(undefined);
    validateAuthMethod('api_key', 'ollama');
    expect(mockLoadEnvironment).toHaveBeenCalled();
  });
});
