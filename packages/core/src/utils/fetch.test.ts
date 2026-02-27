/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isPrivateIp, fetchWithTimeout, FetchError } from './fetch.js';

const mockFetch = vi.hoisted(() => vi.fn());

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

describe('isPrivateIp', () => {
  it('returns true for 10.x.x.x range', () => {
    expect(isPrivateIp('http://10.0.0.1/path')).toBe(true);
    expect(isPrivateIp('http://10.255.255.255')).toBe(true);
  });

  it('returns true for 127.x.x.x (loopback)', () => {
    expect(isPrivateIp('http://127.0.0.1:3000')).toBe(true);
  });

  it('returns true for 192.168.x.x range', () => {
    expect(isPrivateIp('http://192.168.1.1')).toBe(true);
  });

  it('returns true for 172.16-31 range', () => {
    expect(isPrivateIp('http://172.16.0.1')).toBe(true);
    expect(isPrivateIp('http://172.31.255.255')).toBe(true);
  });

  it('returns false for public IPs', () => {
    expect(isPrivateIp('http://8.8.8.8')).toBe(false);
    expect(isPrivateIp('https://1.1.1.1')).toBe(false);
    expect(isPrivateIp('https://142.250.80.46')).toBe(false);
  });

  it('returns false for domain names', () => {
    expect(isPrivateIp('https://example.com')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isPrivateIp('not-a-url')).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  it('returns response on success', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const result = await fetchWithTimeout('https://example.com', 5000);
    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('passes options and abort signal to fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValueOnce(mockResponse);

    await fetchWithTimeout('https://example.com', 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://example.com');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('throws FetchError with ETIMEDOUT code on abort', async () => {
    const abortError: any = new Error('The operation was aborted');
    abortError.code = 'ABORT_ERR';
    mockFetch.mockRejectedValueOnce(abortError);

    try {
      await fetchWithTimeout('https://example.com', 100);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(FetchError);
      expect(err.code).toBe('ETIMEDOUT');
      expect(err.message).toContain('timed out');
    }
  });

  it('wraps non-abort errors in FetchError', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    try {
      await fetchWithTimeout('https://example.com', 5000);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(FetchError);
      expect(err.message).toBe('Network failure');
    }
  });
});
