/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';

/** Lifecycle events that can trigger hooks. */
export type HookEvent =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'Notification'
  | 'Stop'
  | 'SessionEnd';

/** A single hook entry in the settings file. */
export interface HookEntry {
  type: 'command';
  /** Shell command executed via `bash -c`. */
  command: string;
  /** Optional filter — currently used by Notification (e.g. "permission_prompt"). */
  matcher?: string;
  /** Per-hook timeout in ms. Overrides the default 5 000 ms. */
  timeout?: number;
}

/** Map of hook events to their registered entries. */
export type HooksSettings = Partial<Record<HookEvent, HookEntry[]>>;

/** Options for {@link runHooks}. */
interface RunHooksOptions {
  /** When true, awaits every hook before returning. Default: false (fire-and-forget). */
  blocking?: boolean;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Spawns every hook registered for `event`.
 *
 * @param event        - The lifecycle event that triggered this call.
 * @param hooksSettings - Merged user + workspace hooks map.
 * @param envVars      - Extra environment variables forwarded to child processes.
 * @param options      - `{ blocking: true }` to await all hooks before returning.
 */
export async function runHooks(
  event: HookEvent,
  hooksSettings: HooksSettings | undefined,
  envVars: Record<string, string>,
  options?: RunHooksOptions,
): Promise<void> {
  if (!hooksSettings) return;

  const entries = hooksSettings[event];
  if (!entries || entries.length === 0) return;

  const promises = entries.map((entry) => spawnHook(entry, envVars));

  if (options?.blocking) {
    await Promise.allSettled(promises);
  }
}

/**
 * Merges user-level and workspace-level hooks.
 * Workspace entries are appended after user entries for each event.
 *
 * @param userHooks      - Hooks from the user settings file.
 * @param workspaceHooks - Hooks from the workspace settings file.
 * @returns Merged hooks map.
 */
export function mergeHooks(
  userHooks: HooksSettings | undefined,
  workspaceHooks: HooksSettings | undefined,
): HooksSettings | undefined {
  if (!userHooks && !workspaceHooks) return undefined;
  if (!userHooks) return workspaceHooks;
  if (!workspaceHooks) return userHooks;

  const merged: HooksSettings = { ...userHooks };
  const events = Object.keys(workspaceHooks) as HookEvent[];

  for (const event of events) {
    const wsEntries = workspaceHooks[event];
    if (!wsEntries) continue;
    merged[event] = [...(merged[event] ?? []), ...wsEntries];
  }

  return merged;
}

/**
 * Spawns a single hook command and resolves when the process exits or times out.
 * Errors are logged as warnings and never thrown.
 */
function spawnHook(
  entry: HookEntry,
  envVars: Record<string, string>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const timeoutMs = entry.timeout ?? DEFAULT_TIMEOUT_MS;

    try {
      const child = spawn('bash', ['-c', entry.command], {
        stdio: 'ignore',
        env: { ...process.env, ...envVars },
      });

      const timer = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {
          // Process may have already exited.
        }
        console.warn(
          `[hooks] Command timed out after ${timeoutMs}ms: ${entry.command}`,
        );
        resolve();
      }, timeoutMs);

      child.on('error', (err) => {
        clearTimeout(timer);
        console.warn(`[hooks] Failed to spawn command: ${entry.command}`, err);
        resolve();
      });

      child.on('close', () => {
        clearTimeout(timer);
        resolve();
      });
    } catch (err) {
      console.warn(`[hooks] Unexpected error running hook: ${entry.command}`, err);
      resolve();
    }
  });
}
