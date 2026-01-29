/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DEFAULT_GROK_MODEL,
  DEFAULT_GROK_FLASH_MODEL,
} from '../config/models.js';

/**
 * Checks if the default "pro" model is rate-limited and returns a fallback "flash"
 * model if necessary. This function is designed to be silent.
 * @param apiKey The API key to use for the check.
 * @param currentConfiguredModel The model currently configured in settings.
 * @returns An object indicating the model to use, whether a switch occurred,
 *          and the original model if a switch happened.
 */
export async function getEffectiveModel(
  apiKey: string,
  currentConfiguredModel: string,
): Promise<string> {
  if (currentConfiguredModel !== DEFAULT_GROK_MODEL) {
    // Only check if the user is trying to use the specific pro model we want to fallback from.
    return currentConfiguredModel;
  }

  // Model check is a no-op for xAI provider - always use the configured model
  return currentConfiguredModel;
}
