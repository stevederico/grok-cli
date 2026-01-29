/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaValidator } from '../utils/schemaValidator.js';
import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import { getErrorMessage } from '../utils/errors.js';
import { Config, ApprovalMode } from '../config/config.js';
import { fetchWithTimeout, isPrivateIp } from '../utils/fetch.js';
import { convert } from 'html-to-text';

const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_LENGTH = 100000;

// Helper function to extract URLs from a string
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Parameters for the WebFetch tool
 */
export interface WebFetchToolParams {
  /**
   * The prompt containing URL(s) (up to 20) and instructions for processing their content.
   */
  prompt: string;
}

/**
 * Simplified WebFetch tool implementation
 */
export class WebFetchTool extends BaseTool<WebFetchToolParams, ToolResult> {
  static readonly Name: string = 'web_fetch';

  constructor(private readonly config: Config) {
    super(
      WebFetchTool.Name,
      'WebFetch',
      "Fetches content from URL(s) and returns the raw text. Include up to 20 URLs and instructions directly in the 'prompt' parameter.",
      {
        properties: {
          prompt: {
            description:
              'A prompt that includes the URL(s) (up to 20) to fetch and instructions on how to process their content. Must contain at least one URL starting with http:// or https://.',
            type: 'string',
          },
        },
        required: ['prompt'],
        type: 'object',
      },
    );
  }

  validateParams(params: WebFetchToolParams): string | null {
    if (
      this.schema.parameters &&
      !SchemaValidator.validate(
        this.schema.parameters as Record<string, unknown>,
        params,
      )
    ) {
      return 'Parameters failed schema validation.';
    }
    if (!params.prompt || params.prompt.trim() === '') {
      return "The 'prompt' parameter cannot be empty and must contain URL(s) and instructions.";
    }
    if (
      !params.prompt.includes('http://') &&
      !params.prompt.includes('https://')
    ) {
      return "The 'prompt' must contain at least one valid URL (starting with http:// or https://).";
    }
    return null;
  }

  getDescription(params: WebFetchToolParams): string {
    const displayPrompt =
      params.prompt.length > 100
        ? params.prompt.substring(0, 97) + '...'
        : params.prompt;
    return `Fetching content from URLs in prompt: "${displayPrompt}"`;
  }

  async shouldConfirmExecute(
    params: WebFetchToolParams,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }

    const validationError = this.validateParams(params);
    if (validationError) {
      return false;
    }

    const urls = extractUrls(params.prompt);

    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'info',
      title: `Confirm Web Fetch`,
      prompt: params.prompt,
      urls,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(
    params: WebFetchToolParams,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) {
      return {
        llmContent: `Error: Invalid parameters provided. Reason: ${validationError}`,
        returnDisplay: validationError,
      };
    }

    const urls = extractUrls(params.prompt);
    if (urls.length === 0) {
      return {
        llmContent: 'Error: No URL found in the prompt.',
        returnDisplay: 'Error: No URL found in the prompt.',
      };
    }

    const results: string[] = [];
    for (let i = 0; i < Math.min(urls.length, 20); i++) {
      let url = urls[i];
      
      // Convert GitHub blob URL to raw URL
      if (url.includes('github.com') && url.includes('/blob/')) {
        url = url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      try {
        const response = await fetchWithTimeout(url, URL_FETCH_TIMEOUT_MS);
        if (!response.ok) {
          results.push(`Error fetching ${url}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const html = await response.text();
        const textContent = convert(html, {
          wordwrap: false,
          selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' },
          ],
        }).substring(0, MAX_CONTENT_LENGTH);

        results.push(`Content from ${url}:\n${textContent}\n---`);
      } catch (error) {
        results.push(`Error fetching ${url}: ${getErrorMessage(error)}`);
      }
    }

    const llmContent = results.join('\n\n');
    return {
      llmContent,
      returnDisplay: `Fetched content from ${urls.length} URL(s)`,
    };
  }
}