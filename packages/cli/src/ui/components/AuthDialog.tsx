/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import {
  AuthType,
  getAvailableProviders,
  validateProvider,
  getEnvVarForProvider,
  GROKCLI_CONFIG_DIR,
} from '../../core/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

interface AuthDialogProps {
  onSelect: (authMethod: string | undefined, scope: SettingScope) => void;
  onHighlight: (authMethod: string | undefined) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
  provider?: string;
}

interface ProviderItem {
  label: string;
  value: string;
}

type DialogStep = 'provider' | 'key-input';

/**
 * Auth dialog with provider selection and inline API key input.
 * Step 1: Select a provider from the full list with health/key status.
 * Step 2: For providers that need a key, show a masked text input.
 * Saves keys to ~/.grok-cli/.env and applies to process.env immediately.
 */
export function AuthDialog({
  onSelect,
  onHighlight,
  settings,
  initialErrorMessage,
  provider,
}: AuthDialogProps): React.JSX.Element {
  const [step, setStep] = useState<DialogStep>('provider');
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadProviders() {
      setLoading(true);
      const available = getAvailableProviders();
      const items: ProviderItem[] = [];

      for (const name of available) {
        const envVar = getEnvVarForProvider(name);
        const hasKey = envVar ? !!process.env[envVar] : false;
        let statusIcon = '';

        try {
          const validation = await validateProvider(name);
          statusIcon = validation.healthy ? ' ✅' : ' ⚠️';
        } catch {
          statusIcon = ' ❌';
        }

        const keyStatus = envVar
          ? hasKey ? ' (key set)' : ' (no key)'
          : '';

        items.push({
          label: `${name}${statusIcon}${keyStatus}`,
          value: name,
        });
      }

      setProviders(items);
      setLoading(false);
    }

    loadProviders();
  }, []);

  /** Write an env var to ~/.grok-cli/.env and process.env */
  const saveApiKey = async (providerName: string, apiKey: string) => {
    const envVar = getEnvVarForProvider(providerName);
    if (!envVar) return;

    const configDir = path.join(os.homedir(), GROKCLI_CONFIG_DIR);
    const envFilePath = path.join(configDir, '.env');

    await fs.mkdir(configDir, { recursive: true });
    let envContent = '';
    try {
      envContent = await fs.readFile(envFilePath, 'utf-8');
    } catch {
      envContent = '';
    }

    const line = `${envVar}=${apiKey}`;
    if (envContent.includes(`${envVar}=`)) {
      envContent = envContent.replace(new RegExp(`^${envVar}=.*$`, 'm'), line);
    } else {
      envContent = envContent ? envContent.trimEnd() + '\n' + line + '\n' : line + '\n';
    }

    await fs.writeFile(envFilePath, envContent, 'utf-8');
    process.env[envVar] = apiKey;
  };

  const handleProviderSelect = (providerName: string) => {
    const envVar = getEnvVarForProvider(providerName);

    if (!envVar) {
      // Ollama / no-key provider — select directly
      setErrorMessage(null);
      onSelect(AuthType.LOCAL, SettingScope.User);
      return;
    }

    setSelectedProvider(providerName);
    setKeyInput('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setStep('key-input');
  };

  const handleKeySubmit = async () => {
    if (!selectedProvider) return;

    const envVar = getEnvVarForProvider(selectedProvider);
    if (!envVar) return;

    const existingKey = process.env[envVar];

    // Empty input with existing key — keep current key
    if (!keyInput && existingKey) {
      setErrorMessage(null);
      onSelect(AuthType.API_KEY, SettingScope.User);
      return;
    }

    if (!keyInput) {
      setErrorMessage('API key cannot be empty.');
      return;
    }

    try {
      await saveApiKey(selectedProvider, keyInput);
      setSuccessMessage(`${envVar} saved and loaded.`);
      setErrorMessage(null);
      // Brief delay so user sees confirmation, then close
      setTimeout(() => {
        onSelect(AuthType.API_KEY, SettingScope.User);
      }, 500);
    } catch (e) {
      setErrorMessage(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useInput((input, key) => {
    if (step === 'provider') {
      if (key.escape) {
        if (settings.merged.selectedAuthType === undefined) {
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
      return;
    }

    // key-input step
    if (key.escape) {
      setStep('provider');
      setSelectedProvider(null);
      setKeyInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    if (key.return) {
      void handleKeySubmit();
      return;
    }

    if (key.backspace || key.delete) {
      setKeyInput((prev) => prev.slice(0, -1));
      return;
    }

    // Printable characters
    if (input && !key.ctrl && !key.meta) {
      setKeyInput((prev) => prev + input);
    }
  });

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text>Loading providers...</Text>
      </Box>
    );
  }

  if (step === 'key-input' && selectedProvider) {
    const envVar = getEnvVarForProvider(selectedProvider) || '';
    const existingKey = process.env[envVar];
    const masked = '*'.repeat(keyInput.length);

    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Enter {envVar}:</Text>
        {existingKey && (
          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              Key already set. Press Enter to keep current, or type a new key.
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text>{'> '}</Text>
          <Text>{masked || (existingKey ? '(current key)' : '')}</Text>
          <Text color={Colors.AccentGreen}>{'█'}</Text>
        </Box>
        {errorMessage && (
          <Box marginTop={1}>
            <Text color={Colors.AccentRed}>{errorMessage}</Text>
          </Box>
        )}
        {successMessage && (
          <Box marginTop={1}>
            <Text color={Colors.AccentGreen}>{successMessage}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={Colors.Gray}>(Enter to save, ESC to go back)</Text>
        </Box>
      </Box>
    );
  }

  // Provider selection step
  const initialIndex = providers.findIndex(
    (item) => item.value === (provider || 'xai'),
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Provider</Text>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={providers}
          initialIndex={initialIndex >= 0 ? initialIndex : 0}
          onSelect={handleProviderSelect}
          onHighlight={(value: string) => onHighlight(value)}
          isFocused={true}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          ✅ = Healthy  ⚠️ = Issues  (key set) / (no key)
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Enter to select, ESC to cancel)</Text>
      </Box>
    </Box>
  );
}
