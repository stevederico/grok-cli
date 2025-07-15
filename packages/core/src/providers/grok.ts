import { Provider, ProviderConfig, QueryOptions } from './index.js';

export class GrokProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('grok', config);
    this.apiKey = config.apiKey || process.env.XAI_API_KEY;
    this.model = config.model || process.env.XAI_MODEL || 'grok-4-0709';
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
      
      console.log(`🚀 Grok - Making request to: ${fullEndpoint}`);
      console.log(`📦 Grok - Using model: ${model}`);
      console.log(`🔑 Grok - API key configured: ${this.apiKey ? 'YES' : 'NO'}`);
      console.log(`🌡️  Grok - Temperature: ${temperature}`);
      console.debug(`[DEBUG] Grok - Full request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(fullEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`📡 Grok - Response status: ${response.status} ${response.statusText}`);
      console.log(`📍 Grok - Response URL: ${response.url}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Grok - Error response body:`, errorText);
        console.error(`❌ Grok - Response headers:`, Object.fromEntries(response.headers.entries()));
        throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Grok - Success! Response received`);
      console.debug(`[DEBUG] Grok - Full response:`, JSON.stringify(data, null, 2));
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      
      throw new Error('Unexpected response format from Grok API');
    } catch (error) {
      console.error(`💥 Grok - Query failed with error:`, error);
      throw new Error(`Grok query failed: ${(error as Error).message}`);
    }
  }
}

export function createGrokProvider(config?: ProviderConfig): Provider {
  return new GrokProvider(config);
}
