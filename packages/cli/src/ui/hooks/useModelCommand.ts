/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { Config } from '../../core/index.js';
import { type HistoryItem, MessageType } from '../types.js';

interface UseModelCommandReturn {
  isModelDialogOpen: boolean;
  openModelDialog: () => void;
  handleModelSelect: (modelName: string | undefined) => void;
}

export const useModelCommand = (
  config: Config,
  addItem: (item: Omit<HistoryItem, 'id'>, timestamp: number) => void,
): UseModelCommandReturn => {
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);

  const openModelDialog = useCallback(() => {
    setIsModelDialogOpen(true);
  }, []);

  const handleModelSelect = useCallback(
    (modelName: string | undefined) => {
      setIsModelDialogOpen(false);
      
      if (modelName) {
        config.setModel(modelName);
        addItem(
          {
            type: MessageType.INFO,
            text: `✅ Successfully switched to model: ${modelName}`,
          },
          Date.now(),
        );
      }
    },
    [config, addItem],
  );

  return {
    isModelDialogOpen,
    openModelDialog,
    handleModelSelect,
  };
};
