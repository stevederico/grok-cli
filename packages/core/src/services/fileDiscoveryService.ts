/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { GitIgnoreParser, GitIgnoreFilter } from '../utils/gitIgnoreParser.js';
import { isGitRepository } from '../utils/gitUtils.js';
import * as path from 'path';

const GROK_IGNORE_FILE_NAME = '.grokcliignore';

export interface FilterFilesOptions {
  respectGitIgnore?: boolean;
  respectGrokIgnore?: boolean;
}

export class FileDiscoveryService {
  private gitIgnoreFilter: GitIgnoreFilter | null = null;
  private grokIgnoreFilter: GitIgnoreFilter | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    if (isGitRepository(this.projectRoot)) {
      const parser = new GitIgnoreParser(this.projectRoot);
      try {
        parser.loadGitRepoPatterns();
      } catch (_error) {
        // ignore file not found
      }
      this.gitIgnoreFilter = parser;
    }
    const gParser = new GitIgnoreParser(this.projectRoot);
    try {
      gParser.loadPatterns(GROK_IGNORE_FILE_NAME);
    } catch (_error) {
      // ignore file not found
    }
    this.grokIgnoreFilter = gParser;
  }

  /**
   * Filters a list of file paths based on git ignore rules
   */
  filterFiles(
    filePaths: string[],
    options: FilterFilesOptions = {
      respectGitIgnore: true,
      respectGrokIgnore: true,
    },
  ): string[] {
    return filePaths.filter((filePath) => {
      if (options.respectGitIgnore && this.shouldGitIgnoreFile(filePath)) {
        return false;
      }
      if (
        options.respectGrokIgnore &&
        this.shouldGrokIgnoreFile(filePath)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * Checks if a single file should be git-ignored
   */
  shouldGitIgnoreFile(filePath: string): boolean {
    if (this.gitIgnoreFilter) {
      return this.gitIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Checks if a single file should be grok-ignored
   */
  shouldGrokIgnoreFile(filePath: string): boolean {
    if (this.grokIgnoreFilter) {
      return this.grokIgnoreFilter.isIgnored(filePath);
    }
    return false;
  }

  /**
   * Returns loaded patterns from .grokcliignore
   */
  getGrokIgnorePatterns(): string[] {
    return this.grokIgnoreFilter?.getPatterns() ?? [];
  }
}
