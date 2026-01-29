import { Provider, ProviderConfig } from './index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class GitHubModelsProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig = {}) {
    super('github', config, {
      apiKey: process.env.GITHUB_TOKEN,
      model: process.env.GITHUB_MODEL || 'gpt-4o',
      endpoint: process.env.GITHUB_MODELS_BASE_URL || 'https://models.inference.ai.azure.com/v1',
      displayName: 'GitHub Models',
    });
  }
}

export function createGitHubProvider(config?: ProviderConfig): Provider {
  return new GitHubModelsProvider(config);
}
