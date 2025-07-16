/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

interface PrivacyNoticeProps {
  onExit: () => void;
}

export const PrivacyNotice = ({ onExit }: PrivacyNoticeProps) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={Colors.AccentPurple}>
        GrokCLI Privacy Notice
      </Text>
      <Text>
        GrokCLI is committed to protecting your privacy and ensuring secure, transparent usage of our platform.
      </Text>
      <Text color={Colors.Gray}>Press Enter to close.</Text>
    </Box>
  );
};