/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { GROK_DIR } from './paths.js';

const homeDir = os.homedir() ?? '';
const grokDir = path.join(homeDir, GROK_DIR);
const userIdFile = path.join(grokDir, 'user_id');

function ensureGrokDirExists() {
  if (!fs.existsSync(grokDir)) {
    fs.mkdirSync(grokDir, { recursive: true });
  }
}

function readUserIdFromFile(): string | null {
  if (fs.existsSync(userIdFile)) {
    const userId = fs.readFileSync(userIdFile, 'utf-8').trim();
    return userId || null;
  }
  return null;
}

function writeUserIdToFile(userId: string) {
  fs.writeFileSync(userIdFile, userId, 'utf-8');
}

/**
 * Retrieves the persistent user ID from a file, creating it if it doesn't exist.
 * This ID is used for unique user tracking.
 * @returns A UUID string for the user.
 */
export function getPersistentUserId(): string {
  try {
    ensureGrokDirExists();
    let userId = readUserIdFromFile();

    if (!userId) {
      userId = randomUUID();
      writeUserIdToFile(userId);
    }

    return userId;
  } catch (error) {
    console.error(
      'Error accessing persistent user ID file, generating ephemeral ID:',
      error,
    );
    return '123456789';
  }
}
