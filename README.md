<img width="1770" height="746" alt="screenshot" src="https://github.com/user-attachments/assets/ab4a8ceb-b9de-4381-b926-42603569a109" />

# @stevederico/grok-cli

Grok CLI is the open-source terminal agent for Grok and other LLMs. It gives you a fast, beautiful, tool-using coding assistant that runs directly in your shell.

**Key Features**
- Full agentic tool use (read, write, edit, grep, shell, web search) with user approval
- Polished React/Ink terminal UI with themes and syntax highlighting
- MCP server support and extensible hook system
- macOS sandbox for safe shell execution
- Works great with Grok, Claude, GPT, Gemini, local Ollama, and more

**Supported Providers**
- **Grok (xAI)** — Best-in-class reasoning and coding models via xAI
- **Ollama** — Local models (llama, qwen, deepseek, etc.)
- **Anthropic** — Claude models
- **OpenAI** — GPT models
- **Google** — Gemini models
- **Groq**, **OpenRouter**, **Azure**, **GitHub Models**, and any OpenAI-compatible endpoint (including custom)


## Quick Start

### Install

```bash
npm i -g @stevederico/grok-cli
```

### Setup API Key

The fastest way to get started with Grok:

```bash
export XAI_API_KEY="your_xai_api_key"
grok
```

Or use the built-in setup:

```bash
grok
# Type /auth → select Grok (xAI) → paste your key
# Key is saved to ~/.grok-cli/.env
```

You can also use the `grok` provider alias:

```bash
export GROKCLI_PROVIDER=grok
grok
```

### Using Ollama (Local)

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
| **General** | `GROKCLI_PROVIDER` | Choose provider: `xai` (or `grok`), `openai`, `anthropic`, `google`, `openrouter`, `groq`, `azure`, `github`, `ollama`, `custom` |
| **XAI (Grok)** | `XAI_API_KEY` | API key for xAI Grok models |
| **XAI (Grok)** | `XAI_MODEL` | Specific Grok model to use (default: `grok-4`) |
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

`xai` (or `grok`) > `openai` > `anthropic` > `google` > `openrouter` > `groq` > `azure` > `github` > `custom` > `ollama`

## Examples

Once the CLI is running, you can start interacting with AI models from your shell.

### Interactive Mode

Start coding with Grok in any directory:

```sh
cd my-project
export XAI_API_KEY="your_key"
grok
> Build a CLI tool that fetches GitHub stars and outputs a markdown table
> Refactor the auth module to use better error handling
> Review the last 5 commits for potential bugs
```

Work with an existing project using local models (Ollama):

```sh
git clone https://github.com/stevederico/skateboard
cd skateboard
export GROKCLI_PROVIDER=ollama
grok
> Summarize the changes from the last 3 commits
```

### Non-Interactive Mode

Ask a quick question with Grok:

```sh
export XAI_API_KEY="your_key"
grok -p "Review this file for security issues and suggest improvements" < main.js
```

Use Anthropic for code review:

```sh
export ANTHROPIC_API_KEY="your_key"
echo "Review this for bugs" | grok -p "analyze the code"
```

### Documentation & Help

- [CLI Commands](./docs/cli/commands.md)
- [Popular tasks](./docs/popular-tasks.md)
- [Full documentation](./docs/index.md)
- [Troubleshooting guide](./docs/troubleshooting.md)
- [Contribute](./CONTRIBUTING.md) (build from source, run tests, etc.)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Grok CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).

## Disclaimer

This project is not an official product or initiative of xAI or Grok. It is an independent endeavor and is not endorsed, sponsored, or affiliated with xAI or Grok in any way.

