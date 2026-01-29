## Authentication Setup

Grok CLI supports multiple AI providers. Depending on your chosen provider, you'll need to configure authentication accordingly:

### For Grok (xAI) API Provider

To use Grok AI models:

1. **Get your API key** from the xAI console
2. **Set the XAI_API_KEY environment variable:**
   ```bash
   export XAI_API_KEY="your_grok_api_key"
   ```
3. **Optionally set the model:**
   ```bash
   export XAI_MODEL="grok-4-0709"
   ```
4. **Set Grok as your default provider:**
   ```bash
   export GROKCLI_PROVIDER="grok"
   ```

### For Ollama (Local Models)

To use local Ollama models:

1. **Install and start Ollama** on your machine
2. **Set the Ollama endpoint** (preferred):
   ```bash
   export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11434"
   ```
   You can also use `OLLAMA_HOST` as a fallback:
   ```bash
   export OLLAMA_HOST="http://localhost:11434"
   ```
3. **Set Ollama as your default provider:**
   ```bash
   export GROKCLI_PROVIDER="ollama"
   ```
4. **Optionally set the model:**
   ```bash
   export GROKCLI_OLLAMA_MODEL="llama3"
   ```

For more details on environment variables and provider configuration, see the main [README](../../README.md).
