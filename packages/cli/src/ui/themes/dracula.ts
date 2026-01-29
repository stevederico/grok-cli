/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColorsTheme } from './theme.js';
import { createTheme } from './theme-utils.js';

const draculaColors: ColorsTheme = {
  type: 'dark',
  Background: '#282A36',
  Foreground: '#F8F8F2',
  LightBlue: '#8BE9FD',
  AccentBlue: '#6272A4',
  AccentPurple: '#BD93F9',
  AccentCyan: '#8BE9FD',
  AccentGreen: '#50FA7B',
  AccentYellow: '#F1FA8C',
  AccentRed: '#FF5555',
  Comment: '#6272A4',
  Gray: '#6272A4',
  GradientColors: ['#BD93F9', '#FF79C6', '#FF5555'],
};

export const Dracula = createTheme('Dracula', draculaColors);
