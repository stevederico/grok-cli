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
}

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
