/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text } from 'ink';
import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { usePrivacySettings } from '../hooks/usePrivacySettings.js';
import { CloudPaidPrivacyNotice } from './CloudPaidPrivacyNotice.js';
import { Config } from '../../core/index.js';
import { Colors } from '../colors.js';

interface CloudFreePrivacyNoticeProps {
  config: Config;
  onExit: () => void;
}

export const CloudFreePrivacyNotice = ({
  config,
  onExit,
}: CloudFreePrivacyNoticeProps) => {
  const { privacyState, updateDataCollectionOptIn } =
    usePrivacySettings(config);

  if (privacyState.isLoading) {
    return <Text color={Colors.Gray}>Loading...</Text>;
  }

  if (privacyState.error) {
    return (
      <Text color={Colors.AccentRed}>
        Error loading Opt-in settings: {privacyState.error}
      </Text>
    );
  }

  if (privacyState.isFreeTier === false) {
    return <CloudPaidPrivacyNotice onExit={onExit} />;
  }

  const items = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={Colors.AccentPurple}>
        Grok CLI Privacy Notice
      </Text>
      <Newline />
      <Text>
        This notice describes how Grok CLI handles your data. Please read it
        carefully.
      </Text>
      <Newline />
      <Text>
        When you use Grok CLI, xAI collects your prompts, related code,
        generated output, code edits, related feature usage information, and
        your feedback to provide, improve, and develop xAI products and
        services and machine learning technologies.
      </Text>
      <Newline />
      <Text>
        To help with quality and improve our products (such as generative
        machine-learning models), human reviewers may read, annotate, and
        process the data collected above. We take steps to protect your privacy
        as part of this process. Please don&apos;t submit confidential
        information or any data you wouldn&apos;t want a reviewer to see or
        xAI to use to improve our products, services and machine-learning
        technologies.
      </Text>
      <Newline />
      <Box flexDirection="column">
        <Text>
          Allow xAI to use this data to develop and improve our products?
        </Text>
        <RadioButtonSelect
          items={items}
          initialIndex={privacyState.dataCollectionOptIn ? 0 : 1}
          onSelect={(value) => {
            updateDataCollectionOptIn(value);
            // Only exit if there was no error.
            if (!privacyState.error) {
              onExit();
            }
          }}
        />
      </Box>
      <Newline />
      <Text color={Colors.Gray}>Press Enter to choose an option and exit.</Text>
    </Box>
  );
};
