/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text } from 'ink';
import Spinner from 'ink-spinner';
import type { SpinnerName } from 'cli-spinners';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';

interface LLMRespondingSpinnerProps {
  /**
   * Optional string to display when not in Responding state.
   * If not provided and not Responding, renders null.
   */
  nonRespondingDisplay?: string;
  spinnerType?: SpinnerName;
}

export const LLMRespondingSpinner: React.FC<
  LLMRespondingSpinnerProps
> = ({ nonRespondingDisplay, spinnerType = 'dots' }) => {
  const streamingState = useStreamingContext();

  if (streamingState === StreamingState.Responding) {
    return <Spinner type={spinnerType} />;
  } else if (nonRespondingDisplay) {
    return <Text>{nonRespondingDisplay}</Text>;
  }
  return null;
};
