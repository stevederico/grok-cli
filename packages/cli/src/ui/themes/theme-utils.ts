/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';
import { ColorsTheme, Theme, ThemeType } from './theme.js';

/**
 * Builds standard hljs CSSProperties mappings from a ColorsTheme.
 * This avoids repeating the same mapping structure in every theme file.
 */
export function buildHljsMappings(colors: ColorsTheme): Record<string, CSSProperties> {
  return {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: colors.Background,
      color: colors.Foreground,
    },
    'hljs-keyword': { color: colors.AccentBlue },
    'hljs-literal': { color: colors.AccentBlue },
    'hljs-symbol': { color: colors.AccentBlue },
    'hljs-name': { color: colors.AccentBlue },
    'hljs-link': { color: colors.AccentBlue, textDecoration: 'underline' },
    'hljs-built_in': { color: colors.AccentCyan },
    'hljs-type': { color: colors.AccentCyan },
    'hljs-number': { color: colors.AccentGreen },
    'hljs-class': { color: colors.AccentGreen },
    'hljs-string': { color: colors.AccentYellow },
    'hljs-meta-string': { color: colors.AccentYellow },
    'hljs-regexp': { color: colors.AccentRed },
    'hljs-template-tag': { color: colors.AccentRed },
    'hljs-subst': { color: colors.Foreground },
    'hljs-function': { color: colors.Foreground },
    'hljs-title': { color: colors.Foreground },
    'hljs-params': { color: colors.Foreground },
    'hljs-formula': { color: colors.Foreground },
    'hljs-comment': { color: colors.Comment, fontStyle: 'italic' },
    'hljs-quote': { color: colors.Comment, fontStyle: 'italic' },
    'hljs-doctag': { color: colors.Comment },
    'hljs-meta': { color: colors.Gray },
    'hljs-meta-keyword': { color: colors.Gray },
    'hljs-tag': { color: colors.Gray },
    'hljs-variable': { color: colors.AccentPurple },
    'hljs-template-variable': { color: colors.AccentPurple },
    'hljs-attr': { color: colors.LightBlue },
    'hljs-attribute': { color: colors.LightBlue },
    'hljs-builtin-name': { color: colors.LightBlue },
    'hljs-section': { color: colors.AccentYellow },
    'hljs-emphasis': { fontStyle: 'italic' },
    'hljs-strong': { fontWeight: 'bold' },
    'hljs-bullet': { color: colors.AccentYellow },
    'hljs-selector-tag': { color: colors.AccentYellow },
    'hljs-selector-id': { color: colors.AccentYellow },
    'hljs-selector-class': { color: colors.AccentYellow },
    'hljs-selector-attr': { color: colors.AccentYellow },
    'hljs-selector-pseudo': { color: colors.AccentYellow },
    'hljs-addition': {
      backgroundColor: colors.type === 'light' ? '#e6ffec' : '#144212',
      display: 'inline-block',
      width: '100%',
    },
    'hljs-deletion': {
      backgroundColor: colors.type === 'light' ? '#ffebe9' : '#660000',
      display: 'inline-block',
      width: '100%',
    },
  };
}

/**
 * Convenience: create a Theme from just a name and ColorsTheme.
 */
export function createTheme(name: string, colors: ColorsTheme): Theme {
  return new Theme(name, colors.type, buildHljsMappings(colors), colors);
}
