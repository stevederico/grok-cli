/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text } from 'ink';
import { Colors } from '../../colors.js';

type BadgeVariant = 'success' | 'error' | 'pending' | 'running' | 'info';

const BADGE_CONFIG: Record<BadgeVariant, { icon: string; color: string }> = {
  success: { icon: '✓', color: Colors.AccentGreen },
  error: { icon: '✗', color: Colors.AccentRed },
  pending: { icon: '○', color: Colors.Gray },
  running: { icon: '●', color: Colors.AccentYellow },
  info: { icon: 'i', color: Colors.AccentBlue },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
}

/**
 * Colored badge with icon for status display.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label }) => {
  const { icon, color } = BADGE_CONFIG[variant];
  return (
    <Text color={color}>
      {icon} {label}
    </Text>
  );
};
