import { Provider, ProviderConfig, QueryOptions, ToolCallResponse, ProviderToolCall } from './index.js';
import { tokenLimit } from '../core/tokenLimits.js';
import { retryWithBackoff } from '../utils/retry.js';
import { getSystemPrompt } from './systemPrompts.js';

// Check if debug logging is enabled
const isDebugEnabled = () => process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// Simple token estimation (approximate)
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function truncateToTokenLimit(messages: any[], model: string, maxTokens: number): any[] {
  const customLimit = parseInt(process.env.GROKCLI_CONTEXT_SIZE || '128000', 10);
  const limit = customLimit || tokenLimit(model);
  const systemMessageTokens = 1000; // Reserve tokens for system message
  const responseTokens = maxTokens || 2048; // Reserve tokens for response
  const availableTokens = limit - systemMessageTokens - responseTokens;
  
  if (availableTokens <= 0) {
    console.warn(`⚠️ XAI - Token limit too low for model ${model}`);
    return messages;
  }
  
  let totalTokens = 0;
  const truncatedMessages = [];
  
  // Keep messages in reverse order (newest first) until we hit token limit
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgContent = msg.content || '';
    const msgTokens = estimateTokens(msgContent);
    
    if (totalTokens + msgTokens > availableTokens) {
      // If this would exceed limit, truncate the content
      const remainingTokens = availableTokens - totalTokens;
      if (remainingTokens > 100) { // Only truncate if we have decent space left
        const maxChars = remainingTokens * 4;
        const truncatedContent = msgContent.substring(0, maxChars) + '... [truncated due to token limit]';
        truncatedMessages.unshift({
          ...msg,
          content: truncatedContent
        });
      }
      break;
    }
    
    totalTokens += msgTokens;
    truncatedMessages.unshift(msg);
  }
  
  if (truncatedMessages.length < messages.length && isDebugEnabled()) {
    console.log(`🔧 XAI - Truncated ${messages.length - truncatedMessages.length} messages due to token limit (${totalTokens}/${availableTokens} tokens)`);
  }
  
  return truncatedMessages;
}

