/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import { setTodos, getTodos, TodoItem } from './todo-store.js';

export interface TodoWriteParams {
  todos: Array<{ id: string; task: string; status: 'pending' | 'in_progress' | 'done' }>;
}

export class TodoWriteTool extends BaseTool<TodoWriteParams, ToolResult> {
  static readonly Name = 'todo_write';

  constructor() {
    super(
      TodoWriteTool.Name,
      'Todo Write',
      `Create or update a structured task list. Each todo item has an id, task description, and status (pending, in_progress, done). The full list is replaced on each call — include all items, not just changed ones.`,
      {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'The full list of todo items to write.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique identifier for the todo item.' },
                task: { type: 'string', description: 'Description of the task.' },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'done'],
                  description: 'Current status of the task.',
                },
              },
              required: ['id', 'task', 'status'],
            },
          },
        },
        required: ['todos'],
      },
      false, // not markdown
    );
  }

  validateToolParams(params: TodoWriteParams): string | null {
    if (!params.todos || !Array.isArray(params.todos)) {
      return 'todos must be an array.';
    }
    for (const item of params.todos) {
      if (!item.id || !item.task || !item.status) {
        return 'Each todo must have id, task, and status.';
      }
      if (!['pending', 'in_progress', 'done'].includes(item.status)) {
        return `Invalid status "${item.status}". Must be pending, in_progress, or done.`;
      }
    }
    return null;
  }

  getDescription(_params: TodoWriteParams): string {
    return 'Update task list';
  }

  async execute(params: TodoWriteParams, _signal: AbortSignal): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
      };
    }

    setTodos(params.todos as TodoItem[]);
    const summary = params.todos
      .map((t) => `[${t.status}] ${t.id}: ${t.task}`)
      .join('\n');

    return {
      llmContent: `Task list updated (${params.todos.length} items).\n${summary}`,
      returnDisplay: `Task list updated (${params.todos.length} items).`,
    };
  }
}
