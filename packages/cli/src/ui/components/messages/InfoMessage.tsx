/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { Colors } from '../../colors.js';

interface InfoMessageProps {
  text: string;
}

export const InfoMessage: React.FC<InfoMessageProps> = ({ text }) => {
  return (
    <Box flexDirection="row" marginTop={1}>
      <Box width={2}>
        <Text color={Colors.AccentCyan}>ℹ </Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="wrap" color={Colors.AccentCyan}>
          {text}
        </Text>
      </Box>
    </Box>
  );
};
