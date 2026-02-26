/**
 * Provider interface for Grok CLI
 * All LLM providers must implement this interface
 */

export interface ProviderConfig {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  [key: string]: any;
}

export interface QueryOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  messages?: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }>;
  [key: string]: any;
}

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallResponse {
  content?: string;
  tool_calls?: ProviderToolCall[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface StreamChunk {
  type: 'content' | 'tool_call_delta' | 'done';
  content?: string;
  tool_call?: Partial<ProviderToolCall>;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export abstract class Provider {
  public readonly name: string;
  protected config: ProviderConfig;

  constructor(name: string, config: ProviderConfig = {}) {
    this.name = name;
    this.config = config;
  }

  /**
   * Query the LLM provider with a prompt
   */
  abstract query(prompt: string, options?: QueryOptions): Promise<string>;

  /**
   * Query the LLM provider with tool calling capabilities
   * Default implementation falls back to regular query
   */
  async queryWithTools(prompt: string, _tools: any[], options?: QueryOptions): Promise<ToolCallResponse> {
    const response = await this.query(prompt, options);
    return { content: response };
  }

  /**
   * Streaming version of queryWithTools. Fires onChunk per token/delta.
   * Default implementation falls back to non-streaming queryWithTools.
   */
  async queryWithToolsStreaming(
    prompt: string,
    tools: any[],
    options: QueryOptions,
    onChunk: StreamCallback,
    signal?: AbortSignal,
  ): Promise<ToolCallResponse> {
    const response = await this.queryWithTools(prompt, tools, options);
    if (response.content) {
      onChunk({ type: 'content', content: response.content });
    }
    onChunk({ type: 'done' });
    return response;
  }

  /**
   * Check if the provider is properly configured
   */
  abstract isConfigured(): boolean;

  /**
   * Get available models for this provider
   */
  abstract getModels(): Promise<string[]>;
}

/**
 * Factory function type for creating providers
 */
export type ProviderFactory = (config?: ProviderConfig) => Provider;
