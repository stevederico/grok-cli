import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class XAIProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('xai', config, {
      apiKey: process.env.XAI_API_KEY,
      model: process.env.XAI_MODEL || 'grok-code-fast-1',
      endpoint: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
      displayName: 'XAI',
    });
  }
}

export function createXAIProvider(config?: ProviderConfig): Provider {
  return new XAIProvider(config);
}
