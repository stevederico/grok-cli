/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Basic types for GrokCLI core functionality

export enum AuthType {
  API_KEY = 'api_key',      // xAI (requires XAI_API_KEY)
  LOCAL = 'local',          // Ollama (no key needed)
}

export interface ContentGeneratorConfig {
  authType: AuthType;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

export function createContentGeneratorConfig(config: Partial<ContentGeneratorConfig>): ContentGeneratorConfig {
  return {
    authType: config.authType || AuthType.LOCAL,
    apiKey: config.apiKey,
    model: config.model,
    endpoint: config.endpoint,
  };
}

export interface ToolCallRequestInfo {
  toolName: string;
  parameters: Record<string, any>;
  callId: string;
  name?: string;  // Alias for toolName for backward compatibility
  args?: Record<string, any>;  // Alias for parameters for backward compatibility
  isClientInitiated?: boolean; // For test compatibility
}

export interface ToolCallResponseInfo {
  callId: string;
  result?: any;
  error?: string;
  responseParts?: any;  // For backward compatibility
  resultDisplay?: string;  // For backward compatibility
}

// Tool-related types (main ToolResult is defined in tools/tools.ts)

export interface ToolCallConfirmationDetails {
  toolName?: string;
  parameters?: Record<string, any>;
  summary?: string;
  type?: string;
  title?: string;
  onConfirm?: (outcome: ToolConfirmationOutcome) => Promise<void>;
  fileName?: string;
  fileDiff?: string;
  isModifying?: boolean;
  command?: string;
  rootCommand?: string;
  serverName?: string;
  toolDisplayName?: string;
  prompt?: string;
  urls?: string[];
}

export enum ToolConfirmationOutcome {
  APPROVE = 'approve',
  DENY = 'deny',
  EDIT = 'edit',
  ProceedOnce = 'proceed_once',
  ProceedAlways = 'proceed_always',
  ProceedAlwaysServer = 'proceed_always_server',
  ProceedAlwaysTool = 'proceed_always_tool',
  ModifyWithEditor = 'modify_with_editor',
  Cancel = 'cancel',
}

// ApprovalMode defined in config/config.ts

// Generic schema type
export interface Schema extends Record<string, unknown> {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  description?: string;
}

// Generic function declaration
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Schema;
}

// Basic client interface
export interface LLMClient {
  query(prompt: string, options?: any): Promise<string>;
}

// Additional types needed by CLI package
export interface ThoughtSummary {
  thought?: string;
  summary?: string;
  subject?: string;
  description?: string;
}

export interface StructuredError {
  message: string;
  code?: string;
  details?: any;
  status?: number;
}

// Aliases for backward compatibility
export type ToolExecuteConfirmationDetails = ToolCallConfirmationDetails;
export type ToolMcpConfirmationDetails = ToolCallConfirmationDetails;

// Code Assist types (stubs for CLI compatibility)
export class CodeAssistServer {
  endpoint?: string;
  projectId?: string;
  
  constructor(endpoint?: string, projectId?: string) {
    this.endpoint = endpoint;
    this.projectId = projectId;
  }
  
  async loadCodeAssist(endpoint?: string): Promise<any> {
    // Stub implementation  
    return {
      currentTier: UserTierId.FREE,
      freeTierDataCollectionOptin: false
    };
  }
  
  async getCodeAssistGlobalUserSetting(): Promise<any> {
    // Stub implementation
    return {
      currentTier: UserTierId.FREE,
      freeTierDataCollectionOptin: false
    };
  }
  
  async setCodeAssistGlobalUserSetting(setting: string, value: any): Promise<any> {
    // Stub implementation
    return {
      freeTierDataCollectionOptin: value
    };
  }
}

export enum UserTierId {
  FREE = 'free',
  PAID = 'paid',
}

// Function stubs
export function clearCachedCredentialFile(): void {
  // Stub implementation
}

// Placeholder client implementation
export class GrokClient implements LLMClient {
  async query(prompt: string): Promise<string> {
    throw new Error('GrokClient is deprecated - use ProviderClient instead');
  }
  
  resetChat(): void {
    // Stub implementation
  }
  
  getChat(): any {
    // Stub implementation
    return {};
  }
  
  setHistory(history: any): void {
    // Stub implementation
  }
  
  getContentGenerator(): any {
    // Stub implementation
    return {};
  }
}