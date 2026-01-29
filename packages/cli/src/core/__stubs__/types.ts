/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Minimal type stubs for compatibility with existing code
// Minimal type stubs for provider compatibility

export interface GenerateContentResponseUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
}

export interface Part {
  text?: string;
  functionResponse?: FunctionResponse;
  [key: string]: any;
}

export interface FunctionResponse {
  name: string;
  id?: string;
  response: any;
}

export interface FunctionCall {
  name: string;
  args: any;
}

export interface CallableTool {
  function_declarations?: any[];
  functionDeclaration?: any;
  tool?: any;
  callTool?: any;
}

export interface GroundingMetadata {
  [key: string]: any;
}

export interface Schema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
  anyOf?: any[];
  default?: any;
  items?: any;
}

export const Type = {
  STRING: { type: 'string' },
  NUMBER: { type: 'number' },
  BOOLEAN: { type: 'boolean' },
  OBJECT: { type: 'object' },
  ARRAY: { type: 'array' },
};

export interface Content {
  [key: string]: any;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Schema;
}

export interface GenerateContentResponse {
  [key: string]: any;
}

export const FinishReason = {
  STOP: 'stop',
  LENGTH: 'length',
  SAFETY: 'safety',
  RECITATION: 'recitation',
  OTHER: 'other',
};

export interface SafetyRating {
  [key: string]: any;
}

export interface SchemaUnion {
  [key: string]: any;
}

export type PartUnion = Part | string;
export type PartListUnion = PartUnion[] | PartUnion;

// Function stubs
export function mcpToTool(...args: any[]): any {
  return {};
}
