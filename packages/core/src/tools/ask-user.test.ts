/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AskUserTool, AskUserParams } from './ask-user.js';
import { ToolConfirmationOutcome } from './tools.js';

describe('AskUserTool', () => {
  let tool: AskUserTool;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    tool = new AskUserTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolParams', () => {
    it('returns null for valid question', () => {
      const params: AskUserParams = { question: 'What color?' };
      expect(tool.validateToolParams(params)).toBeNull();
    });

    it('returns error for empty question', () => {
      const params: AskUserParams = { question: '' };
      const result = tool.validateToolParams(params);
      expect(result).toContain('non-empty string');
    });

    it('returns error for whitespace-only question', () => {
      const params: AskUserParams = { question: '   ' };
      const result = tool.validateToolParams(params);
      expect(result).toContain('non-empty string');
    });
  });

  describe('getDescription', () => {
    it('returns the question as description', () => {
      const params: AskUserParams = { question: 'What is the answer?' };
      expect(tool.getDescription(params)).toBe('What is the answer?');
    });

    it('returns fallback for empty question', () => {
      const params: AskUserParams = { question: '' };
      expect(tool.getDescription(params)).toBe('Ask user a question');
    });
  });

  describe('shouldConfirmExecute', () => {
    it('returns false when validation fails', async () => {
      const params: AskUserParams = { question: '' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).toBe(false);
    });

    it('returns confirmation details with prompt for valid question', async () => {
      const params: AskUserParams = { question: 'Choose a color?' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).not.toBe(false);
      if (result) {
        expect(result.type).toBe('info');
        expect((result as any).title).toBe('Question from AI');
        expect((result as any).prompt).toContain('Choose a color?');
      }
    });

    it('includes formatted options in prompt', async () => {
      const params: AskUserParams = {
        question: 'Pick one:',
        options: ['Red', 'Blue', 'Green'],
      };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      expect(result).not.toBe(false);
      if (result) {
        const prompt = (result as any).prompt as string;
        expect(prompt).toContain('Pick one:');
        expect(prompt).toContain('Options:');
        expect(prompt).toContain('1. Red');
        expect(prompt).toContain('2. Blue');
        expect(prompt).toContain('3. Green');
      }
    });

    it('sets lastUserResponse on confirm with ProceedOnce', async () => {
      const params: AskUserParams = { question: 'Continue?' };
      const result = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );

      if (result && 'onConfirm' in result) {
        await result.onConfirm(ToolConfirmationOutcome.ProceedOnce);
      }

      // Now execute should return the captured response
      const execResult = await tool.execute(params, new AbortController().signal);
      expect(execResult.llmContent).toContain('User approved');
    });
  });

  describe('execute', () => {
    it('returns default response when no prior confirmation', async () => {
      const params: AskUserParams = { question: 'What?' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('User provided no explicit response');
      expect(result.returnDisplay).toContain('User provided no explicit response');
    });

    it('returns error when validation fails', async () => {
      const params: AskUserParams = { question: '' };
      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('Error:');
    });

    it('resets lastUserResponse after execute', async () => {
      // Simulate a confirmation that sets lastUserResponse
      const params: AskUserParams = { question: 'Continue?' };
      const confirmResult = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.ProceedAlways);
      }

      // First execute returns the captured response
      const firstExec = await tool.execute(
        params,
        new AbortController().signal,
      );
      expect(firstExec.llmContent).toContain('User approved');

      // Second execute should have reset state
      const secondExec = await tool.execute(
        params,
        new AbortController().signal,
      );
      expect(secondExec.llmContent).toContain('User provided no explicit response');
    });

    it('returns last user response from confirmation', async () => {
      const params: AskUserParams = { question: 'Sure?' };

      // Simulate confirm with APPROVE
      const confirmResult = await tool.shouldConfirmExecute(
        params,
        new AbortController().signal,
      );
      if (confirmResult && 'onConfirm' in confirmResult) {
        await confirmResult.onConfirm(ToolConfirmationOutcome.APPROVE);
      }

      const result = await tool.execute(params, new AbortController().signal);
      expect(result.llmContent).toContain('User response:');
      expect(result.llmContent).toContain('approved');
    });
  });
});
