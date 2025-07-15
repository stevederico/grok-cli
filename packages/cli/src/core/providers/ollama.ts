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
    // Ollama doesn't support OpenAI-style tool calling
    // Fall back to basic query and return simple response
    const response = await this.query(prompt, options);
    return { content: response };
  }
}

export function createOllamaProvider(config?: ProviderConfig): Provider {
  return new OllamaProvider(config);
}