export class XAIProvider extends Provider {
  private apiKey: string | undefined;
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('xai', config);
    this.apiKey = config.apiKey || process.env.XAI_API_KEY;
    this.model = config.model || process.env.XAI_MODEL || 'grok-code-fast-1';
    this.endpoint = config.endpoint || 'https://api.x.ai/v1';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getModels(): Promise<string[]> {
    if (!this.isConfigured()) {
      throw new Error('XAI: Provider not configured. Set XAI_API_KEY environment variable');
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetch(`${this.endpoint}/models`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          if (!response.ok) {
            const error = new Error(`Failed to fetch models: ${response.status}`) as any;
            error.status = response.status;
            throw error;
          }

          const data = await response.json();
          const models = data.data?.map((m: any) => m.id) || [];
          return models.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
        },
        { maxAttempts: 2, initialDelayMs: 500, maxDelayMs: 2000 }
      );
    } catch (error) {
      throw new Error(`Failed to fetch XAI models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const response = await this.queryWithTools(prompt, [], options);
    return response.content || '';
  }

  async queryWithTools(prompt: string, tools: any[], options: QueryOptions = {}): Promise<ToolCallResponse> {
    if (!this.isConfigured()) {
      throw new Error('XAI: Provider not configured. Set XAI_API_KEY environment variable');
    }

    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      let messages: any[] = [];
      
      // Handle tool results continuation
      if (options.tool_results && options.tool_results.length > 0) {
        if (isDebugEnabled()) console.log(`🔧 XAI - Processing tool results continuation with ${options.tool_results.length} results`);
        // This is a continuation after tool execution
        // We need to reconstruct the conversation:
        // 1. Original user message (use empty string if not provided)
        // 2. Assistant message with tool calls (reconstructed)
        // 3. Tool results
        
        // Add user message (can be empty for tool continuations)
        messages.push({ role: 'user', content: prompt });
        
        // Add the previous assistant message with tool calls
        // This is needed for XAI to understand the conversation flow
        const prevResponse = (options as any).previous_assistant_response;
        if (prevResponse?.tool_calls) {
          const assistantMessage = {
            role: 'assistant',
            content: prevResponse.content || null,
            tool_calls: prevResponse.tool_calls.map((tc: ProviderToolCall) => ({
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments
              }
            }))
          };
          messages.push(assistantMessage);
        } else {
          // Fallback: create a placeholder if we don't have the previous response
          const toolCallsPlaceholder = {
            role: 'assistant',
            content: null,
            tool_calls: options.tool_results.map((r: any) => ({
              id: r.tool_call_id,
              type: 'function',
              function: {
                name: 'unknown_tool',
                arguments: '{}'
              }
            }))
          };
          messages.push(toolCallsPlaceholder);
        }
        
        // Add the tool results
        const toolMessages = options.tool_results.map((r: { content: string; tool_call_id: string }) => ({ 
          role: 'tool', 
          content: r.content, 
          tool_call_id: r.tool_call_id 
        }));
        messages.push(...toolMessages);
        
        if (isDebugEnabled()) console.log(`🔧 XAI - Tool continuation messages structure:`, JSON.stringify(messages.map(m => ({
          role: m.role,
          contentLength: m.content ? m.content.length : 0,
          tool_call_id: m.tool_call_id,
          tool_calls: m.tool_calls ? m.tool_calls.length : undefined
        })), null, 2));
      } else {
        // Normal query - add system context first
        messages.push({
          role: 'system',
          content: getSystemPrompt()
        });
        messages.push({ role: 'user', content: prompt });
      }
      
      // Apply token limiting
      messages = truncateToTokenLimit(messages, model, options.maxTokens || 2048);

      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: options.maxTokens || 2048,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        requestBody.tools = tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || {}
          }
        }));
        requestBody.tool_choice = 'auto';
      }
      
      const fullEndpoint = `${this.endpoint}/chat/completions`;
      
      if (isDebugEnabled()) {
        console.log(`🚀 XAI - Making request to: ${fullEndpoint}`);
        console.log(`📦 XAI - Using model: ${model}`);
        console.log(`🔑 XAI - API key configured: ${this.apiKey ? 'YES' : 'NO'}`);
        console.log(`🌡️  XAI - Temperature: ${temperature}`);
        if (tools && tools.length > 0) {
          console.log(`🔧 XAI - Tools available: ${tools.length}`);
        }
        if (options.tool_results) {
          console.log(`🔧 XAI - Sending ${options.tool_results.length} tool results back`);
          console.log(`📝 XAI - Messages in conversation: ${requestBody.messages.length}`);
          requestBody.messages.forEach((msg: any, i: number) => {
            console.log(`  Message[${i}] role: ${msg.role}, has content: ${!!msg.content}, has tool_calls: ${!!msg.tool_calls}`);
          });
        }
        console.debug(`[DEBUG] XAI - Full request body:`, JSON.stringify(requestBody, null, 2));
      }
      
      // Wrap fetch in retry logic for resilience
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch(fullEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(60000), // 60 second timeout
            body: JSON.stringify(requestBody)
          });

          // Convert fetch errors to retryable errors
          if (!res.ok) {
            const error = new Error(`XAI API error: ${res.status} ${res.statusText}`) as any;
            error.status = res.status;
            error.response = {
              status: res.status,
              headers: Object.fromEntries(res.headers.entries())
            };
            throw error;
          }

          return res;
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
        }
      );

      if (isDebugEnabled()) {
        console.log(`📡 XAI - Response status: ${response.status} ${response.statusText}`);
        console.log(`📍 XAI - Response URL: ${response.url}`);
      }

      // Response is guaranteed to be ok due to retry logic
      const data = await response.json();
      if (isDebugEnabled()) {
        console.log(`✅ XAI - Success! Response received`);
        console.debug(`[DEBUG] XAI - Full response:`, JSON.stringify(data, null, 2));
      }
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const message = data.choices[0].message;
        
        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          if (isDebugEnabled()) console.log(`🔧 XAI - Tool calls detected: ${message.tool_calls.length}`);
          const toolCalls: ProviderToolCall[] = message.tool_calls.map((call: any) => ({
            id: call.id,
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
            type: 'function',
          }));
          return {
            content: message.content,
            tool_calls: toolCalls,
          };
        }
        
        return { content: message.content };
      }
      
      throw new Error('Unexpected response format from XAI API');
    } catch (error) {
      console.error(`💥 XAI - Query failed with error:`, error);
      throw new Error(`XAI query failed: ${(error as Error).message}`);
    }
  }
}

export function createXAIProvider(config?: ProviderConfig): Provider {
  return new XAIProvider(config);
}
