/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

// Stub types for removed gaxios dependency

export interface GaxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: any;
}

export class GaxiosError extends Error {
  response?: GaxiosResponse;
  config?: any;
  
  constructor(message: string, response?: GaxiosResponse) {
    super(message);
    this.name = 'GaxiosError';
    this.response = response;
  }
}

export function isGaxiosError(error: any): error is GaxiosError {
  return error && typeof error === 'object' && 'response' in error;
}