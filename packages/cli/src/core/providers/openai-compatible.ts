import { Provider, ProviderConfig, QueryOptions, ToolCallResponse, ProviderToolCall, StreamCallback } from './index.js';
import { tokenLimit } from '../core/tokenLimits.js';
import { retryWithBackoff } from '../utils/retry.js';
import { getSystemPrompt } from './systemPrompts.js';

const isDebugEnabled = () => process.env.DEBUG === '1' || process.env.DEBUG === 'true';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(messages: any[], model: string, maxTokens: number): any[] {
  const customLimit = parseInt(process.env.GROKCLI_CONTEXT_SIZE || '128000', 10);
  const limit = customLimit || tokenLimit(model);
  const systemMessageTokens = 1000;
  const responseTokens = maxTokens || 2048;
  const availableTokens = limit - systemMessageTokens - responseTokens;

  if (availableTokens <= 0) {
    return messages;
  }

  let totalTokens = 0;
  const truncatedMessages = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgContent = msg.content || '';
    const msgTokens = estimateTokens(msgContent);

    if (totalTokens + msgTokens > availableTokens) {
      const remainingTokens = availableTokens - totalTokens;
      if (remainingTokens > 100) {
        const maxChars = remainingTokens * 4;
        const truncatedContent = msgContent.substring(0, maxChars) + '... [truncated due to token limit]';
        truncatedMessages.unshift({ ...msg, content: truncatedContent });
      }
      break;
    }

    totalTokens += msgTokens;
    truncatedMessages.unshift(msg);
  }

  if (truncatedMessages.length < messages.length && isDebugEnabled()) {
    console.log(`🔧 Truncated ${messages.length - truncatedMessages.length} messages due to token limit (${totalTokens}/${availableTokens} tokens)`);
  }

  return truncatedMessages;
}

export class OpenAICompatibleProvider extends Provider {
  protected apiKey: string | undefined;
  protected model: string;
  protected endpoint: string;
  protected providerDisplayName: string;

  constructor(
    name: string,
    config: ProviderConfig,
    defaults: { apiKey?: string; model: string; endpoint: string; displayName?: string },
  ) {
    super(name, config);
    this.apiKey = config.apiKey || defaults.apiKey;
    this.model = config.model || defaults.model;
    this.endpoint = config.endpoint || defaults.endpoint;
    this.providerDisplayName = defaults.displayName || name.toUpperCase();
  }

