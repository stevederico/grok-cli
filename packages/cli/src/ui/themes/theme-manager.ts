/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DefaultLight } from './default-light.js';
import { DefaultDark } from './default.js';
import { Theme, ThemeType } from './theme.js';
import { LightTheme as NoColorLightTheme, DarkTheme as NoColorDarkTheme } from './no-color.js';
import process from 'node:process';

export interface ThemeDisplay {
  name: string;
  type: ThemeType;
}

export const DEFAULT_THEME: Theme = DefaultDark;

class ThemeManager {
  private readonly availableThemes: Theme[];
  private activeTheme: Theme;

  constructor() {
    this.availableThemes = [
      DefaultDark,
      DefaultLight,
    ];
    this.activeTheme = DEFAULT_THEME;
  }

  /**
   * Returns a list of available theme names.
   */
  getAvailableThemes(): ThemeDisplay[] {
    const sortedThemes = [...this.availableThemes].sort((a, b) => {
      const typeOrder = (type: ThemeType): number => {
        switch (type) {
          case 'dark':
            return 1;
          case 'light':
            return 2;
          default:
            return 3;
        }
      };

      const typeComparison = typeOrder(a.type) - typeOrder(b.type);
      if (typeComparison !== 0) {
        return typeComparison;
      }
      return a.name.localeCompare(b.name);
    });

    return sortedThemes.map((theme) => ({
      name: theme.name,
      type: theme.type,
    }));
  }

  /**
   * Sets the active theme.
   * @param themeName The name of the theme to activate.
   * @returns True if the theme was successfully set, false otherwise.
   */
  setActiveTheme(themeName: string | undefined): boolean {
    const foundTheme = this.findThemeByName(themeName);

    if (foundTheme) {
      this.activeTheme = foundTheme;
      return true;
    } else {
      // If themeName is undefined, it means we want to set the default theme.
      // If findThemeByName returns undefined (e.g. default theme is also not found for some reason)
      // then this will return false.
      if (themeName === undefined) {
        this.activeTheme = DEFAULT_THEME;
        return true;
      }
      return false;
    }
  }

  findThemeByName(themeName: string | undefined): Theme | undefined {
    if (!themeName) {
      return DEFAULT_THEME;
    }
    return this.availableThemes.find((theme) => theme.name === themeName);
  }

  /**
   * Returns the currently active theme object.
   */
  getActiveTheme(): Theme {
    if (process.env.NO_COLOR) {
      return NoColorDarkTheme;
    }
    return this.activeTheme;
  }
}

// Export an instance of the ThemeManager
export const themeManager = new ThemeManager();
