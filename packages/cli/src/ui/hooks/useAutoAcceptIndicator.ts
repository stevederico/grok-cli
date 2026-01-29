/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useInput } from 'ink';
import { ApprovalMode, type Config } from '../../core/index.js';

export interface UseAutoAcceptIndicatorArgs {
  config: Config;
}

export function useAutoAcceptIndicator({
  config,
}: UseAutoAcceptIndicatorArgs): ApprovalMode {
  const currentConfigValue = config.getApprovalMode();
  const [showAutoAcceptIndicator, setShowAutoAcceptIndicator] =
    useState(currentConfigValue);

  useEffect(() => {
    setShowAutoAcceptIndicator(currentConfigValue);
  }, [currentConfigValue]);

  useInput((input, key) => {
    let nextApprovalMode: ApprovalMode | undefined;

    // Shift+Tab cycles: DEFAULT → AUTO_EDIT → YOLO → DEFAULT
    if (key.tab && key.shift) {
      const current = config.getApprovalMode();
      if (current === ApprovalMode.DEFAULT) {
        nextApprovalMode = ApprovalMode.AUTO_EDIT;
      } else if (current === ApprovalMode.AUTO_EDIT) {
        nextApprovalMode = ApprovalMode.YOLO;
      } else {
        nextApprovalMode = ApprovalMode.DEFAULT;
      }
    }

    if (nextApprovalMode) {
      config.setApprovalMode(nextApprovalMode);
      setShowAutoAcceptIndicator(nextApprovalMode);
    }
  });

  return showAutoAcceptIndicator;
}
