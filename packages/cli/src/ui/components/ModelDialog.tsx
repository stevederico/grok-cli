/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { getProvider } from '../../core/index.js';

interface ModelDialogProps {
  /** Callback function when a model is selected */
  onSelect: (modelName: string | undefined) => void;
  /** Current provider */
  currentProvider: string;
  /** Current model */
  currentModel: string;
}

interface ModelItem {
  label: string;
  value: string;
}

export function ModelDialog({
  onSelect,
  currentProvider,
  currentModel,
}: ModelDialogProps): React.JSX.Element {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      setError(null);
      
      try {
        const provider = getProvider(currentProvider);
        const availableModels = await provider.getModels();
        
        if (availableModels.length === 0) {
          setError(`No models available for ${currentProvider}`);
          setModels([]);
        } else {
          const modelItems: ModelItem[] = availableModels.map((modelName) => ({
            label: `${modelName}${modelName === currentModel ? ' (current)' : ''}`,
            value: modelName,
          }));
          setModels(modelItems);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setModels([]);
      }
      
      setLoading(false);
    }

    loadModels();
  }, [currentProvider, currentModel]);

  const initialModelIndex = models.findIndex(
    (item) => item.value === currentModel,
  );

  const handleModelSelect = (modelName: string) => {
    onSelect(modelName);
  };

  useInput((input, key) => {
    if (key.escape) {
      onSelect(undefined);
    }
  });

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        width="100%"
      >
        <Text>Loading models for {currentProvider}...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={1}
        paddingRight={1}
        width="100%"
      >
        <Text bold>🤖 Select AI Model</Text>
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>❌ Error: {error}</Text>
        </Box>
        
        {currentProvider === 'ollama' && (
          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              💡 Install a model: ollama pull llama3.2
            </Text>
          </Box>
        )}
        
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            (Press ESC to cancel)
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={1}
      paddingRight={1}
      width="100%"
    >
      <Box flexDirection="column">
        <Text bold>🤖 Select AI Model ({currentProvider})</Text>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={models}
            initialIndex={initialModelIndex >= 0 ? initialModelIndex : 0}
            onSelect={handleModelSelect}
            isFocused={true}
          />
        </Box>
        
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            (Use ↑↓ to navigate, Enter to select, ESC to cancel)
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
