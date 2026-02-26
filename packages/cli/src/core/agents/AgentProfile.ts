/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/** Defines behavior overrides for an agent profile. */
export interface AgentProfile {
  name: string;
  /** Appended to the base system prompt. */
  systemPromptSuffix?: string;
  /** Replaces the entire system prompt. */
  systemPromptOverride?: string;
  /** Tool names to exclude. Use '*' to exclude all tools. */
  excludeTools?: string[];
  /** If set, only these tools are available (overrides excludeTools). */
  includeToolsOnly?: string[];
  /** Override the default max tool call rounds (default 15). */
  maxToolRounds?: number;
}

const PLAN_MODE_PROMPT = `PLAN MODE: Before making any changes, present a numbered plan listing each file and what you will change. Do NOT call any tools. After presenting the plan, stop and wait for the user to approve.

Format your plan like:
1. **file/path.ts** - Description of change
2. **file/path2.ts** - Description of change
...

Explain the rationale briefly after the list.`;

/** Built-in agent profiles available out of the box. */
export const BUILTIN_AGENTS: Record<string, AgentProfile> = {
  default: {
    name: 'Default',
  },
  planner: {
    name: 'Planner',
    excludeTools: ['*'],
    maxToolRounds: 0,
    systemPromptSuffix: PLAN_MODE_PROMPT,
  },
  researcher: {
    name: 'Researcher',
    includeToolsOnly: [
      'glob',
      'grep',
      'read_file',
      'read_many_files',
      'list_directory',
      'shell',
      'web_fetch',
      'web_search',
    ],
    systemPromptSuffix:
      'Focus on reading and understanding code. Do not modify files unless explicitly asked.',
  },
  coder: {
    name: 'Coder',
    systemPromptSuffix:
      'Focus on implementing changes. Verify changes compile and pass tests.',
  },
};

/**
 * Resolves an agent profile by name, checking custom agents first, then builtins.
 * @param name - The agent profile name to look up
 * @param customAgents - User-defined agent profiles from settings
 * @returns The resolved AgentProfile, or the default profile if not found
 */
export function resolveAgent(
  name: string,
  customAgents?: Record<string, AgentProfile>,
): AgentProfile {
  const merged = { ...BUILTIN_AGENTS, ...customAgents };
  return merged[name] || BUILTIN_AGENTS.default;
}

/**
 * Lists all available agent profile names (builtin + custom).
 * @param customAgents - User-defined agent profiles from settings
 * @returns Array of agent name strings
 */
export function listAgentNames(
  customAgents?: Record<string, AgentProfile>,
): string[] {
  const merged = { ...BUILTIN_AGENTS, ...customAgents };
  return Object.keys(merged);
}

/**
 * Filters tool declarations based on an agent profile's tool restrictions.
 * @param tools - Full list of tool declarations
 * @param profile - The active agent profile
 * @returns Filtered tool declarations
 */
export function filterToolsForAgent(
  tools: any[],
  profile: AgentProfile,
): any[] {
  if (profile.includeToolsOnly) {
    return tools.filter((t) => profile.includeToolsOnly!.includes(t.name));
  }
  if (profile.excludeTools) {
    if (profile.excludeTools.includes('*')) {
      return [];
    }
    return tools.filter((t) => !profile.excludeTools!.includes(t.name));
  }
  return tools;
}
