/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/** Represents a single message in the conversation. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

/** Default token budget for conversation context. */
const DEFAULT_TOKEN_BUDGET = 128000;

/** Tokens reserved for model response generation. */
const RESPONSE_RESERVE = 2048;

/**
 * Manages an ordered conversation history with system prompt, user/assistant
 * messages, and tool results. Supports token-aware truncation to stay within
 * a model's context window.
 */
export class ConversationHistory {
  private systemPrompt: string;
  private messages: ChatMessage[] = [];

  /**
   * @param systemPrompt The initial system prompt for the conversation.
   */
  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt;
  }

  /**
   * Updates the system prompt used at the start of the message array.
   * @param prompt The new system prompt.
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Appends a user message to the conversation.
   * @param content The user's message text.
   */
  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
  }

  /**
   * Appends an assistant message to the conversation.
   * @param content The assistant's response text, or null if only tool calls.
   * @param toolCalls Optional array of tool call requests from the assistant.
   */
  addAssistantMessage(
    content: string | null,
    toolCalls?: ChatMessage['tool_calls']
  ): void {
    const message: ChatMessage = { role: 'assistant', content };
    if (toolCalls) {
      message.tool_calls = toolCalls;
    }
    this.messages.push(message);
  }

  /**
   * Appends one or more tool result messages to the conversation.
   * @param results Array of tool results, each with a tool_call_id and content.
   */
  addToolResults(
    results: Array<{ tool_call_id: string; content: string }>
  ): void {
    for (const result of results) {
      this.messages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id,
      });
    }
  }

  /**
   * Returns the full message array with the system message prepended.
   * If the total estimated tokens exceed the budget, the oldest
   * non-system messages are dropped from the front until it fits.
   *
   * Token estimation uses `Math.ceil(text.length / 4)`.
   *
   * @param tokenBudget Maximum token budget (defaults to 128000).
   * @returns The array of ChatMessage objects ready for the model.
   */
  getMessages(tokenBudget: number = DEFAULT_TOKEN_BUDGET): ChatMessage[] {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: this.systemPrompt,
    };

    const effectiveBudget = tokenBudget - RESPONSE_RESERVE;
    const systemTokens = estimateTokens(systemMessage.content);

    const result = [...this.messages];

    let totalTokens =
      systemTokens +
      result.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    while (totalTokens > effectiveBudget && result.length > 0) {
      const dropped = result.shift()!;
      totalTokens -= estimateTokens(dropped.content);
    }

    return [systemMessage, ...result];
  }

  /**
   * Clears all non-system messages, resetting the conversation
   * while preserving the system prompt.
   */
  clear(): void {
    this.messages = [];
  }

  /** The number of non-system messages in the conversation. */
  get length(): number {
    return this.messages.length;
  }
}

/**
 * Estimates the token count for a string using chars/4 heuristic.
 * @param text The text to estimate, or null.
 * @returns Estimated token count.
 */
function estimateTokens(text: string | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
