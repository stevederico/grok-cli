/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isNodeError,
  getErrorMessage,
  toFriendlyError,
  ForbiddenError,
  UnauthorizedError,
  BadRequestError,
} from './errors.js';
import { GaxiosError } from '../__stubs__/gaxios.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isNodeError', () => {
  it('returns true for Error with code property', () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    expect(isNodeError(err)).toBe(true);
  });

  it('returns false for plain Error without code', () => {
    expect(isNodeError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNodeError('string')).toBe(false);
    expect(isNodeError(null)).toBe(false);
    expect(isNodeError(42)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('converts string to string', () => {
    expect(getErrorMessage('raw string')).toBe('raw string');
  });

  it('converts number to string', () => {
    expect(getErrorMessage(404)).toBe('404');
  });

  it('converts object to string', () => {
    expect(getErrorMessage({ key: 'val' })).toBe('[object Object]');
  });

  it('handles null', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});

describe('toFriendlyError', () => {
  it('converts GaxiosError with 400 to BadRequestError', () => {
    const gaxiosErr = new GaxiosError('bad', {
      data: JSON.stringify({ error: { code: 400, message: 'Bad request body' } }),
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {},
    });
    const result = toFriendlyError(gaxiosErr);
    expect(result).toBeInstanceOf(BadRequestError);
    expect((result as Error).message).toBe('Bad request body');
  });

  it('converts GaxiosError with 401 to UnauthorizedError', () => {
    const gaxiosErr = new GaxiosError('unauth', {
      data: JSON.stringify({ error: { code: 401, message: 'Invalid key' } }),
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {},
    });
    const result = toFriendlyError(gaxiosErr);
    expect(result).toBeInstanceOf(UnauthorizedError);
    expect((result as Error).message).toBe('Invalid key');
  });

  it('converts GaxiosError with 403 to ForbiddenError', () => {
    const gaxiosErr = new GaxiosError('forbidden', {
      data: JSON.stringify({ error: { code: 403, message: 'Access denied' } }),
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {},
    });
    const result = toFriendlyError(gaxiosErr);
    expect(result).toBeInstanceOf(ForbiddenError);
    expect((result as Error).message).toBe('Access denied');
  });

  it('passes through non-GaxiosError unchanged', () => {
    const plainErr = new Error('plain error');
    expect(toFriendlyError(plainErr)).toBe(plainErr);
  });

  it('passes through GaxiosError with unhandled status code', () => {
    const gaxiosErr = new GaxiosError('server', {
      data: JSON.stringify({ error: { code: 500, message: 'Internal error' } }),
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config: {},
    });
    const result = toFriendlyError(gaxiosErr);
    expect(result).toBe(gaxiosErr);
  });

  it('passes through non-Error values', () => {
    expect(toFriendlyError('string error')).toBe('string error');
    expect(toFriendlyError(null)).toBe(null);
  });
});
