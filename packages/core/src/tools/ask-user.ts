/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolInfoConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';

export interface AskUserParams {
  question: string;
  options?: string[];
}

/**
 * Tool that asks the user a question mid-task.
 * The confirmation prompt IS the question — the user's accept/reject
 * response is returned as the tool result.
 */
export class AskUserTool extends BaseTool<AskUserParams, ToolResult> {
  static readonly Name = 'ask_user';
  private lastUserResponse: string = '';

  constructor() {
    super(
      AskUserTool.Name,
      'Ask User',
      `Ask the user a question during task execution. Use this when you need clarification, a decision, or confirmation before proceeding. The question is shown as a confirmation prompt; the user's response becomes the tool result.`,
      {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user.',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of suggested answers to present.',
          },
        },
        required: ['question'],
      },
      false,
    );
  }

  validateToolParams(params: AskUserParams): string | null {
    if (!params.question || typeof params.question !== 'string' || params.question.trim() === '') {
      return 'question must be a non-empty string.';
    }
    return null;
  }

  getDescription(params: AskUserParams): string {
    return params.question || 'Ask user a question';
  }

  async shouldConfirmExecute(
    params: AskUserParams,
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    const validationError = this.validateToolParams(params);
    if (validationError) return false;

    let prompt = params.question;
    if (params.options && params.options.length > 0) {
      prompt += '\n\nOptions:\n' + params.options.map((o, i) => `  ${i + 1}. ${o}`).join('\n');
    }

    const confirmationDetails: ToolInfoConfirmationDetails = {
      type: 'info',
      title: 'Question from AI',
      prompt,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        // The user accepted — their response is captured via the confirmation flow
        this.lastUserResponse =
          outcome === ToolConfirmationOutcome.APPROVE || outcome === ToolConfirmationOutcome.ProceedOnce || outcome === ToolConfirmationOutcome.ProceedAlways
            ? 'User approved / confirmed.'
            : 'User declined.';
      },
    };
    return confirmationDetails;
  }

  async execute(params: AskUserParams, _signal: AbortSignal): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
      };
    }

    const response = this.lastUserResponse || 'User provided no explicit response.';
    this.lastUserResponse = ''; // Reset

    return {
      llmContent: `User response: ${response}`,
      returnDisplay: response,
    };
  }
}