  /** Override to add extra headers (e.g. OpenRouter HTTP-Referer). */
  protected extraHeaders(): Record<string, string> {
    return {};
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error(`${this.providerDisplayName}: Provider not configured. Set API key environment variable`);
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetch(`${this.endpoint}/models`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              ...this.extraHeaders(),
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            const error = new Error(`Failed to fetch models: ${response.status}`) as any;
            error.status = response.status;
            throw error;
          }

          const data = await response.json();
          const models = data.data?.map((m: any) => m.id) || [];
          return models.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
        },
        { maxAttempts: 2, initialDelayMs: 500, maxDelayMs: 2000 },
      );
    } catch (error) {
      throw new Error(`Failed to fetch ${this.providerDisplayName} models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const response = await this.queryWithTools(prompt, [], options);
    return response.content || '';
  }

  async queryWithTools(prompt: string, tools: any[], options: QueryOptions = {}): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error(`${this.providerDisplayName}: Provider not configured. Set API key environment variable`);
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      let messages: any[] = [];

      if (options.messages) {
        // Use pre-built message array from ConversationHistory
        messages = options.messages;
      } else if (options.tool_results && options.tool_results.length > 0) {
        if (isDebugEnabled()) console.log(`🔧 ${this.providerDisplayName} - Processing tool results continuation with ${options.tool_results.length} results`);
        messages.push({ role: 'user', content: prompt });

        const prevResponse = (options as any).previous_assistant_response;
        if (prevResponse?.tool_calls) {
          messages.push({
            role: 'assistant',
            content: prevResponse.content || null,
            tool_calls: prevResponse.tool_calls.map((tc: ProviderToolCall) => ({
              id: tc.id,
              type: tc.type,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });
        } else {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: options.tool_results.map((r: any) => ({
              id: r.tool_call_id,
              type: 'function',
              function: { name: 'unknown_tool', arguments: '{}' },
            })),
          });
        }

        const toolMessages = options.tool_results.map((r: { content: string; tool_call_id: string }) => ({
          role: 'tool',
          content: r.content,
          tool_call_id: r.tool_call_id,
        }));
        messages.push(...toolMessages);
      } else {
        messages.push({ role: 'system', content: getSystemPrompt() });
        messages.push({ role: 'user', content: prompt });
      }

      messages = truncateToTokenLimit(messages, model, options.maxTokens || 2048);

      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: options.maxTokens || 2048,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters || {} },
        }));
        requestBody.tool_choice = 'auto';
      }

      const fullEndpoint = `${this.endpoint}/chat/completions`;

      if (isDebugEnabled()) {
        console.log(`🚀 ${this.providerDisplayName} - Making request to: ${fullEndpoint}`);
        console.log(`📦 ${this.providerDisplayName} - Using model: ${model}`);
      }

      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(fullEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              ...this.extraHeaders(),
            },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const error = new Error(`${this.providerDisplayName} API error: ${res.status} ${res.statusText}`) as any;
            error.status = res.status;
            throw error;
          }

          return res;
        },
        { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000 },
      );

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const message = data.choices[0].message;
        const usage = data.usage
          ? {
              prompt_tokens: data.usage.prompt_tokens,
              completion_tokens: data.usage.completion_tokens,
              total_tokens: data.usage.total_tokens,
            }
          : undefined;

        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCalls: ProviderToolCall[] = message.tool_calls.map((call: any) => ({
            id: call.id,
            function: { name: call.function.name, arguments: call.function.arguments },
            type: 'function' as const,
          }));
          return { content: message.content, tool_calls: toolCalls, usage };
        }

        return { content: message.content, usage };
      }

      throw new Error(`Unexpected response format from ${this.providerDisplayName} API`);
    } catch (error) {
      console.error(`💥 ${this.providerDisplayName} - Query failed:`, error);
      throw new Error(`${this.providerDisplayName} query failed: ${(error as Error).message}`);
    }
  }

  async queryWithToolsStreaming(
    prompt: string,
    tools: any[],
    options: QueryOptions,
    onChunk: StreamCallback,
    signal?: AbortSignal,
  ): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error(`${this.providerDisplayName}: Provider not configured. Set API key environment variable`);
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    let messages: any[] = [];

    if (options.messages) {
      // Use pre-built message array from ConversationHistory
      messages = options.messages;
    } else if (options.tool_results && options.tool_results.length > 0) {
      messages.push({ role: 'user', content: prompt });
      const prevResponse = (options as any).previous_assistant_response;
      if (prevResponse?.tool_calls) {
        messages.push({
          role: 'assistant',
          content: prevResponse.content || null,
          tool_calls: prevResponse.tool_calls.map((tc: ProviderToolCall) => ({
            id: tc.id,
            type: tc.type,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });
      }
      const toolMessages = options.tool_results.map((r: any) => ({
        role: 'tool',
        content: r.content,
        tool_call_id: r.tool_call_id,
      }));
      messages.push(...toolMessages);
    } else {
      messages.push({ role: 'system', content: getSystemPrompt() });
      messages.push({ role: 'user', content: prompt });
    }

    messages = truncateToTokenLimit(messages, model, options.maxTokens || 2048);

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: options.maxTokens || 2048,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters || {} },
      }));
      requestBody.tool_choice = 'auto';
    }

    const fullEndpoint = `${this.endpoint}/chat/completions`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(fullEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...this.extraHeaders(),
          },
          signal: signal || AbortSignal.timeout(60000),
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const error = new Error(`${this.providerDisplayName} API error: ${res.status} ${res.statusText}`) as any;
          error.status = res.status;
          throw error;
        }
        return res;
      },
      { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000 },
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for streaming');
    }

    const decoder = new TextDecoder();
    let accumulatedContent = '';
    const toolCallDeltas: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let buffer = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onChunk({ type: 'done' });
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
              };
            }
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              accumulatedContent += delta.content;
              onChunk({ type: 'content', content: delta.content });
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallDeltas.has(idx)) {
                  toolCallDeltas.set(idx, { id: tc.id || '', name: '', arguments: '' });
                }
                const existing = toolCallDeltas.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;

                onChunk({
                  type: 'tool_call_delta',
                  tool_call: {
                    id: existing.id,
                    type: 'function',
                    function: { name: existing.name, arguments: existing.arguments },
                  },
                });
              }
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const toolCalls: ProviderToolCall[] = [];
    for (const [, tc] of toolCallDeltas) {
      toolCalls.push({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      });
    }

    return {
      content: accumulatedContent || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }
}
