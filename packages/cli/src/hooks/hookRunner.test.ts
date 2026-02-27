/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { mergeHooks, runHooks } from './hookRunner.js';
import type { HooksSettings, HookEntry } from './hookRunner.js';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  default: { spawn: mockSpawn },
  spawn: mockSpawn,
}));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mockSpawn.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Creates a fake ChildProcess EventEmitter. */
function createFakeChild() {
  const child = new EventEmitter() as any;
  child.kill = vi.fn();
  return child;
}

describe('mergeHooks', () => {
  it('returns undefined when both are undefined', () => {
    expect(mergeHooks(undefined, undefined)).toBeUndefined();
  });

  it('returns workspace hooks when user hooks are undefined', () => {
    const ws: HooksSettings = {
      SessionStart: [{ type: 'command', command: 'echo ws' }],
    };
    expect(mergeHooks(undefined, ws)).toBe(ws);
  });

  it('returns user hooks when workspace hooks are undefined', () => {
    const user: HooksSettings = {
      Stop: [{ type: 'command', command: 'echo user' }],
    };
    expect(mergeHooks(user, undefined)).toBe(user);
  });

  it('merges user and workspace hooks for same event', () => {
    const user: HooksSettings = {
      SessionStart: [{ type: 'command', command: 'echo user' }],
    };
    const ws: HooksSettings = {
      SessionStart: [{ type: 'command', command: 'echo ws' }],
    };
    const merged = mergeHooks(user, ws)!;

    expect(merged.SessionStart).toHaveLength(2);
    expect(merged.SessionStart![0].command).toBe('echo user');
    expect(merged.SessionStart![1].command).toBe('echo ws');
  });

  it('preserves events only in user hooks', () => {
    const user: HooksSettings = {
      Stop: [{ type: 'command', command: 'echo stop' }],
    };
    const ws: HooksSettings = {
      SessionStart: [{ type: 'command', command: 'echo start' }],
    };
    const merged = mergeHooks(user, ws)!;

    expect(merged.Stop).toHaveLength(1);
    expect(merged.SessionStart).toHaveLength(1);
  });
});

describe('runHooks', () => {
  it('returns immediately when hooksSettings is undefined', async () => {
    await runHooks('SessionStart', undefined, {});
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('returns immediately when no entries for the event', async () => {
    await runHooks('SessionStart', { Stop: [{ type: 'command', command: 'echo' }] }, {});
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('spawns hook in blocking mode and awaits completion', async () => {
    const child = createFakeChild();
    mockSpawn.mockReturnValue(child);

    const promise = runHooks(
      'SessionStart',
      { SessionStart: [{ type: 'command', command: 'echo hello' }] },
      { FOO: 'bar' },
      { blocking: true },
    );

    // Simulate process exit
    child.emit('close');

    await promise;
    expect(mockSpawn).toHaveBeenCalledWith(
      'bash',
      ['-c', 'echo hello'],
      expect.objectContaining({ stdio: 'ignore' }),
    );
  });

  it('fires and returns immediately in non-blocking mode', async () => {
    const child = createFakeChild();
    mockSpawn.mockReturnValue(child);

    // Non-blocking (default) — should resolve without waiting for child
    await runHooks(
      'SessionStart',
      { SessionStart: [{ type: 'command', command: 'echo bg' }] },
      {},
    );

    expect(mockSpawn).toHaveBeenCalled();
    // Cleanup: emit close so the promise resolves internally
    child.emit('close');
  });

  it('logs warning and resolves on spawn error', async () => {
    const child = createFakeChild();
    mockSpawn.mockReturnValue(child);

    const promise = runHooks(
      'Stop',
      { Stop: [{ type: 'command', command: 'bad-cmd' }] },
      {},
      { blocking: true },
    );

    child.emit('error', new Error('spawn failed'));
    await promise;

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to spawn'),
      expect.any(Error),
    );
  });

  it('kills child and warns on timeout', async () => {
    vi.useFakeTimers();
    const child = createFakeChild();
    mockSpawn.mockReturnValue(child);

    const promise = runHooks(
      'SessionStart',
      { SessionStart: [{ type: 'command', command: 'sleep 999', timeout: 100 }] },
      {},
      { blocking: true },
    );

    vi.advanceTimersByTime(100);
    await promise;

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
    );
  });
});
