/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { Colors } from '../../colors.js';

interface ErrorMessageProps {
  text: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, i) => (
        <Box key={i} flexDirection="row">
          <Text color={Colors.AccentRed}>{i === 0 ? '✕ │ ' : '  │ '}</Text>
          <Box flexGrow={1}>
            <Text wrap="wrap" color={Colors.AccentRed}>
              {line}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
