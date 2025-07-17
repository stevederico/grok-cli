import { Provider, ProviderConfig, QueryOptions } from './index.js';
import { env } from 'node:process';

export class OllamaProvider extends Provider {
  private model: string;
  private endpoint: string;

  constructor(config: ProviderConfig = {}) {
    super('ollama', config);
    this.model = config.model || env.GROKCLI_OLLAMA_MODEL || 'llama3.2:latest';
    this.endpoint = config.endpoint || env.GROKCLI_OLLAMA_ENDPOINT || 'http://localhost:11434';
  }

  isConfigured(): boolean {
    // Ollama doesn't need API key, just check if service is reachable
    return true;
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Timeout connecting to Ollama service - check if Ollama is running');
      }
      throw new Error(`Failed to fetch Ollama models: ${(error as Error).message}`);
    }
  }

  async query(prompt: string, options: QueryOptions = {}): Promise<string> {
    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      // First check if the model exists
      if (!await this.modelExists(model)) {
        // Try to find a suitable fallback model
        const availableModels = await this.getModels();
        if (availableModels.length === 0) {
          throw new Error(`No models available in Ollama. Please install a model first: ollama pull llama3.2`);
        }
        
        // Use the first available model as fallback
        const fallbackModel = availableModels[0];
        console.warn(`Model '${model}' not found. Using fallback model: ${fallbackModel}`);
        return this.query(prompt, { ...options, model: fallbackModel });
      }

      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout for generation
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature,
            num_predict: options.maxTokens || 2048,
          }
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Model '${model}' not found. Available models: ${(await this.getModels()).join(', ')}`);
        }
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.response) {
        return data.response;
      }
      
      throw new Error('Unexpected response format from Ollama API');
    } catch (error) {
      throw new Error(`Ollama query failed: ${(error as Error).message}`);
    }
  }

  private async modelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.getModels();
      return models.includes(modelName);
    } catch {
      return false;
    }
  }

  async queryWithTools(prompt: string, tools: any[], options: QueryOptions = {}): Promise<any> {
    const model = options.model || this.model;
    const temperature = options.temperature || 0.7;

    try {
      // Use OpenAI-compatible chat endpoint for tool calling
      const messages: any[] = [
        { role: 'user', content: prompt }
      ];

      // Handle tool results continuation (like XAI provider)
      if (options.tool_results && options.tool_results.length > 0) {
        // Add the previous assistant message with tool calls if available
        const prevResponse = (options as any).previous_assistant_response;
        if (prevResponse?.tool_calls) {
          const assistantMessage = {
            role: 'assistant',
            content: prevResponse.content || null,
            tool_calls: prevResponse.tool_calls.map((tc: any) => ({
              id: tc.id,
              type: tc.type,
              function: {
                name: tc.function.name,
                // Parse arguments back to object for Ollama's continuation format
                arguments: typeof tc.function.arguments === 'string' 
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments
              }
            }))
          };
          messages.push(assistantMessage);
        }
        
        // Add the tool results - try Ollama's expected format
        const toolMessages = options.tool_results.map((r: { content: string; tool_call_id: string }) => ({ 
          role: 'tool', 
          content: r.content,
          tool_call_id: r.tool_call_id
        }));
        messages.push(...toolMessages);
      }

      const requestBody: any = {
        model,
        messages,
        temperature,
        max_tokens: options.maxTokens || 2048,
        stream: false
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
      }

      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(60000), // 60 second timeout - increased for tool processing
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Fall back to basic query if chat endpoint or model doesn't support tools
          console.warn(`Ollama chat endpoint not available or model doesn't support tools. Falling back to basic query.`);
          const basicResponse = await this.query(prompt, options);
          return { content: basicResponse };
        }
        
        // Try to get the error details from the response
        let errorMessage = `${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error(`🔍 Ollama - Error response:`, errorData);
          if (errorData.error) {
            errorMessage += `: ${errorData.error}`;
          }
        } catch {
          // If we can't parse the error response, just use the status
        }
        
        throw new Error(`Ollama API error: ${errorMessage}`);
      }

      const data = await response.json();
      
      if (data.message) {
        const message = data.message;
        
        // Check for tool calls
        if (message.tool_calls && Array.isArray(message.tool_calls)) {
          const toolCalls = message.tool_calls.map((call: any) => ({
            id: call.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            function: {
              name: call.function.name,
              // Ensure arguments is always a JSON string
              arguments: typeof call.function.arguments === 'string' 
                ? call.function.arguments 
                : JSON.stringify(call.function.arguments),
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
      
      throw new Error('Unexpected response format from Ollama API');
    } catch (error) {
      // If chat endpoint fails, fall back to basic query
      if (error instanceof Error && error.message.includes('404')) {
        console.warn(`Ollama chat endpoint not available. Falling back to basic query.`);
        const basicResponse = await this.query(prompt, options);
        return { content: basicResponse };
      }
      
      console.error(`💥 Ollama - Query with tools failed:`, error);
      throw new Error(`Ollama query with tools failed: ${(error as Error).message}`);
    }
  }
}

export function createOllamaProvider(config?: ProviderConfig): Provider {
  return new OllamaProvider(config);
}
