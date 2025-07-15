/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Config,
  ToolCallRequestInfo,
  executeToolCall,
  ToolRegistry,
} from './core/index.js';
import { getProvider } from './core/providers/registry.js';
import { ToolCallResponse, ProviderToolCall } from './core/providers/index.js';


export async function runNonInteractive(
  config: Config,
  input: string,
): Promise<void> {
  // Handle EPIPE errors when the output is piped to a command that closes early.
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') {
      // Exit gracefully if the pipe is closed.
      process.exit(0);
    }
  });

  try {
    // Get the tool registry from config
    // Note: toolRegistry should be initialized during config creation
    const toolRegistry = await config.getToolRegistry();
    
    // Use the provider system with tool-enabled query
    const providerName = config.getProvider() || 
      process.env.GROKCLI_PROVIDER || 
      (process.env.XAI_API_KEY ? 'grok' : 'ollama');
    const model = config.getModel();
    
    // Build provider config from the main config
    const providerConfig: any = {};
    
    // Map config properties to provider config based on provider type
    if (providerName === 'xai') {
      providerConfig.apiKey = process.env.XAI_API_KEY || '';
    } else if (providerName === 'ollama') {
      providerConfig.endpoint = process.env.OLLAMA_HOST || 'http://localhost:11434';
      providerConfig.model = process.env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
    }
    
    const queryOptions: any = {};
    if (model) {
      queryOptions.model = model;
    }

    // Get the provider and tools
    const provider = getProvider(providerName, providerConfig);
    const tools = toolRegistry.getFunctionDeclarations();
    
    console.log(`🔧 Tools available for ${providerName}: ${tools.length}`);
    
    // Use tool-enabled query
    const response: ToolCallResponse = await provider.queryWithTools(input, tools, queryOptions);
    
    // Handle tool calls if present
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`🔧 Processing ${response.tool_calls.length} tool calls...`);
      
      let finalResponse = response.content || '';
      
      for (const toolCall of response.tool_calls) {
        console.log(`🔧 Executing tool: ${toolCall.function.name}`);
        
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const toolCallRequest: ToolCallRequestInfo = {
            toolName: toolCall.function.name,
            parameters: args,
            callId: toolCall.id,
            name: toolCall.function.name,
            args: args
          };
          
          const toolResult = await executeToolCall(config, toolCallRequest, toolRegistry);
          
          if (toolResult.error) {
            console.error(`❌ Tool ${toolCall.function.name} failed: ${toolResult.error}`);
          } else {
            console.log(`✅ Tool ${toolCall.function.name} completed`);
            if (toolResult.resultDisplay) {
              finalResponse += `\n\n**${toolCall.function.name} Result:**\n${toolResult.resultDisplay}`;
            }
          }
        } catch (err) {
          console.error(`❌ Error executing tool ${toolCall.function.name}:`, err);
        }
      }
      
      // Output the final response with tool results
      process.stdout.write(finalResponse);
      process.stdout.write('\n');
    } else {
      // No tool calls, just output the response
      process.stdout.write(response.content || '');
      process.stdout.write('\n');
    }

  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    // Cleanup removed for privacy
  }
}
