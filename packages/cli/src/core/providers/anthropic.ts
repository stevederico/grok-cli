import { Provider, ProviderConfig, QueryOptions, ToolCallResponse, ProviderToolCall, StreamCallback } from './index.js';
import { retryWithBackoff } from '../utils/retry.js';
import { getSystemPrompt } from './systemPrompts.js';

const isDebugEnabled = () => process.env.DEBUG === '1' || process.env.DEBUG === 'true';

export class AnthropicProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('anthropic', config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    this.endpoint = config.endpoint || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    // Anthropic doesn't have a public models list endpoint, return known models
    return [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-haiku-3-5-20241022',
    ];
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const response = await this.queryWithTools(prompt, [], options);
    return response.content || '';
  }

  async queryWithTools(prompt: string, tools: any[], options: QueryOptions = {}): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic: Provider not configured. Set ANTHROPIC_API_KEY environment variable');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      let messages: any[] = [];
      let systemPrompt = getSystemPrompt();

      if (options.tool_results && options.tool_results.length > 0) {
        if (isDebugEnabled()) console.log(`🔧 Anthropic - Processing tool results continuation`);
        messages.push({ role: 'user', content: prompt });

        const prevResponse = (options as any).previous_assistant_response;
        if (prevResponse?.tool_calls) {
          // Build assistant content blocks: text + tool_use blocks
          const assistantContent: any[] = [];
          if (prevResponse.content) {
            assistantContent.push({ type: 'text', text: prevResponse.content });
          }
          for (const tc of prevResponse.tool_calls) {
            let args: any;
            try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
            assistantContent.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: args,
            });
          }
          messages.push({ role: 'assistant', content: assistantContent });
        }

        // Tool results go as user message with tool_result content blocks
        const toolResultContent = options.tool_results.map((r: any) => ({
          type: 'tool_result',
          tool_use_id: r.tool_call_id,
          content: r.content,
        }));
        messages.push({ role: 'user', content: toolResultContent });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const requestBody: any = {
        model,
        max_tokens: options.maxTokens || 2048,
        system: systemPrompt,
        messages,
      };

      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }

      if (tools && tools.length > 0) {
        requestBody.tools = tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters || { type: 'object', properties: {} },
        }));
      }

      const fullEndpoint = `${this.endpoint}/v1/messages`;

      if (isDebugEnabled()) {
        console.log(`🚀 Anthropic - Making request to: ${fullEndpoint}`);
        console.log(`📦 Anthropic - Using model: ${model}`);
      }

      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(fullEndpoint, {
            method: 'POST',
            headers: {
              'x-api-key': this.apiKey!,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const error = new Error(`Anthropic API error: ${res.status} ${res.statusText}`) as any;
            error.status = res.status;
            throw error;
          }
          return res;
        },
        { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000 },
      );

      const data = await response.json();

      const textContent = data.content
        ?.filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('') || undefined;

      const toolUseBlocks = data.content?.filter((b: any) => b.type === 'tool_use') || [];

      const usage = data.usage
        ? {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined;

      if (toolUseBlocks.length > 0) {
        const toolCalls: ProviderToolCall[] = toolUseBlocks.map((block: any) => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }));
        return { content: textContent, tool_calls: toolCalls, usage };
      }

      return { content: textContent, usage };
    } catch (error) {
      console.error(`💥 Anthropic - Query failed:`, error);
      throw new Error(`Anthropic query failed: ${(error as Error).message}`);
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
      throw new Error('Anthropic: Provider not configured. Set ANTHROPIC_API_KEY environment variable');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    let messages: any[] = [];
    let systemPrompt = getSystemPrompt();

    if (options.tool_results && options.tool_results.length > 0) {
      messages.push({ role: 'user', content: prompt });

      const prevResponse = (options as any).previous_assistant_response;
      if (prevResponse?.tool_calls) {
        const assistantContent: any[] = [];
        if (prevResponse.content) {
          assistantContent.push({ type: 'text', text: prevResponse.content });
        }
        for (const tc of prevResponse.tool_calls) {
          let args: any;
          try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
          assistantContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: args,
          });
        }
        messages.push({ role: 'assistant', content: assistantContent });
      }

      const toolResultContent = options.tool_results.map((r: any) => ({
        type: 'tool_result',
        tool_use_id: r.tool_call_id,
        content: r.content,
      }));
      messages.push({ role: 'user', content: toolResultContent });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const requestBody: any = {
      model,
      max_tokens: options.maxTokens || 2048,
      system: systemPrompt,
      messages,
      stream: true,
    };

    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters || { type: 'object', properties: {} },
      }));
    }

    const fullEndpoint = `${this.endpoint}/v1/messages`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(fullEndpoint, {
          method: 'POST',
          headers: {
            'x-api-key': this.apiKey!,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          signal: signal || AbortSignal.timeout(60000),
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const error = new Error(`Anthropic API error: ${res.status} ${res.statusText}`) as any;
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
    let buffer = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

    // Track tool use blocks being built
    const toolUseBlocks: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let currentBlockIndex = -1;

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
          const dataStr = trimmed.slice(6);

          try {
            const event = JSON.parse(dataStr);

            switch (event.type) {
              case 'content_block_start': {
                const block = event.content_block;
                currentBlockIndex = event.index;
                if (block.type === 'tool_use') {
                  toolUseBlocks.set(currentBlockIndex, {
                    id: block.id,
                    name: block.name,
                    arguments: '',
                  });
                }
                break;
              }
              case 'content_block_delta': {
                const delta = event.delta;
                if (delta.type === 'text_delta') {
                  accumulatedContent += delta.text;
                  onChunk({ type: 'content', content: delta.text });
                } else if (delta.type === 'input_json_delta') {
                  const existing = toolUseBlocks.get(event.index);
                  if (existing) {
                    existing.arguments += delta.partial_json;
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
                break;
              }
              case 'message_delta': {
                if (event.usage) {
                  usage = {
                    prompt_tokens: usage?.prompt_tokens,
                    completion_tokens: event.usage.output_tokens,
                    total_tokens: (usage?.prompt_tokens || 0) + (event.usage.output_tokens || 0),
                  };
                }
                break;
              }
              case 'message_start': {
                if (event.message?.usage) {
                  usage = {
                    prompt_tokens: event.message.usage.input_tokens,
                    completion_tokens: 0,
                    total_tokens: event.message.usage.input_tokens,
                  };
                }
                break;
              }
              case 'message_stop': {
                onChunk({ type: 'done' });
                break;
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
    for (const [, block] of toolUseBlocks) {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: block.arguments },
      });
    }

    return {
      content: accumulatedContent || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }
}

export function createAnthropicProvider(config?: ProviderConfig): Provider {
  return new AnthropicProvider(config);
}
