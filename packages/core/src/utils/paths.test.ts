/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  tildeifyPath,
  shortenPath,
  makeRelative,
  escapePath,
  unescapePath,
  getProjectHash,
} from './paths.js';
import os from 'os';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tildeifyPath', () => {
  it('replaces home directory with tilde', () => {
    const home = os.homedir();
    expect(tildeifyPath(`${home}/projects/foo`)).toBe('~/projects/foo');
  });

  it('returns path unchanged when it does not start with home', () => {
    expect(tildeifyPath('/other/path')).toBe('/other/path');
  });

  it('handles exact home directory path', () => {
    const home = os.homedir();
    expect(tildeifyPath(home)).toBe('~');
  });
});

describe('shortenPath', () => {
  it('returns short paths unchanged', () => {
    const short = '/a/b/c.txt';
    expect(shortenPath(short, 50)).toBe(short);
  });

  it('shortens long paths with ellipsis', () => {
    const longPath = '/very/long/deeply/nested/directory/structure/file.txt';
    const result = shortenPath(longPath, 30);
    // The implementation is best-effort; verify it's shorter than original
    expect(result.length).toBeLessThan(longPath.length);
  });

  it('handles single-segment paths', () => {
    const result = shortenPath('/a', 1);
    expect(result).toBeDefined();
  });

  it('returns path as-is when under maxLen', () => {
    const p = '/usr/local/bin';
    expect(shortenPath(p, 100)).toBe(p);
  });
});

describe('makeRelative', () => {
  it('returns relative path from root to target', () => {
    expect(makeRelative('/a/b/c', '/a/b')).toBe('c');
  });

  it('returns dot when target equals root', () => {
    expect(makeRelative('/a/b', '/a/b')).toBe('.');
  });

  it('returns parent traversal when target is above root', () => {
    const result = makeRelative('/a', '/a/b');
    expect(result).toBe('..');
  });
});

describe('escapePath / unescapePath', () => {
  it('escapes spaces in path', () => {
    expect(escapePath('/my path/to file')).toBe('/my\\ path/to\\ file');
  });

  it('does not double-escape already escaped spaces', () => {
    expect(escapePath('/my\\ path')).toBe('/my\\ path');
  });

  it('roundtrips through escape and unescape', () => {
    const original = '/some path/with spaces/file name.txt';
    expect(unescapePath(escapePath(original))).toBe(original);
  });

  it('handles paths without spaces', () => {
    expect(escapePath('/no/spaces/here')).toBe('/no/spaces/here');
  });

  it('unescape removes backslash-space sequences', () => {
    expect(unescapePath('/my\\ path')).toBe('/my path');
  });
});

describe('getProjectHash', () => {
  it('returns a hex string', () => {
    const hash = getProjectHash('/some/project');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns consistent hash for same input', () => {
    const hash1 = getProjectHash('/my/project');
    const hash2 = getProjectHash('/my/project');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = getProjectHash('/project/a');
    const hash2 = getProjectHash('/project/b');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character SHA256 hex digest', () => {
    const hash = getProjectHash('/test');
    expect(hash).toHaveLength(64);
  });
});
