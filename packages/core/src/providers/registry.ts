import { Provider, ProviderFactory, ProviderConfig } from './index.js';
import { createGrokProvider } from './grok.js';
import { createOllamaProvider } from './ollama.js';
import {
  createOpenAICoreProvider,
  createAnthropicCoreProvider,
  createGoogleCoreProvider,
  createOpenRouterCoreProvider,
  createGroqCoreProvider,
  createAzureCoreProvider,
  createGitHubCoreProvider,
  createCustomCoreProvider,
} from './openai-compatible.js';

// Re-export types for convenience
export type { Provider, ProviderFactory, ProviderConfig } from './index.js';

/**
 * Registry of all available providers
 */
const providers = new Map<string, ProviderFactory>();

// Register built-in providers
providers.set('grok', createGrokProvider);
providers.set('xai', createGrokProvider); // alias
providers.set('openai', createOpenAICoreProvider);
providers.set('anthropic', createAnthropicCoreProvider);
providers.set('google', createGoogleCoreProvider);
providers.set('openrouter', createOpenRouterCoreProvider);
providers.set('groq', createGroqCoreProvider);
providers.set('ollama', createOllamaProvider);
providers.set('azure', createAzureCoreProvider);
providers.set('github', createGitHubCoreProvider);
providers.set('custom', createCustomCoreProvider);

/**
 * Get a provider instance by name
 */
export function getProvider(name: string, config: ProviderConfig = {}): Provider {
  const factory = providers.get(name);
  if (!factory) {
    throw new Error(`Unknown provider "${name}". Available providers: ${Array.from(providers.keys()).join(', ')}`);
  }
  return factory(config);
}

/**
 * Register a new provider
 */
export function registerProvider(name: string, factory: ProviderFactory): void {
  providers.set(name, factory);
}

/**
 * Get list of available provider names
 */
export function getAvailableProviders(): string[] {
  return Array.from(providers.keys());
}

/**
 * Check if a provider is registered
 */
export function hasProvider(name: string): boolean {
  return providers.has(name);
}
