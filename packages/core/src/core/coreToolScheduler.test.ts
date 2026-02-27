/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CoreToolScheduler,
  convertToFunctionResponse,
  CompletedToolCall,
} from './coreToolScheduler.js';
import {
  ToolCallRequestInfo,
  ToolConfirmationOutcome,
} from './types.js';
import { ApprovalMode } from '../config/config.js';
import type { Tool } from '../tools/tools.js';
import type { ToolRegistry } from '../tools/tool-registry.js';

// ---------- helpers ----------

function makeMockTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: overrides.name ?? 'test_tool',
    displayName: overrides.displayName ?? 'Test Tool',
    description: overrides.description ?? 'A test tool',
    schema: { name: 'test_tool', description: 'A test tool' },
    isOutputMarkdown: false,
    canUpdateOutput: overrides.canUpdateOutput ?? false,
    validateToolParams: vi.fn().mockReturnValue(null),
    getDescription: vi.fn().mockReturnValue('test'),
    shouldConfirmExecute: vi.fn().mockResolvedValue(false),
    execute: vi.fn().mockResolvedValue({
      llmContent: 'tool result text',
      returnDisplay: 'tool result text',
    }),
    ...overrides,
  } as unknown as Tool;
}

function makeMockRegistry(toolMap: Record<string, Tool>): ToolRegistry {
  return {
    getTool: vi.fn((name: string) => toolMap[name]),
    getAllTools: vi.fn(() => Object.values(toolMap)),
    getFunctionDeclarations: vi.fn(() => []),
    registerTool: vi.fn(),
    discoverTools: vi.fn(),
  } as unknown as ToolRegistry;
}

function makeRequest(overrides: Partial<ToolCallRequestInfo> = {}): ToolCallRequestInfo {
  return {
    callId: overrides.callId ?? 'call-1',
    name: overrides.name ?? 'test_tool',
    toolName: overrides.toolName ?? 'test_tool',
    parameters: overrides.parameters ?? {},
    args: overrides.args ?? {},
    ...overrides,
  };
}

// ---------- tests ----------

describe('convertToFunctionResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps a plain string into a functionResponse part', () => {
    const result = convertToFunctionResponse('myTool', 'id-1', 'hello');
    expect(result).toEqual({
      functionResponse: {
        id: 'id-1',
        name: 'myTool',
        response: { output: 'hello' },
      },
    });
  });

  it('wraps an array with multiple parts by prepending a functionResponse', () => {
    const parts = [{ text: 'a' }, { text: 'b' }];
    const result = convertToFunctionResponse('myTool', 'id-2', parts);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as any[];
    expect(arr[0]).toHaveProperty('functionResponse');
    expect(arr[0].functionResponse.response.output).toBe(
      'Tool execution succeeded.',
    );
    expect(arr.slice(1)).toEqual(parts);
  });

  it('unwraps a single-element array and processes the inner part', () => {
    const result = convertToFunctionResponse('myTool', 'id-3', [
      { text: 'solo' },
    ]);
    expect(result).toEqual({
      functionResponse: {
        id: 'id-3',
        name: 'myTool',
        response: { output: 'solo' },
      },
    });
  });

  it('extracts text from a Part with a text property', () => {
    const result = convertToFunctionResponse('myTool', 'id-4', {
      text: 'from part',
    } as any);
    expect(result).toEqual({
      functionResponse: {
        id: 'id-4',
        name: 'myTool',
        response: { output: 'from part' },
      },
    });
  });

  it('passes through an existing functionResponse without response.content', () => {
    const existing = {
      functionResponse: { id: 'orig', name: 'orig', response: { output: 'x' } },
    };
    const result = convertToFunctionResponse('myTool', 'id-5', existing as any);
    expect(result).toBe(existing);
  });

  it('stringifies functionResponse with response.content', () => {
    const existing = {
      functionResponse: {
        id: 'orig',
        name: 'orig',
        response: { content: [{ text: 'inner' }] },
      },
    };
    const result = convertToFunctionResponse('myTool', 'id-6', existing as any);
    expect(result).toEqual({
      functionResponse: {
        id: 'id-6',
        name: 'myTool',
        response: { output: 'inner' },
      },
    });
  });

  it('handles inlineData part by wrapping with mime type message', () => {
    const part = { inlineData: { mimeType: 'image/png', data: 'base64data' } };
    const result = convertToFunctionResponse('myTool', 'id-7', part as any);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as any[];
    expect(arr[0].functionResponse.response.output).toContain('image/png');
    expect(arr[1]).toBe(part);
  });

  it('handles fileData part by wrapping with mime type message', () => {
    const part = { fileData: { mimeType: 'application/pdf', fileUri: 'gs://bucket/file' } };
    const result = convertToFunctionResponse('myTool', 'id-8', part as any);
    expect(Array.isArray(result)).toBe(true);
    const arr = result as any[];
    expect(arr[0].functionResponse.response.output).toContain('application/pdf');
    expect(arr[1]).toBe(part);
  });

  it('falls back to default success message for unknown part shapes', () => {
    const part = { unknownField: 123 };
    const result = convertToFunctionResponse('myTool', 'id-9', part as any);
    expect(result).toEqual({
      functionResponse: {
        id: 'id-9',
        name: 'myTool',
        response: { output: 'Tool execution succeeded.' },
      },
    });
  });
});

