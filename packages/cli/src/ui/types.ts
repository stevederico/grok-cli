/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ToolCallConfirmationDetails,
  ToolResultDisplay,
} from '../core/index.js';
import { CumulativeStats } from './contexts/SessionContext.js';

// Only defining the state enum needed by the UI
export enum StreamingState {
  Idle = 'idle',
  Responding = 'responding',
  WaitingForConfirmation = 'waiting_for_confirmation',
}

// Copied from server/src/core/turn.ts for CLI usage
export enum MessageEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  // Add other event types if the UI hook needs to handle them
}

export enum ToolCallStatus {
  Pending = 'Pending',
  Canceled = 'Canceled',
  Confirming = 'Confirming',
  Executing = 'Executing',
  Success = 'Success',
  Error = 'Error',
}

export interface ToolCallEvent {
  type: 'tool_call';
  status: ToolCallStatus;
  callId: string;
  name: string;
  args: Record<string, never>;
  resultDisplay: ToolResultDisplay | undefined;
  confirmationDetails: ToolCallConfirmationDetails | undefined;
}

export interface IndividualToolCallDisplay {
  callId: string;
  name: string;
  description: string;
  resultDisplay: ToolResultDisplay | undefined;
  status: ToolCallStatus;
  confirmationDetails: ToolCallConfirmationDetails | undefined;
  renderOutputAsMarkdown?: boolean;
}


export interface HistoryItemBase {
  text?: string; // Text content for user/ai/info/error messages
}

export type HistoryItemUser = HistoryItemBase & {
  type: 'user';
  text: string;
};

export type HistoryItemAI = HistoryItemBase & {
  type: 'ai';
  text: string;
};

export type HistoryItemAssistant = HistoryItemBase & {
  type: 'assistant';
  text: string;
};

export type HistoryItemAIContent = HistoryItemBase & {
  type: 'ai_content';
  text: string;
};

export type HistoryItemInfo = HistoryItemBase & {
  type: 'info';
  text: string;
};

export type HistoryItemError = HistoryItemBase & {
  type: 'error';
  text: string;
};

export type HistoryItemAbout = HistoryItemBase & {
  type: 'about';
  cliVersion: string;
  osVersion: string;
  sandboxEnv: string;
  modelVersion: string;
  selectedAuthType: string;
  cloudProject: string;
};

export type HistoryItemStats = HistoryItemBase & {
  type: 'stats';
  stats: CumulativeStats;
  lastTurnStats: CumulativeStats;
  duration: string;
};

export type HistoryItemQuit = HistoryItemBase & {
  type: 'quit';
  stats: CumulativeStats;
  duration: string;
};

export type HistoryItemToolGroup = HistoryItemBase & {
  type: 'tool_group';
  tools: IndividualToolCallDisplay[];
};

export type HistoryItemUserShell = HistoryItemBase & {
  type: 'user_shell';
  text: string;
};

// Using Omit<HistoryItem, 'id'> seems to have some issues with typescript's
// type inference e.g. historyItem.type === 'tool_group' isn't auto-inferring that
// 'tools' in historyItem.
// Individually exported types extending HistoryItemBase
export type HistoryItemWithoutId =
  | HistoryItemUser
  | HistoryItemUserShell
  | HistoryItemAI
  | HistoryItemAssistant
  | HistoryItemAIContent
  | HistoryItemInfo
  | HistoryItemError
  | HistoryItemAbout
  | HistoryItemToolGroup
  | HistoryItemStats
  | HistoryItemQuit;

export type HistoryItem = HistoryItemWithoutId & { id: number };

// Message types used by internal command feedback (subset of HistoryItem types)
export enum MessageType {
  INFO = 'info',
  ERROR = 'error',
  USER = 'user',
  ABOUT = 'about',
  STATS = 'stats',
  QUIT = 'quit',
  GEMINI = 'ai',
  ASSISTANT = 'assistant',
}

// Simplified message structure for internal feedback
export type Message =
  | {
      type: MessageType.INFO | MessageType.ERROR | MessageType.USER;
      content: string; // Renamed from text for clarity in this context
      timestamp: Date;
    }
  | {
      type: MessageType.ABOUT;
      timestamp: Date;
      cliVersion: string;
      osVersion: string;
      sandboxEnv: string;
      modelVersion: string;
      selectedAuthType: string;
      cloudProject: string;
      content?: string; // Optional content, not really used for ABOUT
    }
  | {
      type: MessageType.STATS;
      timestamp: Date;
      stats: CumulativeStats;
      lastTurnStats: CumulativeStats;
      duration: string;
      content?: string;
    }
  | {
      type: MessageType.QUIT;
      timestamp: Date;
      stats: CumulativeStats;
      duration: string;
      content?: string;
    };

export interface ConsoleMessageItem {
  type: 'log' | 'warn' | 'error' | 'debug';
  content: string;
  count: number;
}
