/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { Config, getProvider } from '../../core/index.js';
import { type HistoryItem, MessageType } from '../types.js';

interface UseProviderCommandReturn {
  isProviderDialogOpen: boolean;
  openProviderDialog: () => void;
  handleProviderSelect: (providerName: string | undefined) => void;
}

export const useProviderCommand = (
  config: Config,
  addItem: (item: Omit<HistoryItem, 'id'>, timestamp: number) => void,
): UseProviderCommandReturn => {
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);

  const openProviderDialog = useCallback(() => {
    setIsProviderDialogOpen(true);
  }, []);

  const handleProviderSelect = useCallback(
    async (providerName: string | undefined) => {
      setIsProviderDialogOpen(false);
      
      if (providerName) {
        try {
          // Switch the provider
          config.setProvider(providerName);
          
          // Get the provider's default model and switch to it
          const provider = getProvider(providerName);
          let defaultModel: string;
          
          if (providerName === 'xai') {
            defaultModel = process.env.XAI_MODEL || 'grok-code-fast-1';
          } else if (providerName === 'ollama') {
            defaultModel = process.env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
          } else {
            // For other providers, try to get the first available model
            try {
              const models = await provider.getModels();
              defaultModel = models.length > 0 ? models[0] : 'unknown';
            } catch {
              defaultModel = 'unknown';
            }
          }
          
          // Update the model
          config.setModel(defaultModel);
          
          addItem(
            {
              type: MessageType.INFO,
              text: `✅ Successfully switched to provider: ${providerName} (model: ${defaultModel})`,
            },
            Date.now(),
          );
        } catch (error) {
          addItem(
            {
              type: MessageType.ERROR,
              text: `❌ Failed to switch provider: ${error instanceof Error ? error.message : String(error)}`,
            },
            Date.now(),
          );
        }
      }
    },
    [config, addItem],
  );

  return {
    isProviderDialogOpen,
    openProviderDialog,
    handleProviderSelect,
  };
};
