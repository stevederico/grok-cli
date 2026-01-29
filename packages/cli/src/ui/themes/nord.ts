/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorsTheme } from './theme.js';
import { createTheme } from './theme-utils.js';

const nordColors: ColorsTheme = {
  type: 'dark',
  Background: '#2E3440',
  Foreground: '#D8DEE9',
  LightBlue: '#88C0D0',
  AccentBlue: '#81A1C1',
  AccentPurple: '#B48EAD',
  AccentCyan: '#88C0D0',
  AccentGreen: '#A3BE8C',
  AccentYellow: '#EBCB8B',
  AccentRed: '#BF616A',
  Comment: '#616E88',
  Gray: '#4C566A',
};

export const Nord = createTheme('Nord', nordColors);
