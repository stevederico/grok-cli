/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Diff from 'diff';
import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolEditConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import { Config, ApprovalMode } from '../config/config.js';
import { shortenPath, makeRelative } from '../utils/paths.js';
import { DEFAULT_DIFF_OPTIONS } from './diffOptions.js';

export interface PatchToolParams {
  patch: string;
}

interface ParsedHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface ParsedPatch {
  oldFileName: string;
  newFileName: string;
  hunks: ParsedHunk[];
}

/**
 * Applies unified diff patches to files.
 */
export class PatchTool extends BaseTool<PatchToolParams, ToolResult> {
  static readonly Name = 'apply_patch';
  private readonly config: Config;
  private readonly rootDirectory: string;

  constructor(config: Config) {
    super(
      PatchTool.Name,
      'Apply Patch',
      `Apply a unified diff patch to one or more files. The patch should be in standard unified diff format (as produced by \`diff -u\` or \`git diff\`). Each patch can modify a single file. The tool will parse the diff, apply hunks bottom-up, and show the resulting changes for confirmation before writing.`,
      {
        type: 'object',
        properties: {
          patch: {
            type: 'string',
            description: 'The unified diff patch text to apply.',
          },
        },
        required: ['patch'],
      },
    );
    this.config = config;
    this.rootDirectory = path.resolve(config.getTargetDir());
  }

  validateToolParams(params: PatchToolParams): string | null {
    if (!params.patch || typeof params.patch !== 'string' || params.patch.trim() === '') {
      return 'patch must be a non-empty string containing unified diff text.';
    }
    return null;
  }

  getDescription(params: PatchToolParams): string {
    // Extract filename from patch header if possible
    const match = params.patch?.match(/^---\s+[ab]\/(.+)$/m);
    if (match) {
      return `Apply patch to ${shortenPath(match[1])}`;
    }
    return 'Apply unified diff patch';
  }

  private parsePatch(patchText: string): ParsedPatch[] {
    const patches: ParsedPatch[] = [];
    const lines = patchText.split('\n');
    let i = 0;

    while (i < lines.length) {
      // Find --- line
      if (lines[i].startsWith('--- ')) {
        const oldFile = lines[i].replace(/^---\s+[ab]\//, '').replace(/^---\s+/, '');
        i++;
        if (i >= lines.length || !lines[i].startsWith('+++ ')) {
          continue;
        }
        const newFile = lines[i].replace(/^\+\+\+\s+[ab]\//, '').replace(/^\+\+\+\s+/, '');
        i++;

        const hunks: ParsedHunk[] = [];
        while (i < lines.length && lines[i].startsWith('@@')) {
          const hunkHeader = lines[i].match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          if (!hunkHeader) {
            i++;
            continue;
          }
          const hunk: ParsedHunk = {
            oldStart: parseInt(hunkHeader[1], 10),
            oldLines: hunkHeader[2] !== undefined ? parseInt(hunkHeader[2], 10) : 1,
            newStart: parseInt(hunkHeader[3], 10),
            newLines: hunkHeader[4] !== undefined ? parseInt(hunkHeader[4], 10) : 1,
            lines: [],
          };
          i++;
          while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('--- ')) {
            if (lines[i].startsWith('+') || lines[i].startsWith('-') || lines[i].startsWith(' ')) {
              hunk.lines.push(lines[i]);
            } else if (lines[i] === '\\ No newline at end of file') {
              // Skip this marker
            } else if (lines[i] === '') {
              // Could be context line with empty content
              hunk.lines.push(' ');
            } else {
              break;
            }
            i++;
          }
          hunks.push(hunk);
        }

        patches.push({ oldFileName: oldFile, newFileName: newFile, hunks });
      } else {
        i++;
      }
    }
    return patches;
  }

  private applyHunks(originalContent: string, hunks: ParsedHunk[]): string {
    const originalLines = originalContent.split('\n');

    // Apply hunks bottom-up to avoid line number shifts
    const sortedHunks = [...hunks].sort((a, b) => b.oldStart - a.oldStart);

    for (const hunk of sortedHunks) {
      const startIndex = hunk.oldStart - 1; // 0-based
      const removedLines: number[] = [];
      const addedLines: string[] = [];

      let oldLineCount = 0;
      for (const line of hunk.lines) {
        if (line.startsWith('-')) {
          removedLines.push(startIndex + oldLineCount);
          oldLineCount++;
        } else if (line.startsWith('+')) {
          addedLines.push(line.substring(1));
        } else if (line.startsWith(' ')) {
          oldLineCount++;
        }
      }

      // Remove old lines (in reverse to preserve indices)
      for (const idx of removedLines.sort((a, b) => b - a)) {
        originalLines.splice(idx, 1);
      }

      // Insert new lines at the start position (adjusted for removals above startIndex)
      const insertAt = startIndex;
      originalLines.splice(insertAt, 0, ...addedLines);
    }

    return originalLines.join('\n');
  }

  async shouldConfirmExecute(
    params: PatchToolParams,
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }
    if (this.config.getApprovalMode() === ApprovalMode.YOLO) {
      return false;
    }

    const validationError = this.validateToolParams(params);
    if (validationError) return false;

    const parsed = this.parsePatch(params.patch);
    if (parsed.length === 0) return false;

    // Show diff for the first file as confirmation
    const first = parsed[0];
    const filePath = path.resolve(this.rootDirectory, first.newFileName);
    const fileName = path.basename(filePath);

    const confirmationDetails: ToolEditConfirmationDetails = {
      type: 'edit',
      title: `Apply Patch: ${shortenPath(makeRelative(filePath, this.rootDirectory))}`,
      fileName,
      fileDiff: params.patch,
      isModifying: true,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(params: PatchToolParams, _signal: AbortSignal): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
      };
    }

    const parsed = this.parsePatch(params.patch);
    if (parsed.length === 0) {
      return {
        llmContent: 'Error: Could not parse any patches from the provided diff text.',
        returnDisplay: 'Error: No valid patches found in input.',
      };
    }

    const results: string[] = [];

    for (const patch of parsed) {
      const filePath = path.resolve(this.rootDirectory, patch.newFileName);

      try {
        let originalContent = '';
        const isNewFile = patch.oldFileName === '/dev/null';

        if (!isNewFile) {
          originalContent = fs.readFileSync(filePath, 'utf-8');
        }

        const newContent = this.applyHunks(originalContent, patch.hunks);

        // Ensure parent directories exist
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, newContent, 'utf-8');
        results.push(`Patched: ${patch.newFileName}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push(`Failed to patch ${patch.newFileName}: ${msg}`);
      }
    }

    const summary = results.join('\n');
    return {
      llmContent: summary,
      returnDisplay: summary,
    };
  }
}
