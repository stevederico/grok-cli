/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorsTheme } from './theme.js';
import { createTheme } from './theme-utils.js';

const monokaiColors: ColorsTheme = {
  type: 'dark',
  Background: '#272822',
  Foreground: '#F8F8F2',
  LightBlue: '#66D9EF',
  AccentBlue: '#66D9EF',
  AccentPurple: '#AE81FF',
  AccentCyan: '#66D9EF',
  AccentGreen: '#A6E22E',
  AccentYellow: '#E6DB74',
  AccentRed: '#F92672',
  Comment: '#75715E',
  Gray: '#75715E',
  GradientColors: ['#F92672', '#AE81FF', '#66D9EF'],
};

export const Monokai = createTheme('Monokai', monokaiColors);
