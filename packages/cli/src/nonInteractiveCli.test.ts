/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runNonInteractive } from './nonInteractiveCli.js';
import { Config, ToolRegistry } from './core/index.js';

// Mock dependencies
const mockQueryWithTools = vi.fn();
const mockProvider = {
  queryWithTools: mockQueryWithTools,
};

vi.mock('./core/providers/registry.js', () => ({
  getProvider: vi.fn(() => mockProvider),
}));

vi.mock('./core/index.js', async () => {
  const actual = await vi.importActual('./core/index.js');
  return {
    ...actual,
    executeToolCall: vi.fn(),
  };
});

describe('runNonInteractive', () => {
  let mockConfig: Config;
  let mockToolRegistry: ToolRegistry;
  let mockProcessStdoutWrite: ReturnType<typeof vi.fn>;
  let mockProcessExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockToolRegistry = {
      getFunctionDeclarations: vi.fn().mockReturnValue([]),
      getTool: vi.fn(),
    } as unknown as ToolRegistry;

    mockConfig = {
      getToolRegistry: vi.fn().mockResolvedValue(mockToolRegistry),
      getProvider: vi.fn().mockReturnValue('grok'),
      getModel: vi.fn().mockReturnValue(undefined),
    } as unknown as Config;

    mockProcessStdoutWrite = vi.fn().mockImplementation(() => true);
    process.stdout.write = mockProcessStdoutWrite as any;
    mockProcessExit = vi
      .fn()
      .mockImplementation((_code?: number) => undefined as never);
    process.exit = mockProcessExit as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process input and write text output', async () => {
    mockQueryWithTools.mockResolvedValue({
      content: 'Hello World',
      tool_calls: [],
    });

    await runNonInteractive(mockConfig, 'Test input');

    expect(mockQueryWithTools).toHaveBeenCalledWith(
      'Test input',
      [],
      expect.any(Object),
    );
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Hello World');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('\n');
  });

  it('should handle a single tool call and respond', async () => {
    const { executeToolCall: mockCoreExecuteToolCall } = await import(
      './core/index.js'
    );
    vi.mocked(mockCoreExecuteToolCall).mockResolvedValue({
      callId: 'fc1',
      responseParts: [],
      resultDisplay: 'Tool success display',
      error: undefined,
    });

    mockQueryWithTools.mockResolvedValue({
      content: 'Initial response',
      tool_calls: [
        {
          id: 'fc1',
          function: {
            name: 'testTool',
            arguments: JSON.stringify({ p: 'v' }),
          },
        },
      ],
    });

    await runNonInteractive(mockConfig, 'Use a tool');

    expect(mockCoreExecuteToolCall).toHaveBeenCalledWith(
      mockConfig,
      expect.objectContaining({ callId: 'fc1', name: 'testTool' }),
      mockToolRegistry,
    );
    // Final response includes tool result appended
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('Tool success display'),
    );
  });

  it('should handle error during tool execution', async () => {
    const { executeToolCall: mockCoreExecuteToolCall } = await import(
      './core/index.js'
    );
    vi.mocked(mockCoreExecuteToolCall).mockResolvedValue({
      callId: 'fcError',
      responseParts: [],
      resultDisplay: 'Tool execution failed badly',
      error: new Error('Tool failed'),
    });

    mockQueryWithTools.mockResolvedValue({
      content: '',
      tool_calls: [
        {
          id: 'fcError',
          function: {
            name: 'errorTool',
            arguments: '{}',
          },
        },
      ],
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await runNonInteractive(mockConfig, 'Trigger tool error');

    expect(mockCoreExecuteToolCall).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('errorTool failed'),
    );
  });

  it('should exit with error if provider.queryWithTools throws', async () => {
    const apiError = new Error('API connection failed');
    mockQueryWithTools.mockRejectedValue(apiError);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await runNonInteractive(mockConfig, 'Initial fail');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error: API connection failed',
    );
  });
});
