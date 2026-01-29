/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { shortAsciiLogo, longAsciiLogo } from './AsciiArt.js';
import { getAsciiArtWidth } from '../utils/textUtils.js';
import { getCliVersion } from '../../utils/version.js';

interface HeaderProps {
  customAsciiArt?: string;
  terminalWidth: number;
  modelName?: string;
  providerName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  terminalWidth,
  modelName,
  providerName,
}) => {
  const [version, setVersion] = useState(process.env.CLI_VERSION || '');

  useEffect(() => {
    getCliVersion().then(setVersion);
  }, []);

  const widthOfLongLogo = getAsciiArtWidth(longAsciiLogo);
  const MIN_WIDE = 60;
  const MIN_MEDIUM = 40;

  let displayTitle: string | undefined;
  let isPlainText = false;

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else if (terminalWidth >= MIN_WIDE) {
    displayTitle = longAsciiLogo;
  } else if (terminalWidth >= MIN_MEDIUM) {
    displayTitle = shortAsciiLogo;
  } else {
    isPlainText = true;
  }

  const artWidth = displayTitle ? getAsciiArtWidth(displayTitle) : 0;
  const panelWidth = Math.min(
    Math.max(artWidth, 50),
    terminalWidth - 4,
  );

  const versionStr = version ? `grok v${version}` : 'grok';
  const modelStr = providerName && modelName
    ? `${providerName}:${modelName}`
    : modelName || '';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Logo */}
      {isPlainText ? (
        <Box>
          <Text bold color={Colors.AccentBlue}>GROK</Text>
        </Box>
      ) : (
        <Box
          alignItems="flex-start"
          width={artWidth}
          flexShrink={0}
        >
          <Text color={Colors.AccentBlue}>{displayTitle}</Text>
        </Box>
      )}

    </Box>
  );
};
