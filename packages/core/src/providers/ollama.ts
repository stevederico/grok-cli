import { Provider, ProviderConfig, QueryOptions, ToolCallResponse, StreamCallback } from './index.js';
import { env } from 'node:process';

export class OllamaProvider extends Provider {
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('ollama', config);
    this.model = config.model || env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
    this.endpoint = config.endpoint || env.GROKCLI_OLLAMA_ENDPOINT || 'http://localhost:11434';
  }

  isConfigured(): boolean {
    // Ollama doesn't need API key, just check if service is reachable
    return true;
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      throw new Error(`Failed to fetch Ollama models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: options.maxTokens || 2048,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.response) {
        return data.response;
      }
      
      throw new Error('Unexpected response format from Ollama API');
    } catch (error) {
      throw new Error(`Ollama query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Streaming version using Ollama's NDJSON streaming (stream: true by default).
   */
  async queryWithToolsStreaming(
    prompt: string,
    _tools: any[],
    options: QueryOptions,
    onChunk: StreamCallback,
    signal?: AbortSignal,
  ): Promise<ToolCallResponse> {
    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: signal || AbortSignal.timeout(120000),
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          options: {
            temperature,
            num_predict: options.maxTokens || 2048,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body for streaming');
      }

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.response) {
                accumulatedContent += parsed.response;
                onChunk({ type: 'content', content: parsed.response });
              }
              if (parsed.done) {
                onChunk({ type: 'done' });
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { content: accumulatedContent || undefined };
    } catch (error) {
      throw new Error(`Ollama streaming query failed: ${(error as Error).message}`);
    }
  }
}

export function createOllamaProvider(config?: ProviderConfig): Provider {
  return new OllamaProvider(config);
}
