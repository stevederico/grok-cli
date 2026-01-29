/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../../colors.js';

interface PanelProps {
  title?: string;
  borderColor?: string;
  children: React.ReactNode;
  paddingX?: number;
  paddingY?: number;
  width?: number | string;
}

/**
 * Bordered box with optional title for structured TUI output.
 */
export const Panel: React.FC<PanelProps> = ({
  title,
  borderColor = Colors.AccentBlue,
  children,
  paddingX = 1,
  paddingY = 0,
  width,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={paddingX}
      paddingY={paddingY}
      width={width}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={borderColor}>
            {title}
          </Text>
        </Box>
      )}
      {children}
    </Box>
  );
};
