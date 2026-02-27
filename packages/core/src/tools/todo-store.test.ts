/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadFreshModule() {
  const mod = await import('./todo-store.js');
  return mod;
}

describe('initTodoStore', () => {
  it('loads existing todos from disk', async () => {
    const existing = [{ id: '1', task: 'Test', status: 'pending' }];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));

    const { initTodoStore, getTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    expect(getTodos()).toEqual(existing);
  });

  it('starts with empty array on parse error', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json{{{');

    const { initTodoStore, getTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    expect(getTodos()).toEqual([]);
  });

  it('starts empty when no file exists', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore, getTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    expect(getTodos()).toEqual([]);
  });
});

describe('getTodos / setTodos', () => {
  it('setTodos updates the list and persists', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore, getTodos, setTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const newTodos = [
      { id: '1', task: 'First', status: 'pending' as const },
      { id: '2', task: 'Second', status: 'done' as const },
    ];
    setTodos(newTodos);

    expect(getTodos()).toEqual(newTodos);
    // Verify persist was called
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('persist creates directory if missing', async () => {
    // First call for init: file doesn't exist
    mockExistsSync.mockReturnValueOnce(false);
    // Second call for persist dir check: dir doesn't exist
    mockExistsSync.mockReturnValueOnce(false);

    const { initTodoStore, setTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    setTodos([{ id: '1', task: 'task', status: 'pending' }]);

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });
});

describe('TodoReadTool', () => {
  it('returns empty message when no todos', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const { TodoReadTool } = await import('./todo-read.js');
    const tool = new TodoReadTool();
    const result = await tool.execute({}, new AbortController().signal);

    expect(result.llmContent).toContain('No tasks');
  });

  it('returns formatted list when todos exist', async () => {
    const existing = [
      { id: '1', task: 'Do something', status: 'pending' },
      { id: '2', task: 'Done thing', status: 'done' },
    ];
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));

    const { initTodoStore } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const { TodoReadTool } = await import('./todo-read.js');
    const tool = new TodoReadTool();
    const result = await tool.execute({}, new AbortController().signal);

    expect(result.llmContent).toContain('2 items');
    expect(result.llmContent).toContain('[pending] 1: Do something');
    expect(result.llmContent).toContain('[done] 2: Done thing');
  });
});

describe('TodoWriteTool', () => {
  it('replaces entire todo list on execute', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore, getTodos } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const { TodoWriteTool } = await import('./todo-write.js');
    const tool = new TodoWriteTool();

    const params = {
      todos: [
        { id: '1', task: 'New task', status: 'in_progress' as const },
      ],
    };
    const result = await tool.execute(params, new AbortController().signal);

    expect(result.llmContent).toContain('1 items');
    expect(getTodos()).toHaveLength(1);
    expect(getTodos()[0].status).toBe('in_progress');
  });

  it('returns error for invalid params', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const { TodoWriteTool } = await import('./todo-write.js');
    const tool = new TodoWriteTool();

    const result = await tool.execute(
      { todos: [{ id: '1', task: '', status: 'pending' }] } as any,
      new AbortController().signal,
    );

    // Empty task string is falsy, so validation should fail
    expect(result.llmContent).toContain('Error');
  });

  it('returns error for invalid status', async () => {
    mockExistsSync.mockReturnValue(false);

    const { initTodoStore } = await loadFreshModule();
    initTodoStore('/tmp/project');

    const { TodoWriteTool } = await import('./todo-write.js');
    const tool = new TodoWriteTool();

    const result = await tool.execute(
      { todos: [{ id: '1', task: 'task', status: 'invalid' as any }] },
      new AbortController().signal,
    );

    expect(result.llmContent).toContain('Error');
    expect(result.llmContent).toContain('Invalid status');
  });
});
