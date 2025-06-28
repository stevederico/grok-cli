/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/index.js';
import { loadEnvironment } from './config.js';

export const validateAuthMethod = (authMethod: string, provider?: string): string | null => {
  loadEnvironment();
  
  const effectiveProvider = provider || process.env.GROKCLI_PROVIDER || 'ollama';
  
  // Skip authentication for providers that don't require keys
  if (effectiveProvider === 'ollama') {
    return null;
  }
  
  return null;
};
