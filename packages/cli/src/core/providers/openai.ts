import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('openai', config, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      endpoint: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      displayName: 'OpenAI',
    });
  }
}

export function createOpenAIProvider(config?: ProviderConfig): Provider {
  return new OpenAIProvider(config);
}
