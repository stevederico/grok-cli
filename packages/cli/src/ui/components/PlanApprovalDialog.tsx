/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { Panel } from './shared/Panel.js';

interface PlanApprovalDialogProps {
  planText: string;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

/**
 * Dialog to display a plan and offer approve/reject/edit controls.
 */
export const PlanApprovalDialog: React.FC<PlanApprovalDialogProps> = ({
  planText,
  onApprove,
  onReject,
  onEdit,
}) => {
  useInput((input, key) => {
    const lower = input.toLowerCase();
    if (lower === 'y') {
      onApprove();
    } else if (lower === 'n') {
      onReject();
    } else if (lower === 'e') {
      onEdit();
    }
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Panel title="Plan" borderColor={Colors.AccentPurple}>
        <Text>{planText}</Text>
      </Panel>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          {'  '}
          <Text color={Colors.AccentGreen} bold>[y]</Text>
          <Text color={Colors.Gray}>es</Text>
          {'  '}
          <Text color={Colors.AccentRed} bold>[n]</Text>
          <Text color={Colors.Gray}>o</Text>
          {'  '}
          <Text color={Colors.AccentYellow} bold>[e]</Text>
          <Text color={Colors.Gray}>dit</Text>
        </Text>
      </Box>
    </Box>
  );
};
