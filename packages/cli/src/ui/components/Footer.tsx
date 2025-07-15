/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { shortenPath, tildeifyPath, tokenLimit } from '../../core/index.js';
import { ConsoleSummaryDisplay } from './ConsoleSummaryDisplay.js';
import process from 'node:process';
import { MemoryUsageDisplay } from './MemoryUsageDisplay.js';
import { getCliVersion } from '../../utils/version.js';
import { BUILD_NUMBER } from '../../generated/build-info.js';

interface FooterProps {
  model: string;
  targetDir: string;
  branchName?: string;
  debugMode: boolean;
  debugMessage: string;
  corgiMode: boolean;
  errorCount: number;
  showErrorDetails: boolean;
  showMemoryUsage?: boolean;
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  showVersionInfo?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  model,
  targetDir,
  branchName,
  debugMode,
  debugMessage,
  corgiMode,
  errorCount,
  showErrorDetails,
  showMemoryUsage,
  totalTokenCount,
  showVersionInfo = true,
}) => {
  const limit = tokenLimit(model);
  const percentage = totalTokenCount / limit;
  const [version, setVersion] = React.useState<string>('');

  React.useEffect(() => {
    if (showVersionInfo) {
      getCliVersion().then(setVersion);
    }
  }, [showVersionInfo]);

  return (
    <Box marginTop={1} justifyContent="space-between" width="100%">
      <Box flexDirection="column">
        <Box>
          <Text color={Colors.LightBlue}>
            {targetDir.split('/').pop() || targetDir}
            {branchName && <Text color={Colors.Gray}> ({branchName}*)</Text>}
          </Text>
          {debugMode && (
            <Text color={Colors.AccentRed}>
              {' ' + (debugMessage || '--debug')}
            </Text>
          )}
        </Box>
        {showVersionInfo && version && (
          <Box>
            <Text color={Colors.Gray}>
              grok-cli v{version}
              {BUILD_NUMBER && <Text> (build {BUILD_NUMBER})</Text>}
            </Text>
          </Box>
        )}
      </Box>

      {/* Middle Section: Centered Sandbox Info */}
      <Box
        flexGrow={1}
        alignItems="center"
        justifyContent="center"
        display="flex"
      >
        {process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec' ? (
          <Text color="green">
            {process.env.SANDBOX.replace(/^grokcli-(?:cli-)?/, '')}
          </Text>
        ) : process.env.SANDBOX === 'sandbox-exec' ? (
          <Text color={Colors.AccentYellow}>
            MacOS Seatbelt{' '}
            <Text color={Colors.Gray}>({process.env.SEATBELT_PROFILE})</Text>
          </Text>
        ) : null}
      </Box>

      {/* Right Section: AI Model Label and Console Summary */}
      <Box alignItems="center">
        <Text color={Colors.AccentBlue}>
          {' '}
          {model}{' '}
          <Text color={Colors.Gray}>
            ({((1 - percentage) * 100).toFixed(0)}% context left)
          </Text>
        </Text>
        {corgiMode && (
          <Text>
            <Text color={Colors.Gray}>| </Text>
            <Text color={Colors.AccentRed}>▼</Text>
            <Text color={Colors.Foreground}>(´</Text>
            <Text color={Colors.AccentRed}>ᴥ</Text>
            <Text color={Colors.Foreground}>`)</Text>
            <Text color={Colors.AccentRed}>▼ </Text>
          </Text>
        )}
        {!showErrorDetails && errorCount > 0 && (
          <Box>
            <Text color={Colors.Gray}>| </Text>
            <ConsoleSummaryDisplay errorCount={errorCount} />
          </Box>
        )}
        {showMemoryUsage && <MemoryUsageDisplay />}
      </Box>
    </Box>
  );
};
