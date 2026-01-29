/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThoughtSummary } from '../../core/index.js';
import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState, AgentPhase } from '../types.js';
import { LLMRespondingSpinner } from './LLMRespondingSpinner.js';

const PHASE_LABELS: Record<AgentPhase, string> = {
  thinking: 'Thinking...',
  executing_tools: 'Executing tools...',
  responding: 'Writing response...',
};

interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime: number;
  rightContent?: React.ReactNode;
  thought?: ThoughtSummary | null;
  agentPhase?: AgentPhase;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
  thought,
  agentPhase,
}) => {
  const streamingState = useStreamingContext();

  if (streamingState === StreamingState.Idle) {
    return null;
  }

  const phaseLabel = agentPhase ? PHASE_LABELS[agentPhase] : undefined;
  const primaryText = thought?.subject || phaseLabel || currentLoadingPhrase;
  const timerColor = elapsedTime < 5 ? Colors.AccentGreen : elapsedTime < 15 ? Colors.AccentYellow : Colors.AccentRed;

  return (
    <Box marginTop={1} paddingLeft={0} flexDirection="column">
      {/* Main loading line */}
      <Box>
        <Box marginRight={1}>
          <LLMRespondingSpinner
            nonRespondingDisplay={
              streamingState === StreamingState.WaitingForConfirmation
                ? '⠏'
                : ''
            }
          />
        </Box>
        {primaryText && <Text color={Colors.AccentPurple}>{primaryText}</Text>}
        {streamingState !== StreamingState.WaitingForConfirmation && (
          <Text color={Colors.Gray}>
            {' (esc to cancel, '}<Text color={timerColor}>{elapsedTime}s</Text>{')'}
          </Text>
        )}
        <Box flexGrow={1}>{/* Spacer */}</Box>
        {rightContent && <Box>{rightContent}</Box>}
      </Box>
    </Box>
  );
};
