/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import { runQuery } from '../query.js';
import { AuthType } from './types.js';

/**
 * Provider-agnostic client that works with all providers
 * Provider client for interactive mode
 */
export class ProviderClient {
  constructor(private config: Config) {}

  async initialize(authMethod?: AuthType): Promise<void> {
    // Initialization is handled by the provider system
    const provider = this.config.getProvider();
    console.debug(`Provider ${provider} initialized successfully`);
  }

  /**
   * Send a streaming query using the provider system
   */
  async *sendMessage(
    messages: Array<{ role: string; content: string }>,
    options: { stream?: boolean; model?: string } = {}
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.config.getProvider();
    const providerConfig = this.getProviderConfig();
    
    // Convert messages to a single prompt for now
    // TODO: Support proper conversation history for providers that support it
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const queryOptions = {
      model: options.model || this.config.getModel(),
      stream: options.stream ?? true,
    };

    try {
      if (options.stream) {
        // For streaming, we'll need to implement provider-specific streaming
        // For now, fall back to non-streaming and yield the result
        const response = await runQuery(prompt, provider, providerConfig, { 
          ...queryOptions, 
          stream: false 
        });
        yield response;
      } else {
        const response = await runQuery(prompt, provider, providerConfig, queryOptions);
        yield response;
      }
    } catch (error) {
      console.error(`Provider ${provider} error:`, error);
      throw error;
    }
  }

  /**
   * Get provider-specific configuration
   */
  private getProviderConfig(): any {
    const provider = this.config.getProvider();
    const providerConfig: any = {};

    switch (provider) {
      case 'ollama':
        providerConfig.endpoint = process.env.OLLAMA_HOST || 'http://localhost:11434';
        providerConfig.model = this.config.getModel();
        break;
      
      case 'grok':
        providerConfig.apiKey = process.env.XAI_API_KEY || '';
        providerConfig.model = process.env.XAI_MODEL;
        break;

      default:
        console.warn(`Unknown provider: ${provider}`);
    }

    return providerConfig;
  }

  /**
   * Check if the provider is properly configured and available
   */
  async isConfigured(): Promise<boolean> {
    const provider = this.config.getProvider();
    
    try {
      switch (provider) {
        case 'ollama':
          const endpoint = process.env.OLLAMA_HOST || 'http://localhost:11434';
          const response = await fetch(`${endpoint}/api/version`);
          return response.ok;
        
        case 'grok':
          const apiKey = process.env.XAI_API_KEY;
          return !!apiKey;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Provider ${provider} configuration check failed:`, error);
      return false;
    }
  }

  /**
   * Get provider-specific error information
   */
  getProviderInfo(): { name: string; configured: boolean; requirements: string[] } {
    const provider = this.config.getProvider();
    
    switch (provider) {
      case 'ollama':
        return {
          name: 'Ollama',
          configured: !!(process.env.OLLAMA_HOST || 'http://localhost:11434'),
          requirements: [
            'Ollama service running on http://localhost:11434',
            'Model installed (e.g., ollama pull llama3.2:latest)',
          ]
        };
      
      case 'grok':
        return {
          name: 'Grok (xAI)',
          configured: !!(process.env.XAI_API_KEY),
          requirements: [
            'XAI_API_KEY environment variable',
          ]
        };
      
      default:
        return {
          name: provider,
          configured: false,
          requirements: ['Unknown provider requirements'],
        };
    }
  }
}