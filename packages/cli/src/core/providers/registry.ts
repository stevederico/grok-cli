import { Provider, ProviderFactory, ProviderConfig } from './index.js';
import { createXAIProvider } from './xai.js';
import { createOllamaProvider } from './ollama.js';
import { createOpenAIProvider } from './openai.js';
import { createAnthropicProvider } from './anthropic.js';
import { createGoogleProvider } from './google.js';
import { createOpenRouterProvider } from './openrouter.js';
import { createGroqProvider } from './groq.js';
import { createAzureProvider } from './azure.js';
import { createGitHubProvider } from './github.js';
import { createCustomProvider } from './custom.js';

// Re-export types for convenience
export type { Provider, ProviderFactory, ProviderConfig } from './index.js';

/**
 * Registry of all available providers
 */
const providers = new Map<string, ProviderFactory>();

// Register built-in providers
providers.set('xai', createXAIProvider);
providers.set('openai', createOpenAIProvider);
providers.set('anthropic', createAnthropicProvider);
providers.set('google', createGoogleProvider);
providers.set('openrouter', createOpenRouterProvider);
providers.set('groq', createGroqProvider);
providers.set('ollama', createOllamaProvider);
providers.set('azure', createAzureProvider);
providers.set('github', createGitHubProvider);
providers.set('custom', createCustomProvider);

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

/**
 * Maps provider names to their required environment variable for API key auth.
 * Ollama is excluded — it needs no API key.
 */
export const PROVIDER_ENV_VAR_MAP: Record<string, string> = {
  xai: 'XAI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  azure: 'AZURE_OPENAI_API_KEY',
  github: 'GITHUB_TOKEN',
  custom: 'CUSTOM_API_KEY',
};

/**
 * Returns the environment variable name for a provider's API key.
 * @param providerName The provider name (e.g., 'xai', 'anthropic')
 * @returns The env var name, or undefined for providers that don't need a key (e.g., 'ollama')
 */
export function getEnvVarForProvider(providerName: string): string | undefined {
  return PROVIDER_ENV_VAR_MAP[providerName];
}

/**
 * Validate if a provider is properly configured
 */
export async function validateProvider(providerName: string): Promise<{ healthy: boolean; issues: string[] }> {
  const issues: string[] = [];

  if (!hasProvider(providerName)) {
    issues.push(`Provider "${providerName}" is not available`);
    return { healthy: false, issues };
  }

  try {
    const provider = getProvider(providerName);

    if (!provider.isConfigured()) {
      const envVar = getEnvVarForProvider(providerName);
      if (envVar) {
        issues.push(`${envVar} environment variable not set`);
      } else if (providerName === 'ollama') {
        try {
          const response = await fetch('http://localhost:11434/api/tags', {
            signal: AbortSignal.timeout(3000)
          });
          if (!response.ok) {
            issues.push('Ollama service not responding (check if Ollama is running)');
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'TimeoutError') {
            issues.push('Ollama service timeout - check if Ollama is running and responsive');
          } else {
            issues.push('Ollama service not reachable at http://localhost:11434 (check if Ollama is running)');
          }
        }
      } else {
        issues.push(`Provider "${providerName}" is not properly configured`);
      }
    }
  } catch (error) {
    issues.push(`Error validating provider: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { healthy: issues.length === 0, issues };
}

/**
 * Get the best available provider based on configuration
 */
export function getDefaultProvider(): string {
  // Check environment variable first
  if (process.env.GROKCLI_PROVIDER && hasProvider(process.env.GROKCLI_PROVIDER)) {
    return process.env.GROKCLI_PROVIDER;
  }

  // Check available API keys in priority order
  if (process.env.XAI_API_KEY) return 'xai';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'google';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) return 'azure';
  if (process.env.GITHUB_TOKEN) return 'github';
  if (process.env.CUSTOM_API_KEY && process.env.CUSTOM_BASE_URL) return 'custom';

  // Fall back to Ollama
  return 'ollama';
}
