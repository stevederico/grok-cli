## Authentication Setup

Grok CLI supports multiple AI providers. Set the appropriate API key environment variable and Grok CLI will auto-detect your provider, or explicitly set `GROKCLI_PROVIDER`.

### XAI (Grok)

```bash
export XAI_API_KEY="your_xai_api_key"
grok
```

Optionally set a specific model:

```bash
export XAI_MODEL="grok-4-0709"
```

### OpenAI

```bash
export OPENAI_API_KEY="your_openai_api_key"
grok
```

### Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY="your_anthropic_api_key"
grok
```

### Google Gemini

```bash
export GEMINI_API_KEY="your_gemini_api_key"
grok
```

### OpenRouter

```bash
export OPENROUTER_API_KEY="your_openrouter_api_key"
grok
```

### Groq

```bash
export GROQ_API_KEY="your_groq_api_key"
grok
```

### Azure OpenAI

Both the API key and endpoint are required:

```bash
export AZURE_OPENAI_API_KEY="your_azure_api_key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
grok
```

### GitHub Models

```bash
export GITHUB_TOKEN="your_github_token"
export GROKCLI_PROVIDER=github
grok
```

### Ollama (Local Models)

No API key required. Install and start Ollama, then:

```bash
export GROKCLI_PROVIDER=ollama
grok
```

Optionally configure the endpoint and model:

```bash
export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11434"
export GROKCLI_OLLAMA_MODEL="llama3.2:latest"
```

### Custom (OpenAI-Compatible)

For any OpenAI-compatible endpoint:

```bash
export CUSTOM_API_KEY="your_api_key"
export CUSTOM_BASE_URL="https://your-endpoint.com/v1"
export GROKCLI_PROVIDER=custom
grok
```

### Explicit Provider Selection

To override auto-detection, set `GROKCLI_PROVIDER` to one of: `xai`, `openai`, `anthropic`, `google`, `openrouter`, `groq`, `azure`, `github`, `ollama`, `custom`.

```bash
export GROKCLI_PROVIDER=anthropic
grok
```

### Auto-Detection Priority

When `GROKCLI_PROVIDER` is not set, the provider is selected based on the first available API key in this order:

`xai` > `openai` > `anthropic` > `google` > `openrouter` > `groq` > `azure` > `github` > `custom` > `ollama`

For more details on environment variables, see the main [README](../../README.md).
