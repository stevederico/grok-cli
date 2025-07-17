/**
 * @licinterface ContextSummaryDisplayProps {
  contextMdFileCount: number;
  contextFileNames: string[];
  contextFilePaths: string[];
  mcpServers?: Record<string, MCPServerConfig>;
  showToolDescriptions: boolean;
}* Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text } from 'ink';
import { Colors } from '../colors.js';
import { type MCPServerConfig } from '../../core/index.js';

interface ContextSummaryDisplayProps {
  contextMdFileCount: number;
  contextFileNames: string[];
  contextFilePaths: string[];
  mcpServers?: Record<string, MCPServerConfig>;
  showToolDescriptions?: boolean;
}

export const ContextSummaryDisplay: React.FC<ContextSummaryDisplayProps> = ({
  contextMdFileCount,
  contextFileNames,
  contextFilePaths,
  mcpServers,
  showToolDescriptions,
}) => {
  const mcpServerCount = Object.keys(mcpServers || {}).length;

  if (contextMdFileCount === 0 && mcpServerCount === 0) {
    return <Text> </Text>; // Render an empty space to reserve height
  }

  const contextMdText = (() => {
    if (contextMdFileCount === 0) {
      return '';
    }
    
    if (contextFilePaths && contextFilePaths.length > 0) {
      // Show file paths when available
      if (contextFilePaths.length === 1) {
        return `1 ${contextFilePaths[0]}`;
      } else {
        return `${contextMdFileCount} context files: ${contextFilePaths.join(', ')}`;
      }
    }
    
    // Fallback to original logic only if we actually have files
    if (contextMdFileCount > 0) {
      const allNamesTheSame = new Set(contextFileNames).size < 2;
      const name = allNamesTheSame ? contextFileNames[0] : 'context';
      return `${contextMdFileCount} ${name} file${
        contextMdFileCount > 1 ? 's' : ''
      }`;
    }
    
    return '';
  })();

  const mcpText =
    mcpServerCount > 0
      ? `${mcpServerCount} MCP server${mcpServerCount > 1 ? 's' : ''}`
      : '';

  let summaryText = 'Using ';
  if (contextMdText) {
    summaryText += contextMdText;
  }
  if (contextMdText && mcpText) {
    summaryText += ' and ';
  }
  if (mcpText) {
    summaryText += mcpText;
    // Add ctrl+t hint when MCP servers are available
    if (mcpServers && Object.keys(mcpServers).length > 0) {
      if (showToolDescriptions) {
        summaryText += ' (ctrl+t to toggle)';
      } else {
        summaryText += ' (ctrl+t to view)';
      }
    }
  }

  return <Text color={Colors.Gray}>{summaryText}</Text>;
};
