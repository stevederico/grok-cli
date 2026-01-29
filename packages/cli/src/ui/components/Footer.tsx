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
  provider?: string;
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
  sessionCost?: number;
}

/**
 * Build a visual context meter bar like [████░░░░] 37%
 * Color shifts green -> yellow -> red as context fills up.
 */
function contextMeter(usedPercent: number, barWidth = 8): { bar: string; color: string } {
  const clamped = Math.max(0, Math.min(100, usedPercent));
  const filled = Math.round((clamped / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const color = clamped < 50 ? Colors.AccentGreen : clamped < 75 ? Colors.AccentYellow : Colors.AccentRed;
  return { bar, color };
}

export const Footer: React.FC<FooterProps> = ({
  model,
  provider,
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
  sessionCost,
}) => {
  const limit = tokenLimit(model);
  const percentage = totalTokenCount / limit;
  const remainingPercent = Math.round((1 - percentage) * 100);
  const usedPercent = Math.round(percentage * 100);
  const { bar, color: meterColor } = contextMeter(usedPercent);
  const [version, setVersion] = React.useState<string>('');

  React.useEffect(() => {
    if (showVersionInfo) {
      getCliVersion().then(setVersion);
    }
  }, [showVersionInfo]);

  const dirName = targetDir.split('/').pop() || targetDir;
  const modelLabel = provider && provider.trim() ? `${provider}:${model}` : model;

  return (
    <Box marginTop={1} justifyContent="space-between" width="100%">
      {/* Left: version │ project (branch) */}
      <Box>
        {showVersionInfo && version && (
          <Text color={Colors.Gray}>
            grok v{version}
            <Text color={Colors.Gray}> │ </Text>
          </Text>
        )}
        <Text color={Colors.LightBlue}>
          {dirName}
        </Text>
        {branchName && (
          <Text color={Colors.Gray}> ({branchName}*)</Text>
        )}
        {debugMode && (
          <Text color={Colors.AccentRed}>
            {' ' + (debugMessage || '--debug')}
          </Text>
        )}
        {corgiMode && (
          <Text>
            <Text color={Colors.Gray}> │ </Text>
            <Text color={Colors.AccentRed}>▼</Text>
            <Text color={Colors.Foreground}>(´</Text>
            <Text color={Colors.AccentRed}>ᴥ</Text>
            <Text color={Colors.Foreground}>`)</Text>
            <Text color={Colors.AccentRed}>▼</Text>
          </Text>
        )}
      </Box>

      {/* Middle: sandbox info */}
      <Box flexGrow={1} justifyContent="center">
        {process.env.SANDBOX && process.env.SANDBOX !== 'sandbox-exec' ? (
          <Text color="green">
            {process.env.SANDBOX.replace(/^grokcli-(?:cli-)?/, '')}
          </Text>
        ) : process.env.SANDBOX === 'sandbox-exec' ? (
          <Text color={Colors.AccentYellow}>
            Seatbelt{' '}
            <Text color={Colors.Gray}>({process.env.SEATBELT_PROFILE})</Text>
          </Text>
        ) : null}
      </Box>

      {/* Right: model │ context meter │ errors */}
      <Box>
        <Text color={Colors.AccentBlue}>{modelLabel}</Text>
        {sessionCost !== undefined && sessionCost > 0 && (
          <>
            <Text color={Colors.Gray}> │ </Text>
            <Text color={Colors.AccentGreen}>${sessionCost.toFixed(4)}</Text>
          </>
        )}
        <Text color={Colors.Gray}> │ </Text>
        <Text color={meterColor}>[{bar}]</Text>
        <Text color={Colors.Gray}> {remainingPercent}% left</Text>
        {!showErrorDetails && errorCount > 0 && (
          <Box>
            <Text color={Colors.Gray}> │ </Text>
            <ConsoleSummaryDisplay errorCount={errorCount} />
          </Box>
        )}
        {showMemoryUsage && (
          <Box>
            <Text color={Colors.Gray}> │ </Text>
            <MemoryUsageDisplay />
          </Box>
        )}
      </Box>
    </Box>
  );
};
