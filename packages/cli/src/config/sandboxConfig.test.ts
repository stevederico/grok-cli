/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockCommandExistsSync = vi.hoisted(() => vi.fn());
const mockGetPackageJson = vi.hoisted(() => vi.fn());
const mockPlatform = vi.hoisted(() => vi.fn());

vi.mock('command-exists', () => ({
  default: { sync: mockCommandExistsSync },
  sync: mockCommandExistsSync,
}));

vi.mock('../utils/package.js', () => ({
  getPackageJson: mockGetPackageJson,
}));

vi.mock('node:os', () => ({
  platform: mockPlatform,
  default: { platform: mockPlatform },
}));

vi.mock('./settings.js', () => ({}));

vi.mock('../core/index.js', async () => {
  return {
    SandboxConfig: {},
  };
});

import { loadSandboxConfig } from './sandboxConfig.js';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mockCommandExistsSync.mockReset();
  mockGetPackageJson.mockReset();
  mockPlatform.mockReset();
  delete process.env.SANDBOX;
  delete process.env.GROK_SANDBOX;
  delete process.env.GROK_SANDBOX_IMAGE;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SANDBOX;
  delete process.env.GROK_SANDBOX;
  delete process.env.GROK_SANDBOX_IMAGE;
});

describe('loadSandboxConfig', () => {
  it('returns undefined when sandbox is disabled', async () => {
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      { sandbox: false },
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined when inside sandbox (SANDBOX env set)', async () => {
    process.env.SANDBOX = '1';
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      { sandbox: true },
    );
    expect(result).toBeUndefined();
  });

  it('returns config with docker command when sandbox is true and docker exists', async () => {
    mockPlatform.mockReturnValue('linux');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'docker');
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      { sandbox: true, 'sandbox-image': 'my-image:latest' },
    );

    expect(result).toEqual({
      command: 'docker',
      image: 'my-image:latest',
    });
  });

  it('returns undefined when no sandbox option and no image', async () => {
    mockPlatform.mockReturnValue('linux');
    mockCommandExistsSync.mockReturnValue(false);
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      {},
    );
    expect(result).toBeUndefined();
  });

  it('returns config with sandbox-exec on darwin when sandbox is true', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      { sandbox: true, 'sandbox-image': 'my-img' },
    );

    expect(result).toEqual({
      command: 'sandbox-exec',
      image: 'my-img',
    });
  });

  it('returns undefined when command found but no image available', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      { sandbox: true } as any,
      {},
    );
    // sandbox-exec found on darwin but no image → undefined
    expect(result).toBeUndefined();
  });

  it('uses image from env var GROK_SANDBOX_IMAGE', async () => {
    process.env.GROK_SANDBOX_IMAGE = 'env-image:tag';
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      { sandbox: true } as any,
      {},
    );

    expect(result).toEqual({
      command: 'sandbox-exec',
      image: 'env-image:tag',
    });
  });

  it('uses image from package.json config', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue({
      config: { sandboxImageUri: 'pkg-image:1.0' },
    });

    const result = await loadSandboxConfig(
      { sandbox: true } as any,
      {},
    );

    expect(result).toEqual({
      command: 'sandbox-exec',
      image: 'pkg-image:1.0',
    });
  });

  it('prefers sandbox-image cli arg over env var and package.json', async () => {
    process.env.GROK_SANDBOX_IMAGE = 'env-image';
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue({
      config: { sandboxImageUri: 'pkg-image' },
    });

    const result = await loadSandboxConfig(
      { sandbox: true } as any,
      { 'sandbox-image': 'cli-image' },
    );

    expect(result).toEqual({
      command: 'sandbox-exec',
      image: 'cli-image',
    });
  });

  it('uses GROK_SANDBOX env var to override argv', async () => {
    process.env.GROK_SANDBOX = 'docker';
    mockCommandExistsSync.mockReturnValue(true);
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      {} as any,
      { sandbox: false, 'sandbox-image': 'img' },
    );

    expect(result).toEqual({
      command: 'docker',
      image: 'img',
    });
  });

  it('uses settings.sandbox as fallback when no argv sandbox', async () => {
    mockPlatform.mockReturnValue('darwin');
    mockCommandExistsSync.mockImplementation((cmd: string) => cmd === 'sandbox-exec');
    mockGetPackageJson.mockResolvedValue(null);

    const result = await loadSandboxConfig(
      { sandbox: true } as any,
      { 'sandbox-image': 'settings-img' },
    );

    expect(result).toBeDefined();
    if (result) {
      expect(result.command).toBe('sandbox-exec');
      expect(result.image).toBe('settings-img');
    }
  });
});
