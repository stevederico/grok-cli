/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 127_999;

export function tokenLimit(model: Model): TokenCount {
  // XAI/Grok models
  if (model.startsWith('grok-')) {
    return 256_000;
  }

  // OpenAI models
  if (model.startsWith('gpt-4o') || model.startsWith('gpt-4-turbo') || model === 'gpt-4.1' || model === 'gpt-4.1-mini' || model === 'gpt-4.1-nano') {
    return 128_000;
  }
  if (model === 'gpt-4') {
    return 8_192;
  }
  if (model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) {
    return 200_000;
  }

  // Anthropic models
  if (model.startsWith('claude-')) {
    return 200_000;
  }

  // Google Gemini models
  if (model.startsWith('gemini-')) {
    return 1_000_000;
  }

  // Groq-hosted models (context varies, use safe default)
  if (model.startsWith('llama-') || model.startsWith('mixtral-')) {
    return 128_000;
  }

  return DEFAULT_TOKEN_LIMIT;
}
