/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 128000;

export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // XAI/Grok models — most current Grok models use 128k–1M+ context
  switch (model) {
    case 'grok-4':
    case 'grok-4-0709':
    case 'grok-3':
    case 'grok-3-mini':
    default:
      return DEFAULT_TOKEN_LIMIT;
  }
}
