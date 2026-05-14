/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TodoItem {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'done';
}

let todos: TodoItem[] = [];
let persistPath: string | null = null;

/**
 * Initialize the todo store with a persistence path.
 * Call once at startup with the project temp dir.
 */
export function initTodoStore(projectTempDir: string): void {
  persistPath = path.join(projectTempDir, 'todos.json');
  // Try to load existing todos from disk
  try {
    if (fs.existsSync(persistPath)) {
      const raw = fs.readFileSync(persistPath, 'utf-8');
      todos = JSON.parse(raw);
    }
  } catch {
    // Ignore parse errors, start fresh
    todos = [];
  }
}

export function getTodos(): TodoItem[] {
  return todos;
}

export function setTodos(newTodos: TodoItem[]): void {
  todos = newTodos;
  persist();
}

function persist(): void {
  if (!persistPath) return;
  try {
    const dir = path.dirname(persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(persistPath, JSON.stringify(todos, null, 2), 'utf-8');
  } catch {
    // Silent fail — persistence is best-effort
  }
}
