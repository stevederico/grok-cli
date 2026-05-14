import { Provider, ProviderConfig, QueryOptions } from './index.js';

export class GrokProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('grok', config);
    this.apiKey = config.apiKey || process.env.XAI_API_KEY;
    this.model = config.model || process.env.XAI_MODEL || 'grok-4';
    this.endpoint = config.endpoint || 'https://api.x.ai/v1';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('Grok provider not configured. Set XAI_API_KEY');
    }

    try {
      const response = await fetch(`${this.endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      return data.data?.map((m: any) => m.id) || [];
    } catch (error) {
      throw new Error(`Failed to fetch Grok models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Grok provider not configured. Set XAI_API_KEY');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      const requestBody = {
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: options.maxTokens || 2048,
      };
      
      const fullEndpoint = `${this.endpoint}/chat/completions`;

      const response = await fetch(fullEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      
      throw new Error('Unexpected response format from Grok API');
    } catch (error) {
      throw new Error(`Grok query failed: ${(error as Error).message}`);
    }
  }
}

export function createGrokProvider(config?: ProviderConfig): Provider {
  return new GrokProvider(config);
}
