/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import { getTodos } from './todo-store.js';

export interface TodoReadParams {}

export class TodoReadTool extends BaseTool<TodoReadParams, ToolResult> {
  static readonly Name = 'todo_read';

  constructor() {
    super(
      TodoReadTool.Name,
      'Todo Read',
      `Read the current task list. Returns all todo items with their id, task description, and status.`,
      {
        type: 'object',
        properties: {},
      },
      false,
    );
  }

  getDescription(_params: TodoReadParams): string {
    return 'Read task list';
  }

  async execute(_params: TodoReadParams, _signal: AbortSignal): Promise<ToolResult> {
    const todos = getTodos();
    if (todos.length === 0) {
      return {
        llmContent: 'No tasks in the todo list.',
        returnDisplay: 'No tasks in the todo list.',
      };
    }

    const summary = todos
      .map((t) => `[${t.status}] ${t.id}: ${t.task}`)
      .join('\n');

    return {
      llmContent: `Current task list (${todos.length} items):\n${summary}`,
      returnDisplay: `Current task list (${todos.length} items):\n${summary}`,
    };
  }
}
