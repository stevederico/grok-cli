/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, getEnvVarForProvider } from '../core/index.js';
import { loadEnvironment } from './config.js';

/**
 * Validates that the required credentials are present for the given auth method.
 * When a provider is specified, looks up the provider-specific env var via the
 * registry. Falls back to checking XAI_API_KEY when no provider is given.
 * @param authMethod - The authentication method (e.g., AuthType.API_KEY)
 * @param provider - Optional provider name (e.g., 'xai', 'anthropic', 'ollama')
 * @returns An error message string if validation fails, or null if valid
 */
export const validateAuthMethod = (authMethod: string, provider?: string): string | null => {
  loadEnvironment();

  if (authMethod === AuthType.API_KEY) {
    if (provider) {
      const envVar = getEnvVarForProvider(provider);
      if (envVar && !process.env[envVar]) {
        return `${envVar} is not set. Use /auth to configure it.`;
      }
      // Provider doesn't need a key (e.g., ollama), or key is present
      return null;
    }

    // Backward compat: no provider specified, check XAI_API_KEY
    if (!process.env.XAI_API_KEY) {
      return 'XAI_API_KEY environment variable is not set. Please set it and try again.';
    }
    return null;
  }

  // LOCAL (Ollama) needs no key
  return null;
};
