/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  BUILTIN_AGENTS,
  resolveAgent,
  listAgentNames,
  filterToolsForAgent,
  AgentProfile,
} from './AgentProfile';

const MOCK_TOOLS = [
  { name: 'glob' },
  { name: 'grep' },
  { name: 'read_file' },
  { name: 'write_file' },
  { name: 'shell' },
];

describe('BUILTIN_AGENTS', () => {
  it('has exactly 4 entries: default, planner, researcher, coder', () => {
    const keys = Object.keys(BUILTIN_AGENTS);
    expect(keys).toHaveLength(4);
    expect(keys).toEqual(
      expect.arrayContaining(['default', 'planner', 'researcher', 'coder']),
    );
  });

  it('planner has excludeTools: ["*"] and maxToolRounds: 0', () => {
    expect(BUILTIN_AGENTS.planner.excludeTools).toEqual(['*']);
    expect(BUILTIN_AGENTS.planner.maxToolRounds).toBe(0);
  });

  it('researcher has includeToolsOnly with specific tools', () => {
    const expected = [
      'glob',
      'grep',
      'read_file',
      'read_many_files',
      'list_directory',
      'shell',
      'web_fetch',
      'web_search',
    ];
    expect(BUILTIN_AGENTS.researcher.includeToolsOnly).toEqual(expected);
  });

  it('default has no tool restrictions', () => {
    expect(BUILTIN_AGENTS.default.excludeTools).toBeUndefined();
    expect(BUILTIN_AGENTS.default.includeToolsOnly).toBeUndefined();
  });
});

describe('resolveAgent', () => {
  it('returns correct profile for each builtin name', () => {
    expect(resolveAgent('default').name).toBe('Default');
    expect(resolveAgent('planner').name).toBe('Planner');
    expect(resolveAgent('researcher').name).toBe('Researcher');
    expect(resolveAgent('coder').name).toBe('Coder');
  });

  it('returns default profile for unknown name', () => {
    const result = resolveAgent('nonexistent');
    expect(result).toBe(BUILTIN_AGENTS.default);
  });

  it('custom agents override builtins with same name', () => {
    const custom: Record<string, AgentProfile> = {
      planner: { name: 'CustomPlanner', maxToolRounds: 5 },
    };
    const result = resolveAgent('planner', custom);
    expect(result.name).toBe('CustomPlanner');
    expect(result.maxToolRounds).toBe(5);
  });

  it('custom agents merge with builtins', () => {
    const custom: Record<string, AgentProfile> = {
      myagent: { name: 'MyAgent', excludeTools: ['shell'] },
    };
    const result = resolveAgent('myagent', custom);
    expect(result.name).toBe('MyAgent');
    expect(result.excludeTools).toEqual(['shell']);
    // Builtins still resolve
    expect(resolveAgent('coder', custom).name).toBe('Coder');
  });
});

describe('listAgentNames', () => {
  it('returns all 4 builtin names', () => {
    const names = listAgentNames();
    expect(names).toHaveLength(4);
    expect(names).toEqual(
      expect.arrayContaining(['default', 'planner', 'researcher', 'coder']),
    );
  });

  it('includes custom agent names when provided', () => {
    const custom: Record<string, AgentProfile> = {
      myagent: { name: 'MyAgent' },
    };
    const names = listAgentNames(custom);
    expect(names).toContain('myagent');
    expect(names).toHaveLength(5);
  });

  it('returns correct list when custom is empty', () => {
    const names = listAgentNames({});
    expect(names).toHaveLength(4);
    expect(names).toEqual(
      expect.arrayContaining(['default', 'planner', 'researcher', 'coder']),
    );
  });
});

describe('filterToolsForAgent', () => {
  it('default profile passes all tools through', () => {
    const result = filterToolsForAgent(MOCK_TOOLS, BUILTIN_AGENTS.default);
    expect(result).toEqual(MOCK_TOOLS);
  });

  it('researcher profile filters to only includeToolsOnly tools', () => {
    const result = filterToolsForAgent(MOCK_TOOLS, BUILTIN_AGENTS.researcher);
    const names = result.map((t) => t.name);
    expect(names).toEqual(['glob', 'grep', 'read_file', 'shell']);
  });

  it('planner profile (excludeTools: ["*"]) returns empty array', () => {
    const result = filterToolsForAgent(MOCK_TOOLS, BUILTIN_AGENTS.planner);
    expect(result).toEqual([]);
  });

  it('custom profile with excludeTools filters out specific tools', () => {
    const profile: AgentProfile = {
      name: 'NoWrite',
      excludeTools: ['write_file', 'shell'],
    };
    const result = filterToolsForAgent(MOCK_TOOLS, profile);
    const names = result.map((t) => t.name);
    expect(names).toEqual(['glob', 'grep', 'read_file']);
  });

  it('includeToolsOnly takes precedence over excludeTools', () => {
    const profile: AgentProfile = {
      name: 'Mixed',
      excludeTools: ['glob', 'grep'],
      includeToolsOnly: ['glob', 'grep'],
    };
    const result = filterToolsForAgent(MOCK_TOOLS, profile);
    const names = result.map((t) => t.name);
    expect(names).toEqual(['glob', 'grep']);
  });
});
