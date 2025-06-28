/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { setSimulate429 } from './src/utils/testUtils.js';

// Disable 429 simulation globally for all tests
setSimulate429(false);
