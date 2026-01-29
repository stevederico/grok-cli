/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { ApprovalMode } from '../../core/index.js';

interface AutoAcceptIndicatorProps {
  approvalMode: ApprovalMode;
}

export const AutoAcceptIndicator: React.FC<AutoAcceptIndicatorProps> = ({
  approvalMode,
}) => {
  let textColor = '';
  let textContent = '';

  switch (approvalMode) {
    case ApprovalMode.DEFAULT:
      textColor = Colors.AccentBlue;
      textContent = 'ask before edits';
      break;
    case ApprovalMode.AUTO_EDIT:
      textColor = Colors.AccentGreen;
      textContent = 'auto-accept edits';
      break;
    case ApprovalMode.YOLO:
      textColor = Colors.AccentRed;
      textContent = 'YOLO mode';
      break;
  }

  return (
    <Box>
      <Text color={textColor}>
        {textContent}
        <Text color={Colors.Gray}> (shift+tab)</Text>
      </Text>
    </Box>
  );
};
