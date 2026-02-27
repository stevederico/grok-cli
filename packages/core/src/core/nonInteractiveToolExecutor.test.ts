/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeToolCall } from './nonInteractiveToolExecutor.js';
import type { ToolCallRequestInfo } from './types.js';
import type { Tool } from '../tools/tools.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import type { Config } from '../config/config.js';

// ---------- helpers ----------

function makeMockTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: overrides.name ?? 'test_tool',
    displayName: 'Test Tool',
    description: 'A test tool',
    schema: { name: 'test_tool', description: 'A test tool' },
    isOutputMarkdown: false,
    canUpdateOutput: false,
    validateToolParams: vi.fn().mockReturnValue(null),
    getDescription: vi.fn().mockReturnValue('test'),
    shouldConfirmExecute: vi.fn().mockResolvedValue(false),
    execute: vi.fn().mockResolvedValue({
      llmContent: 'result output',
      returnDisplay: 'result output',
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
    parameters: overrides.parameters ?? { arg1: 'value1' },
    args: overrides.args ?? { arg1: 'value1' },
    ...overrides,
  };
}

const mockConfig = {} as Config;

// ---------- tests ----------

describe('executeToolCall', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes a found tool and returns a success response', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest();

    const response = await executeToolCall(mockConfig, request, registry);

    expect(registry.getTool).toHaveBeenCalledWith('test_tool');
    expect(tool.execute).toHaveBeenCalled();
    expect(response.callId).toBe('call-1');
    expect(response.error).toBeUndefined();
    expect(response.responseParts).toBeDefined();
  });

  it('returns an error response when tool is not found', async () => {
    const registry = makeMockRegistry({});
    const request = makeRequest({ name: 'missing_tool', toolName: 'missing_tool' });

    const response = await executeToolCall(mockConfig, request, registry);

    expect(response.callId).toBe('call-1');
    expect(response.error).toContain('not found in registry');
    expect(response.resultDisplay).toContain('not found in registry');
  });

  it('returns an error response when tool.execute throws', async () => {
    const tool = makeMockTool({
      execute: vi.fn().mockRejectedValue(new Error('Boom')),
    });
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest();

    const response = await executeToolCall(mockConfig, request, registry);

    expect(response.callId).toBe('call-1');
    expect(response.error).toBe('Boom');
    expect(response.resultDisplay).toBe('Boom');
  });

  it('handles non-Error thrown values', async () => {
    const tool = makeMockTool({
      execute: vi.fn().mockRejectedValue('string error'),
    });
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest();

    const response = await executeToolCall(mockConfig, request, registry);

    expect(response.error).toBe('string error');
  });

  it('passes abort signal to tool.execute', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest();
    const abortController = new AbortController();

    await executeToolCall(mockConfig, request, registry, abortController.signal);

    expect(tool.execute).toHaveBeenCalledWith(
      request.args,
      abortController.signal,
    );
  });

  it('creates a default AbortSignal when none provided', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest();

    await executeToolCall(mockConfig, request, registry);

    const executeCall = (tool.execute as any).mock.calls[0];
    expect(executeCall[1]).toBeInstanceOf(AbortSignal);
    expect(executeCall[1].aborted).toBe(false);
  });

  it('uses args over parameters when both are present', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const request = makeRequest({
      args: { from: 'args' },
      parameters: { from: 'parameters' },
    });

    await executeToolCall(mockConfig, request, registry);

    const executeCall = (tool.execute as any).mock.calls[0];
    expect(executeCall[0]).toEqual({ from: 'args' });
  });

  it('falls back to parameters when args is undefined', async () => {
    const tool = makeMockTool();
    const registry = makeMockRegistry({ test_tool: tool });
    const request: ToolCallRequestInfo = {
      callId: 'call-1',
      name: 'test_tool',
      toolName: 'test_tool',
      parameters: { from: 'parameters' },
    };

    await executeToolCall(mockConfig, request, registry);

    const executeCall = (tool.execute as any).mock.calls[0];
    expect(executeCall[0]).toEqual({ from: 'parameters' });
  });
});
