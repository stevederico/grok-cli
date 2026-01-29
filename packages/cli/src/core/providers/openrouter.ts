import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('openrouter', config, {
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      endpoint: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      displayName: 'OpenRouter',
    });
  }

  protected extraHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://github.com/stevederico/grok-cli',
      'X-Title': 'grok-cli',
    };
  }
}

export function createOpenRouterProvider(config?: ProviderConfig): Provider {
  return new OpenRouterProvider(config);
}
