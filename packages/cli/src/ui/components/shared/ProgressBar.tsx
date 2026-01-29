/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text } from 'ink';
import { Colors } from '../../colors.js';

interface ProgressBarProps {
  percent: number;
  width?: number;
  showPercent?: boolean;
  color?: string;
}

/**
 * Unicode block progress bar [████░░░░] 50%
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  width = 20,
  showPercent = true,
  color,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  const barColor =
    color ||
    (clamped < 50
      ? Colors.AccentGreen
      : clamped < 75
        ? Colors.AccentYellow
        : Colors.AccentRed);

  return (
    <Text>
      <Text color={barColor}>[{bar}]</Text>
      {showPercent && <Text color={Colors.Gray}> {Math.round(clamped)}%</Text>}
    </Text>
  );
};
