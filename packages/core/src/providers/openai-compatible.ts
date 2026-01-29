import { Provider, ProviderConfig, QueryOptions } from './index.js';

/**
 * Minimal OpenAI-compatible provider for the core package.
 * The CLI package has the full-featured version with streaming, retry, and tool calling.
 */
export class OpenAICompatibleCoreProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;
  private displayName: string;

  constructor(
    name: string,
    config: ProviderConfig,
    defaults: { apiKey?: string; model: string; endpoint: string; displayName?: string },
    private _extraHeaders: Record<string, string> = {},
  ) {
    super(name, config);
    this.apiKey = config.apiKey || defaults.apiKey;
    this.model = config.model || defaults.model;
    this.endpoint = config.endpoint || defaults.endpoint;
    this.displayName = defaults.displayName || name.toUpperCase();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error(`${this.displayName} provider not configured`);
    }

    const response = await fetch(`${this.endpoint}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...this._extraHeaders,
      },
    });
    const data = await response.json();
    return data.data?.map((m: any) => m.id) || [];
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(`${this.displayName} provider not configured`);
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...this._extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: options.maxTokens || 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.displayName} API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.choices?.[0]?.message) {
      return data.choices[0].message.content;
    }
    throw new Error(`Unexpected response format from ${this.displayName} API`);
  }
}

export function createOpenAICoreProvider(config: ProviderConfig = {}): Provider {
  return new OpenAICompatibleCoreProvider('openai', config, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    endpoint: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    displayName: 'OpenAI',
  });
}

export function createAnthropicCoreProvider(config: ProviderConfig = {}): Provider {
  // Anthropic uses a different API, but for core's basic query(), we provide a minimal wrapper
  return new AnthropicCoreProvider(config);
}

export function createGoogleCoreProvider(config: ProviderConfig = {}): Provider {
  return new GoogleCoreProvider(config);
}

export function createOpenRouterCoreProvider(config: ProviderConfig = {}): Provider {
  return new OpenAICompatibleCoreProvider('openrouter', config, {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
    endpoint: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    displayName: 'OpenRouter',
  }, {
    'HTTP-Referer': 'https://github.com/stevederico/grok-cli',
    'X-Title': 'grok-cli',
  });
}

export function createGroqCoreProvider(config: ProviderConfig = {}): Provider {
  return new OpenAICompatibleCoreProvider('groq', config, {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    endpoint: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    displayName: 'Groq',
  });
}

export function createAzureCoreProvider(config: ProviderConfig = {}): Provider {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const baseUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`;

  return new OpenAICompatibleCoreProvider('azure', config, {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    model: deployment,
    endpoint: baseUrl,
    displayName: 'Azure OpenAI',
  }, {
    'api-key': process.env.AZURE_OPENAI_API_KEY || '',
  });
}

export function createGitHubCoreProvider(config: ProviderConfig = {}): Provider {
  return new OpenAICompatibleCoreProvider('github', config, {
    apiKey: process.env.GITHUB_TOKEN,
    model: process.env.GITHUB_MODEL || 'gpt-4o',
    endpoint: process.env.GITHUB_MODELS_BASE_URL || 'https://models.inference.ai.azure.com/v1',
    displayName: 'GitHub Models',
  });
}

export function createCustomCoreProvider(config: ProviderConfig = {}): Provider {
  return new OpenAICompatibleCoreProvider('custom', config, {
    apiKey: process.env.CUSTOM_API_KEY,
    model: process.env.CUSTOM_MODEL || 'default',
    endpoint: process.env.CUSTOM_BASE_URL || 'http://localhost:8080/v1',
    displayName: 'Custom',
  });
}

class AnthropicCoreProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('anthropic', config);
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    this.endpoint = config.endpoint || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  }

  isConfigured(): boolean { return !!this.apiKey; }

  async getModels(): Promise<string[]> {
    return ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-5-20241022'];
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    if (!this.isConfigured()) throw new Error('Anthropic provider not configured. Set ANTHROPIC_API_KEY');

    const response = await fetch(`${this.endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || this.model,
        max_tokens: options.maxTokens || 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') || '';
  }
}

class GoogleCoreProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('google', config);
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.model = config.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.endpoint = config.endpoint || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  }

  isConfigured(): boolean { return !!this.apiKey; }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) throw new Error('Google provider not configured. Set GEMINI_API_KEY');
    const response = await fetch(`${this.endpoint}/models?key=${this.apiKey}`);
    const data = await response.json();
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    if (!this.isConfigured()) throw new Error('Google provider not configured. Set GEMINI_API_KEY');

    const model = options.model || this.model;
    const response = await fetch(`${this.endpoint}/models/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  }
}
