import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('groq', config, {
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      endpoint: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      displayName: 'Groq',
    });
  }
}

export function createGroqProvider(config?: ProviderConfig): Provider {
  return new GroqProvider(config);
}
