/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorsTheme } from './theme.js';
import { createTheme } from './theme-utils.js';

const solarizedLightColors: ColorsTheme = {
  type: 'light',
  Background: '#FDF6E3',
  Foreground: '#657B83',
  LightBlue: '#268BD2',
  AccentBlue: '#268BD2',
  AccentPurple: '#6C71C4',
  AccentCyan: '#2AA198',
  AccentGreen: '#859900',
  AccentYellow: '#B58900',
  AccentRed: '#DC322F',
  Comment: '#93A1A1',
  Gray: '#93A1A1',
  GradientColors: ['#268BD2', '#6C71C4', '#DC322F'],
};

export const SolarizedLight = createTheme('Solarized Light', solarizedLightColors);
