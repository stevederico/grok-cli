import { Provider, ProviderFactory, ProviderConfig } from './index.js';
import { createXAIProvider } from './xai.js';
import { createOllamaProvider } from './ollama.js';

// Re-export types for convenience
export type { Provider, ProviderFactory, ProviderConfig } from './index.js';

/**
 * Registry of all available providers
 */
const providers = new Map<string, ProviderFactory>();

// Register built-in providers
providers.set('xai', createXAIProvider);
providers.set('ollama', createOllamaProvider);

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
      switch (providerName) {
        case 'xai':
          if (!process.env.XAI_API_KEY) {
            issues.push('XAI_API_KEY environment variable not set');
          }
          break;
        case 'ollama':
          // For Ollama, we could check if the service is reachable
          try {
            const response = await fetch('http://localhost:11434/api/tags', { 
              signal: AbortSignal.timeout(3000) // 3 second timeout
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
          break;
        default:
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
  
  // Check if XAI API key is available
  if (process.env.XAI_API_KEY) {
    return 'xai';
  }
  
  // Fall back to Ollama
  return 'ollama';
}
