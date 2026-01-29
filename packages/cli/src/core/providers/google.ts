import { Provider, ProviderConfig, QueryOptions, ToolCallResponse, ProviderToolCall, StreamCallback } from './index.js';
import { retryWithBackoff } from '../utils/retry.js';
import { getSystemPrompt } from './systemPrompts.js';

const isDebugEnabled = () => process.env.DEBUG === '1' || process.env.DEBUG === 'true';

export class GoogleProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('google', config);
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.model = config.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.endpoint = config.endpoint || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Google: Provider not configured. Set GEMINI_API_KEY environment variable');
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetch(`${this.endpoint}/models?key=${this.apiKey}`, {
            signal: AbortSignal.timeout(10000),
          });

          if (!response.ok) {
            const error = new Error(`Failed to fetch models: ${response.status}`) as any;
            error.status = response.status;
            throw error;
          }

          const data = await response.json();
          return (data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''))
            .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
        },
        { maxAttempts: 2, initialDelayMs: 500, maxDelayMs: 2000 },
      );
    } catch (error) {
      throw new Error(`Failed to fetch Google models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const response = await this.queryWithTools(prompt, [], options);
    return response.content || '';
  }

  private convertToGeminiMessages(prompt: string, options: QueryOptions): { contents: any[]; systemInstruction?: any } {
    const systemInstruction = { parts: [{ text: getSystemPrompt() }] };
    let contents: any[] = [];

    if (options.tool_results && options.tool_results.length > 0) {
      // User message
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      // Previous assistant response with function calls
      const prevResponse = (options as any).previous_assistant_response;
      if (prevResponse?.tool_calls) {
        const modelParts: any[] = [];
        if (prevResponse.content) {
          modelParts.push({ text: prevResponse.content });
        }
        for (const tc of prevResponse.tool_calls) {
          let args: any;
          try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
          modelParts.push({
            functionCall: { name: tc.function.name, args },
          });
        }
        contents.push({ role: 'model', parts: modelParts });
      }

      // Function responses
      const functionResponseParts = options.tool_results.map((r: any) => {
        // Find the tool call name from previous response
        const prevTC = prevResponse?.tool_calls?.find((tc: any) => tc.id === r.tool_call_id);
        let responseData: any;
        try { responseData = JSON.parse(r.content); } catch { responseData = { result: r.content }; }
        return {
          functionResponse: {
            name: prevTC?.function?.name || 'unknown',
            response: responseData,
          },
        };
      });
      contents.push({ role: 'user', parts: functionResponseParts });
    } else {
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }

    return { contents, systemInstruction };
  }

  private convertToolsToGemini(tools: any[]): any {
    if (!tools || tools.length === 0) return undefined;

    return [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} },
      })),
    }];
  }

  async queryWithTools(prompt: string, tools: any[], options: QueryOptions = {}): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error('Google: Provider not configured. Set GEMINI_API_KEY environment variable');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      const { contents, systemInstruction } = this.convertToGeminiMessages(prompt, options);

      const requestBody: any = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: options.maxTokens || 2048,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = systemInstruction;
      }

      const geminiTools = this.convertToolsToGemini(tools);
      if (geminiTools) {
        requestBody.tools = geminiTools;
      }

      const fullEndpoint = `${this.endpoint}/models/${model}:generateContent?key=${this.apiKey}`;

      if (isDebugEnabled()) {
        console.log(`🚀 Google - Making request to model: ${model}`);
      }

      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(fullEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify(requestBody),
          });

          if (!res.ok) {
            const error = new Error(`Google API error: ${res.status} ${res.statusText}`) as any;
            error.status = res.status;
            throw error;
          }
          return res;
        },
        { maxAttempts: 3, initialDelayMs: 1000, maxDelayMs: 10000 },
      );

      const data = await response.json();
      return this.parseGeminiResponse(data);
    } catch (error) {
      console.error(`💥 Google - Query failed:`, error);
      throw new Error(`Google query failed: ${(error as Error).message}`);
    }
  }

  private parseGeminiResponse(data: any): ToolCallResponse {
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error('Unexpected response format from Google API');
    }

    let textContent = '';
    const toolCalls: ProviderToolCall[] = [];
    let callIndex = 0;

    for (const part of candidate.content.parts) {
      if (part.text) {
        textContent += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${callIndex++}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }

    const usage = data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount,
        }
      : undefined;

    return {
      content: textContent || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }

  async queryWithToolsStreaming(
    prompt: string,
    tools: any[],
    options: QueryOptions,
    onChunk: StreamCallback,
    signal?: AbortSignal,
  ): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error('Google: Provider not configured. Set GEMINI_API_KEY environment variable');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    const { contents, systemInstruction } = this.convertToGeminiMessages(prompt, options);

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: options.maxTokens || 2048,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    const geminiTools = this.convertToolsToGemini(tools);
    if (geminiTools) {
      requestBody.tools = geminiTools;
    }

    const fullEndpoint = `${this.endpoint}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(fullEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: signal || AbortSignal.timeout(60000),
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const error = new Error(`Google API error: ${res.status} ${res.statusText}`) as any;
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
    const toolCalls: ProviderToolCall[] = [];
    let callIndex = 0;
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
          const dataStr = trimmed.slice(6);

          try {
            const parsed = JSON.parse(dataStr);
            const candidate = parsed.candidates?.[0];

            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  accumulatedContent += part.text;
                  onChunk({ type: 'content', content: part.text });
                }
                if (part.functionCall) {
                  const tc: ProviderToolCall = {
                    id: `call_${callIndex++}`,
                    type: 'function',
                    function: {
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args || {}),
                    },
                  };
                  toolCalls.push(tc);
                  onChunk({
                    type: 'tool_call_delta',
                    tool_call: tc,
                  });
                }
              }
            }

            if (parsed.usageMetadata) {
              usage = {
                prompt_tokens: parsed.usageMetadata.promptTokenCount,
                completion_tokens: parsed.usageMetadata.candidatesTokenCount,
                total_tokens: parsed.usageMetadata.totalTokenCount,
              };
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    onChunk({ type: 'done' });

    return {
      content: accumulatedContent || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }
}

export function createGoogleProvider(config?: ProviderConfig): Provider {
  return new GoogleProvider(config);
}
