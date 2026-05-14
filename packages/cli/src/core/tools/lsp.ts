/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from 'path';
import { execSync } from 'child_process';
import { BaseTool, ToolResult } from './tools.js';
import { Config } from '../config/config.js';

export interface LspDiagnosticsParams {
  file_path?: string;
  command: 'diagnostics' | 'references' | 'definition';
  position?: { line: number; character: number };
}

/**
 * Runs language-specific diagnostics (errors/warnings) for a file.
 * Maps file extensions to the appropriate checker command.
 */
export class LspDiagnosticsTool extends BaseTool<LspDiagnosticsParams, ToolResult> {
  static readonly Name = 'lsp_diagnostics';
  private readonly config: Config;
  private readonly rootDirectory: string;

  constructor(config: Config) {
    super(
      LspDiagnosticsTool.Name,
      'LSP Diagnostics',
      `Get language diagnostics (errors, warnings) for a file. Runs the appropriate checker based on file extension:
- .ts/.js/.tsx/.jsx → deno check / tsc --noEmit
- .py → ruff check
- .rs → cargo check
- .go → go vet

Use \`command: 'diagnostics'\` to check a file for errors. The \`references\` and \`definition\` commands are reserved for future LSP integration.`,
      {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute path to the file to check. If omitted, checks the whole project.',
          },
          command: {
            type: 'string',
            enum: ['diagnostics', 'references', 'definition'],
            description: 'The diagnostic command to run.',
          },
          position: {
            type: 'object',
            properties: {
              line: { type: 'number', description: 'Line number (0-based).' },
              character: { type: 'number', description: 'Character offset (0-based).' },
            },
            description: 'Position in the file (for references/definition commands).',
          },
        },
        required: ['command'],
      },
      false, // not markdown
    );
    this.config = config;
    this.rootDirectory = path.resolve(config.getTargetDir());
  }

  validateToolParams(params: LspDiagnosticsParams): string | null {
    if (!params.command) {
      return 'command is required.';
    }
    if (!['diagnostics', 'references', 'definition'].includes(params.command)) {
      return `Invalid command "${params.command}". Must be diagnostics, references, or definition.`;
    }
    if (params.file_path && !path.isAbsolute(params.file_path)) {
      return `file_path must be absolute: ${params.file_path}`;
    }
    return null;
  }

  getDescription(params: LspDiagnosticsParams): string {
    if (params.file_path) {
      return `${params.command}: ${path.basename(params.file_path)}`;
    }
    return `${params.command}: project`;
  }

  private getCheckerCommand(filePath: string | undefined): { cmd: string; cwd: string } | null {
    if (!filePath) {
      // Default to project-level check — try to detect from project files
      return { cmd: 'deno check .', cwd: this.rootDirectory };
    }

    const ext = path.extname(filePath).toLowerCase();
    const cwd = this.rootDirectory;

    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        return { cmd: `deno check "${filePath}"`, cwd };
      case '.py':
        return { cmd: `ruff check "${filePath}"`, cwd };
      case '.rs':
        return { cmd: 'cargo check --message-format=short 2>&1', cwd };
      case '.go':
        return { cmd: `go vet "${filePath}"`, cwd };
      default:
        return null;
    }
  }

  async execute(params: LspDiagnosticsParams, _signal: AbortSignal): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
      };
    }

    if (params.command !== 'diagnostics') {
      return {
        llmContent: `The "${params.command}" command is not yet implemented. Only "diagnostics" is currently supported.`,
        returnDisplay: `"${params.command}" is not yet implemented.`,
      };
    }

    const checker = this.getCheckerCommand(params.file_path);
    if (!checker) {
      const ext = params.file_path ? path.extname(params.file_path) : 'unknown';
      return {
        llmContent: `No diagnostic checker available for file extension "${ext}".`,
        returnDisplay: `No checker for "${ext}" files.`,
      };
    }

    try {
      const output = execSync(checker.cmd, {
        cwd: checker.cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });

      // If command exits 0, no errors
      const trimmed = output.trim();
      if (!trimmed) {
        return {
          llmContent: 'No diagnostics found — file is clean.',
          returnDisplay: 'No errors or warnings found.',
        };
      }
      return {
        llmContent: trimmed,
        returnDisplay: trimmed,
      };
    } catch (err: any) {
      // Most checkers exit non-zero when there are errors — that's expected
      const output = (err.stdout || '') + (err.stderr || '');
      const trimmed = output.trim();
      if (trimmed) {
        return {
          llmContent: trimmed,
          returnDisplay: trimmed,
        };
      }
      return {
        llmContent: `Checker command failed: ${err.message || String(err)}`,
        returnDisplay: `Checker failed: ${err.message || String(err)}`,
      };
    }
  }
}
