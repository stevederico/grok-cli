/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../core/index.js';
import { loadEnvironment } from './config.js';

export const validateAuthMethod = (authMethod: string, provider?: string): string | null => {
  loadEnvironment();

  if (authMethod === AuthType.API_KEY) {
    if (!process.env.XAI_API_KEY) {
      return 'XAI_API_KEY environment variable is not set. Please set it and try again.';
    }
    return null;
  }

  // LOCAL (Ollama) needs no key
  return null;
};
