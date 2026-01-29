/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface CloudPaidPrivacyNoticeProps {
  onExit: () => void;
}

export const CloudPaidPrivacyNotice = ({
  onExit,
}: CloudPaidPrivacyNoticeProps) => {
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={Colors.AccentPurple}>
        Grok CLI Paid Tier Notice
      </Text>
      <Newline />
      <Text>
        Service Specific Terms are incorporated into the agreement under which
        xAI has agreed to provide the Grok CLI service to Customer (the
        &quot;Agreement&quot;). Capitalized terms used but not defined in the
        Service Specific Terms have the meaning given to them in the Agreement.
      </Text>
      <Newline />
      <Text color={Colors.Gray}>Press Esc to exit.</Text>
    </Box>
  );
};
