/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { formatDuration } from '../utils/formatters.js';
import { CumulativeStats } from '../contexts/SessionContext.js';
import { FormattedStats, StatRow, StatsColumn } from './Stats.js';

// --- Prop and Data Structures ---

interface SessionSummaryDisplayProps {
  stats: CumulativeStats;
  duration: string;
  sessionCost?: number;
}

// --- Main Component ---

export const SessionSummaryDisplay: React.FC<SessionSummaryDisplayProps> = ({
  stats,
  duration,
  sessionCost,
}) => {
  const cumulativeFormatted: FormattedStats = {
    inputTokens: stats.promptTokenCount,
    outputTokens: stats.candidatesTokenCount,
    toolUseTokens: stats.toolUsePromptTokenCount,
    thoughtsTokens: stats.thoughtsTokenCount,
    cachedTokens: stats.cachedContentTokenCount,
    totalTokens: stats.totalTokenCount,
  };

  const title = 'Agent powering down. Goodbye!';

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingY={1}
      paddingX={2}
      alignSelf="flex-start"
    >
      <Box marginBottom={1} flexDirection="column">
        <Text bold color={Colors.AccentBlue}>{title}</Text>
      </Box>

      <Box marginTop={1}>
        <StatsColumn
          title={`Cumulative Stats (${stats.turnCount} Turns)`}
          stats={cumulativeFormatted}
          isCumulative={true}
        >
          <Box marginTop={1} flexDirection="column">
            <StatRow
              label="Total duration (API)"
              value={formatDuration(stats.apiTimeMs)}
            />
            <StatRow label="Total duration (wall)" value={duration} />
            {sessionCost !== undefined && (
              <StatRow label="Total cost" value={`$${sessionCost.toFixed(4)}`} />
            )}
          </Box>
        </StatsColumn>
      </Box>
    </Box>
  );
};
