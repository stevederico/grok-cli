/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { getProvider, ProviderConfig } from './providers/registry.js';
import { QueryOptions } from './providers/index.js';

/**
 * High-level query function that abstracts provider selection
 */
export async function runQuery(
  prompt: string, 
  providerName: string = 'google',
  config: ProviderConfig = {},
  options: QueryOptions = {}
): Promise<string> {
  try {
    const provider = getProvider(providerName, config);
    
    if (!provider.isConfigured()) {
      throw new Error(`Provider "${providerName}" is not properly configured. Check your API keys.`);
    }
    
    return await provider.query(prompt, options);
  } catch (error) {
    throw new Error(`Query failed: ${(error as Error).message}`);
  }
}

/**
 * List available providers
 */
export { getAvailableProviders } from './providers/registry.js';

/**
 * Get provider models
 */
export async function getProviderModels(
  providerName: string, 
  config: ProviderConfig = {}
): Promise<string[]> {
  const provider = getProvider(providerName, config);
  return provider.getModels();
}
