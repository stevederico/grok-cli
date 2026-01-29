/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import { getErrorMessage } from '../utils/errors.js';
import { Config, ApprovalMode } from '../config/config.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { convert } from 'html-to-text';

const SEARCH_TIMEOUT_MS = 10000;
const MAX_RESULTS = 10;

/**
 * Parameters for the WebSearch tool
 */
export interface WebSearchToolParams {
  /** The search query */
  query: string;
  /** Number of results to return (default 5, max 10) */
  num_results?: number;
}

/**
 * Parse DuckDuckGo HTML search results into structured data.
 */
function parseDDGResults(html: string, maxResults: number): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // Match result blocks: <a class="result__a" href="...">title</a> and <a class="result__snippet" ...>snippet</a>
  const linkRegex = /<a\s+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let url = match[1];
    const title = convert(match[2], { wordwrap: false }).trim();

    // DuckDuckGo wraps URLs in a redirect; extract the actual URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    links.push({ url, title });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(convert(match[1], { wordwrap: false }).trim());
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

/**
 * WebSearch tool using DuckDuckGo HTML endpoint (no API key required).
 */
export class WebSearchTool extends BaseTool<WebSearchToolParams, ToolResult> {
  static readonly Name: string = 'web_search';

  constructor(private readonly config: Config) {
    super(
      WebSearchTool.Name,
      'WebSearch',
      'Searches the web using DuckDuckGo and returns titles, URLs, and snippets. Use this to find current information, documentation, or any web-accessible content.',
      {
        properties: {
          query: {
            description: 'The search query string.',
            type: 'string',
          },
          num_results: {
            description: 'Number of results to return (default 5, max 10).',
            type: 'number',
          },
        },
        required: ['query'],
        type: 'object',
      },
    );
  }

  validateParams(params: WebSearchToolParams): string | null {
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  getDescription(params: WebSearchToolParams): string {
    return `Searching the web for: "${params.query}"`;
  }

  async shouldConfirmExecute(
    params: WebSearchToolParams,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }

    const validationError = this.validateParams(params);
    if (validationError) {
      return false;
    }

    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'info',
      title: 'Confirm Web Search',
      prompt: `Search for: "${params.query}"`,
      urls: [`https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`],
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(
    params: WebSearchToolParams,
    signal: AbortSignal,
  ): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) {
      return {
        llmContent: `Error: ${validationError}`,
        returnDisplay: validationError,
      };
    }

    const numResults = Math.min(params.num_results || 5, MAX_RESULTS);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(params.query)}`;

    try {
      const response = await fetchWithTimeout(searchUrl, SEARCH_TIMEOUT_MS);
      if (!response.ok) {
        return {
          llmContent: `Error: Search returned status ${response.status}`,
          returnDisplay: `Search failed with status ${response.status}`,
        };
      }

      const html = await response.text();
      const results = parseDDGResults(html, numResults);

      if (results.length === 0) {
        return {
          llmContent: `No results found for "${params.query}"`,
          returnDisplay: `No results found for "${params.query}"`,
        };
      }

      const formatted = results
        .map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`,
        )
        .join('\n\n');

      const llmContent = `Web search results for "${params.query}":\n\n${formatted}`;

      return {
        llmContent,
        returnDisplay: `Found ${results.length} results for "${params.query}"`,
      };
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      return {
        llmContent: `Error performing web search: ${errorMsg}`,
        returnDisplay: `Search error: ${errorMsg}`,
      };
    }
  }
}
