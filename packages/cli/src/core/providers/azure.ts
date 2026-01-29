import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class AzureOpenAIProvider extends OpenAICompatibleProvider {
  private deployment: string;
  private apiVersion: string;

  constructor(config: ProviderConfig = {}) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const apiVersion = process.env.AZURE_API_VERSION || '2024-10-21';

    // Build the Azure-style base URL (without /chat/completions — that gets appended by the parent)
    const baseUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`;

    super('azure', config, {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      model: deployment,
      endpoint: baseUrl,
      displayName: 'Azure OpenAI',
    });

    this.deployment = deployment;
    this.apiVersion = apiVersion;
  }

  protected extraHeaders(): Record<string, string> {
    return {
      'api-key': this.apiKey || '',
    };
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!process.env.AZURE_OPENAI_ENDPOINT;
  }

  async getModels(): Promise<string[]> {
    // Azure doesn't expose a /models list the same way; return the configured deployment
    return [this.deployment];
  }

  async queryWithTools(prompt: string, tools: any[], options: any = {}): Promise<any> {
    // Inject api-version query param into the endpoint
    const origEndpoint = this.endpoint;
    (this as any).endpoint = `${origEndpoint}?api-version=${this.apiVersion}`;
    try {
      return await super.queryWithTools(prompt, tools, options);
    } finally {
      (this as any).endpoint = origEndpoint;
    }
  }

  async queryWithToolsStreaming(
    prompt: string,
    tools: any[],
    options: any,
    onChunk: any,
    signal?: AbortSignal,
  ): Promise<any> {
    const origEndpoint = this.endpoint;
    (this as any).endpoint = `${origEndpoint}?api-version=${this.apiVersion}`;
    try {
      return await super.queryWithToolsStreaming(prompt, tools, options, onChunk, signal);
    } finally {
      (this as any).endpoint = origEndpoint;
    }
  }
}

export function createAzureProvider(config?: ProviderConfig): Provider {
  return new AzureOpenAIProvider(config);
}
