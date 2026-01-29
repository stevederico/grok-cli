/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../../colors.js';

interface KeyValuePair {
  key: string;
  value: string | React.ReactNode;
}

interface KeyValueListProps {
  items: KeyValuePair[];
  keyColor?: string;
  valueColor?: string;
  separator?: string;
  keyWidth?: number;
}

/**
 * Aligned key: value display for structured data output.
 */
export const KeyValueList: React.FC<KeyValueListProps> = ({
  items,
  keyColor = Colors.AccentCyan,
  valueColor = Colors.Foreground,
  separator = ':',
  keyWidth,
}) => {
  const maxKeyLength =
    keyWidth || Math.max(...items.map((item) => item.key.length));

  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Box key={index}>
          <Text color={keyColor}>
            {item.key.padEnd(maxKeyLength)}
          </Text>
          <Text color={Colors.Gray}> {separator} </Text>
          {typeof item.value === 'string' ? (
            <Text color={valueColor}>{item.value}</Text>
          ) : (
            item.value
          )}
        </Box>
      ))}
    </Box>
  );
};
