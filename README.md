<img width="1770" height="746" alt="screenshot" src="https://github.com/user-attachments/assets/ab4a8ceb-b9de-4381-b926-42603569a109" />

# @stevederico/grok-cli

Grok CLI is an open-source interactive CLI tool that provides a flexible and powerful interface for AI-assisted workflows.

**Supported Providers:**
- **XAI (Grok)** - Cloud-based Grok models via xAI API
- **OpenAI** - GPT models via OpenAI API
- **Anthropic** - Claude models via Anthropic API
- **Google Gemini** - Gemini models via Google AI API
- **OpenRouter** - Multi-model routing service
- **Groq** - Fast open-source model inference
- **Azure OpenAI** - OpenAI models via Azure
- **GitHub Models** - Models via GitHub inference API
- **Ollama** - Local LLM inference with any Ollama model
- **Custom** - Any OpenAI-compatible endpoint

## Quick Start

### Install

```bash
npm i -g @stevederico/grok-cli
```

### Using XAI (Grok)

```bash
export XAI_API_KEY="your_xai_api_key"
grok
```

### Using OpenAI

```bash
export OPENAI_API_KEY="your_openai_api_key"
grok
```

### Using Anthropic (Claude)

```bash
export ANTHROPIC_API_KEY="your_anthropic_api_key"
grok
```

### Using Google Gemini

```bash
export GEMINI_API_KEY="your_gemini_api_key"
grok
```

### Using Ollama

```bash
# Start Ollama service
ollama serve

# Pull a model (if needed)
ollama pull llama3.2:latest

# Run grok-cli with Ollama
export GROKCLI_PROVIDER=ollama
grok
```

Grok CLI auto-detects your provider based on which API key is set. To explicitly choose a provider, set `GROKCLI_PROVIDER`:

```bash
export GROKCLI_PROVIDER=anthropic
grok
```

## Environment Variables

### Provider Configuration

| Provider | Environment Variable | Description |
|----------|---------------------|-------------|
| **General** | `GROKCLI_PROVIDER` | Choose provider: `xai`, `openai`, `anthropic`, `google`, `openrouter`, `groq`, `azure`, `github`, `ollama`, `custom` |
| **XAI (Grok)** | `XAI_API_KEY` | API key for xAI Grok models |
| **XAI (Grok)** | `XAI_MODEL` | Specific Grok model to use (default: `grok-4-0709`) |
| **OpenAI** | `OPENAI_API_KEY` | API key for OpenAI models |
| **Anthropic** | `ANTHROPIC_API_KEY` | API key for Anthropic Claude models |
| **Google** | `GEMINI_API_KEY` | API key for Google Gemini models |
| **OpenRouter** | `OPENROUTER_API_KEY` | API key for OpenRouter |
| **Groq** | `GROQ_API_KEY` | API key for Groq |
| **Azure OpenAI** | `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI |
| **Azure OpenAI** | `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| **GitHub** | `GITHUB_TOKEN` | GitHub token for GitHub Models |
| **Custom** | `CUSTOM_API_KEY` | API key for custom endpoint |
| **Custom** | `CUSTOM_BASE_URL` | Base URL for custom OpenAI-compatible endpoint |
| **Ollama** | `GROKCLI_OLLAMA_ENDPOINT` | Ollama service endpoint (default: `http://localhost:11434`) |
| **Ollama** | `GROKCLI_OLLAMA_MODEL` | Specific Ollama model to use (auto-detected) |
| **Ollama** | `OLLAMA_HOST` | Alternative Ollama endpoint (fallback) |
| **Debug** | `DEBUG` | Enable verbose logging |

### Provider Auto-Detection

When `GROKCLI_PROVIDER` is not set, Grok CLI auto-detects based on available API keys in this priority order:

`xai` > `openai` > `anthropic` > `google` > `openrouter` > `groq` > `azure` > `github` > `custom` > `ollama`

## Examples

Once the CLI is running, you can start interacting with AI models from your shell.

### Interactive Mode

Start a project from a new directory:

```sh
cd new-project
export XAI_API_KEY="your_key"
grok
> Write me a Discord bot that answers questions using a FAQ.md file I will provide
```

Work with an existing project using Ollama:

```sh
git clone https://github.com/stevederico/skateboard
cd skateboard
export GROKCLI_PROVIDER=ollama
grok
> Give me a summary of all of the changes that went in yesterday
```

### Non-Interactive Mode

Ask a quick question with XAI:

```sh
export XAI_API_KEY="your_key"
grok -p "Explain what this code does" < main.js
```

Use Anthropic for code review:

```sh
export ANTHROPIC_API_KEY="your_key"
echo "Review this for bugs" | grok -p "analyze the code"
```

### Next steps

- [Contribute or build from source](./CONTRIBUTING.md)
- [CLI Commands](./docs/cli/commands.md)
- [Troubleshooting guide](./docs/troubleshooting.md)
- [Full documentation](./docs/index.md)
- [Popular tasks](./docs/popular-tasks.md)

### Troubleshooting

Head over to the [troubleshooting](docs/troubleshooting.md) guide if you're
having issues.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Grok CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).

## Disclaimer

This project is not an official product or initiative of xAI or Grok. It is an independent endeavor and is not endorsed, sponsored, or affiliated with xAI or Grok in any way.