describe('CoreToolScheduler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('transitions validating → scheduled → executing → success', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const statusUpdates: string[] = [];

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.YOLO,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onToolCallsUpdate: (toolCalls) => {
        for (const tc of toolCalls) {
          statusUpdates.push(tc.status);
        }
      },
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest(), signal);

    // Allow microtask queue for async execution to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(statusUpdates).toContain('validating');
    expect(statusUpdates).toContain('scheduled');
    expect(statusUpdates).toContain('executing');
  });

  it('transitions to error when tool is not found', async () => {
    const registry = makeMockRegistry({});
    const completedCalls: CompletedToolCall[] = [];

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.DEFAULT,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onAllToolCallsComplete: (calls) => {
        completedCalls.push(...calls);
      },
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest({ name: 'nonexistent', toolName: 'nonexistent' }), signal);
    await new Promise((r) => setTimeout(r, 50));

    expect(completedCalls.length).toBe(1);
    expect(completedCalls[0].status).toBe('error');
  });

  it('transitions to cancelled when execution is aborted', async () => {
    const abortController = new AbortController();
    const tool = makeMockTool({
      execute: vi.fn().mockImplementation(async () => {
        // Simulate the signal being aborted during execution
        abortController.abort();
        return { llmContent: 'done', returnDisplay: 'done' };
      }),
    });
    const registry = makeMockRegistry({ test_tool: tool });
    const completedCalls: CompletedToolCall[] = [];

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.YOLO,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onAllToolCallsComplete: (calls) => {
        completedCalls.push(...calls);
      },
    });

    await scheduler.schedule(makeRequest(), abortController.signal);
    await new Promise((r) => setTimeout(r, 50));

    expect(completedCalls.length).toBe(1);
    expect(completedCalls[0].status).toBe('cancelled');
  });

  it('calls onAllToolCallsComplete when all calls finish', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const onComplete = vi.fn();

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.YOLO,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onAllToolCallsComplete: onComplete,
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest(), signal);
    await new Promise((r) => setTimeout(r, 50));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const calls = onComplete.mock.calls[0][0] as CompletedToolCall[];
    expect(calls.length).toBe(1);
    expect(calls[0].status).toBe('success');
  });

  it('YOLO mode skips confirmation and goes straight to scheduled', async () => {
    const tool = makeMockTool({
      shouldConfirmExecute: vi.fn().mockResolvedValue({
        type: 'exec',
        title: 'Confirm',
        onConfirm: vi.fn(),
        command: 'rm -rf /',
        rootCommand: 'rm',
      }),
    });
    const registry = makeMockRegistry({ test_tool: tool });

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.YOLO,
      getPreferredEditor: () => undefined,
      config: {} as any,
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest(), signal);
    await new Promise((r) => setTimeout(r, 50));

    // In YOLO mode, shouldConfirmExecute should NOT be called
    expect(tool.shouldConfirmExecute).not.toHaveBeenCalled();
  });

  it('transitions to error when tool.execute throws', async () => {
    const tool = makeMockTool({
      execute: vi.fn().mockRejectedValue(new Error('Execution exploded')),
    });
    const registry = makeMockRegistry({ test_tool: tool });
    const completedCalls: CompletedToolCall[] = [];

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.YOLO,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onAllToolCallsComplete: (calls) => {
        completedCalls.push(...calls);
      },
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest(), signal);
    await new Promise((r) => setTimeout(r, 50));

    expect(completedCalls.length).toBe(1);
    expect(completedCalls[0].status).toBe('error');
  });

  it('awaits approval when shouldConfirmExecute returns details', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    const tool = makeMockTool({
      shouldConfirmExecute: vi.fn().mockResolvedValue({
        type: 'exec',
        title: 'Run command?',
        onConfirm: onConfirmMock,
        command: 'echo hello',
        rootCommand: 'echo',
      }),
    });
    const registry = makeMockRegistry({ test_tool: tool });
    const statusUpdates: string[] = [];

    const scheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(registry),
      approvalMode: ApprovalMode.DEFAULT,
      getPreferredEditor: () => undefined,
      config: {} as any,
      onToolCallsUpdate: (toolCalls) => {
        for (const tc of toolCalls) {
          if (!statusUpdates.includes(tc.status)) {
            statusUpdates.push(tc.status);
          }
        }
      },
    });

    const signal = new AbortController().signal;
    await scheduler.schedule(makeRequest(), signal);
    await new Promise((r) => setTimeout(r, 50));

    expect(statusUpdates).toContain('awaiting_approval');
  });
});
