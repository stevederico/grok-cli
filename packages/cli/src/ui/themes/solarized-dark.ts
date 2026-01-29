/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorsTheme } from './theme.js';
import { createTheme } from './theme-utils.js';

const solarizedDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#002B36',
  Foreground: '#839496',
  LightBlue: '#268BD2',
  AccentBlue: '#268BD2',
  AccentPurple: '#6C71C4',
  AccentCyan: '#2AA198',
  AccentGreen: '#859900',
  AccentYellow: '#B58900',
  AccentRed: '#DC322F',
  Comment: '#586E75',
  Gray: '#657B83',
  GradientColors: ['#268BD2', '#2AA198', '#859900'],
};

export const SolarizedDark = createTheme('Solarized Dark', solarizedDarkColors);
