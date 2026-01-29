# @stevederico/grok-cli
<img width="1934" height="820" alt="screenshot" src="https://github.com/user-attachments/assets/cdb7b6ee-e95d-4c6d-b5d4-e49671134f58" />

Grok CLI is an open-source interactive CLI tool that provides a flexible and powerful interface for AI-assisted workflows.

**Supported Providers:**
- **XAI (Grok)** - Cloud-based Grok models via xAI API
- **Ollama** - Local LLM inference with any Ollama model

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

## Environment Variables

### Provider Configuration

| Provider | Environment Variable | Description | Default | Example |
|----------|---------------------|-------------|---------|---------|
| **General** | `GROKCLI_PROVIDER` | Choose provider: `xai`, `grok`, or `ollama` | `xai` | `export GROKCLI_PROVIDER="ollama"` |
| **XAI (Grok)** | `XAI_API_KEY` | API key for xAI Grok models (required for XAI) | - | `export XAI_API_KEY="your_key"` |
| **XAI (Grok)** | `XAI_MODEL` | Specific Grok model to use | `grok-4-0709` | `export XAI_MODEL="grok-4-0709"` |
| **Ollama** | `GROKCLI_OLLAMA_ENDPOINT` | Ollama service endpoint | `http://localhost:11434` | `export GROKCLI_OLLAMA_ENDPOINT="http://localhost:11434"` |
| **Ollama** | `GROKCLI_OLLAMA_MODEL` | Specific Ollama model to use | Auto-detected | `export GROKCLI_OLLAMA_MODEL="llama3.2:latest"` |
| **Ollama** | `OLLAMA_HOST` | Alternative endpoint (fallback) | - | `export OLLAMA_HOST="http://localhost:11434"` |
| **Debug** | `DEBUG` | Enable verbose logging | - | `export DEBUG=1` |


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

Use Ollama for code review:

```sh
export GROKCLI_PROVIDER=ollama
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

