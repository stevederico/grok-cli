/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEffectiveModel } from './modelCheck.js';
import { DEFAULT_GROK_MODEL } from '../config/models.js';

describe('getEffectiveModel', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a non-default model unchanged', async () => {
    const result = await getEffectiveModel('api-key-123', 'custom-model-v2');
    expect(result).toBe('custom-model-v2');
  });

  it('returns the default model unchanged (no-op check)', async () => {
    const result = await getEffectiveModel('api-key-123', DEFAULT_GROK_MODEL);
    expect(result).toBe(DEFAULT_GROK_MODEL);
  });

  it('works with an empty API key', async () => {
    const result = await getEffectiveModel('', 'some-model');
    expect(result).toBe('some-model');
  });

  it('always returns a string', async () => {
    const result = await getEffectiveModel('key', DEFAULT_GROK_MODEL);
    expect(typeof result).toBe('string');
  });
});
