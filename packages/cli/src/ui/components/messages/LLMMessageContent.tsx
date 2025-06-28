/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box } from 'ink';
import { MarkdownDisplay } from '../../utils/MarkdownDisplay.js';

interface LLMMessageContentProps {
  text: string;
  isPending: boolean;
  availableTerminalHeight?: number;
  terminalWidth: number;
}

/*
 * LLM message content is a semi-hacked component. The intention is to represent a partial
 * of LLMMessage and is only used when a response gets too long. In that instance messages
 * are split into multiple LLMMessageContent's to enable the root <Static> component in
 * App.tsx to be as performant as humanly possible.
 */
export const LLMMessageContent: React.FC<LLMMessageContentProps> = ({
  text,
  isPending,
  availableTerminalHeight,
  terminalWidth,
}) => {
  const originalPrefix = '✦ ';
  const prefixWidth = originalPrefix.length;

  return (
    <Box flexDirection="column" paddingLeft={prefixWidth}>
      <MarkdownDisplay
        text={text}
        isPending={isPending}
        availableTerminalHeight={availableTerminalHeight}
        terminalWidth={terminalWidth}
      />
    </Box>
  );
};
