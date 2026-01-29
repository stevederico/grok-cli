import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class CustomProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('custom', config, {
      apiKey: process.env.CUSTOM_API_KEY,
      model: process.env.CUSTOM_MODEL || 'default',
      endpoint: process.env.CUSTOM_BASE_URL || 'http://localhost:8080/v1',
      displayName: 'Custom',
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!process.env.CUSTOM_BASE_URL;
  }
}

export function createCustomProvider(config?: ProviderConfig): Provider {
  return new CustomProvider(config);
}
