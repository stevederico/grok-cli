/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { getAvailableProviders, validateProvider } from '../../core/index.js';

interface ProviderDialogProps {
  /** Callback function when a provider is selected */
  onSelect: (providerName: string | undefined) => void;
  /** Current provider */
  currentProvider: string;
}

interface ProviderItem {
  label: string;
  value: string;
  healthStatus?: string;
  issues?: string[];
}

export function ProviderDialog({
  onSelect,
  currentProvider,
}: ProviderDialogProps): React.JSX.Element {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProviders() {
      setLoading(true);
      const availableProviders = getAvailableProviders();
      const providerItems: ProviderItem[] = [];

      for (const providerName of availableProviders) {
        try {
          const validation = await validateProvider(providerName);
          const healthStatus = validation.healthy ? '✅' : '⚠️';
          providerItems.push({
            label: `${providerName} ${healthStatus}${providerName === currentProvider ? ' (current)' : ''}`,
            value: providerName,
            healthStatus,
            issues: validation.issues,
          });
        } catch (error) {
          providerItems.push({
            label: `${providerName} ❌${providerName === currentProvider ? ' (current)' : ''}`,
            value: providerName,
            healthStatus: '❌',
            issues: [error instanceof Error ? error.message : String(error)],
          });
        }
      }

      setProviders(providerItems);
      setLoading(false);
    }

    loadProviders();
  }, [currentProvider]);

  const initialProviderIndex = providers.findIndex(
    (item) => item.value === currentProvider,
  );

  const handleProviderSelect = (providerName: string) => {
    onSelect(providerName);
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
        <Text>Loading providers...</Text>
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
        <Text bold>🔌 Select AI Provider</Text>
        <Box marginTop={1}>
          <RadioButtonSelect
            items={providers}
            initialIndex={initialProviderIndex >= 0 ? initialProviderIndex : 0}
            onSelect={handleProviderSelect}
            isFocused={true}
          />
        </Box>
        
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            ✅ = Healthy  ⚠️ = Issues  ❌ = Error
          </Text>
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
