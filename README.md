# @stevederico/grok-cli

<img width="719" height="432" alt="Screenshot 2025-07-16 at 1 13 58 PM" src="https://github.com/user-attachments/assets/cd174977-c5cc-4f00-8dbd-3dde6697b7d8" />




Grok CLI is an open-source interactive CLI tool that provides a flexible and powerful interface for AI-assisted workflows.

## Key Benefits

- **Interactive CLI Experience**: Streamlined, user-friendly command-line interface
- **Built-in Provider Support**: 
  - Grok (xAI)
  - Ollama
  - Easily extendable to other providers

## Environment Variables

### Provider Configuration

| Provider | Environment Variable | Description | Example |
|----------|---------------------|-------------|---------|
| Grok (xAI) | `XAI_API_KEY` | API key for Grok AI | `export XAI_API_KEY="your_grok_api_key"` |
| Grok (xAI) | `XAI_MODEL` | Specific Grok model to use | `export XAI_MODEL="grok-4-0709"` |
| Ollama | `OLLAMA_HOST` | Ollama server endpoint | `export OLLAMA_HOST="http://localhost:11434"` |

### General Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `GROK_CLI_PROVIDER` | Set the default AI provider | `grok` | `export GROK_CLI_PROVIDER="ollama"` |
| `GROK_CLI_MODEL` | Set the default model for the provider | Provider-specific | `export GROK_CLI_MODEL="llama3"` |

## Quickstart

1. **Prerequisites:** Install [Node.js 18+](https://nodejs.org/en/download).
2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Provider:**
   Set your preferred LLM provider's API key or local endpoint

   ```bash
   # For Grok
   export XAI_API_KEY="your_grok_api_key"

   # For Ollama (local inference)
   export OLLAMA_HOST="http://localhost:11434"
   ```

4. **Start the CLI:**

   ```bash
   npm start
   ```

5. **Pick a color theme**

You can now choose between Light and Dark themes for Grok CLI.

You are now ready to use Grok CLI!

## Examples

Once the CLI is running, you can start interacting with AI models from your shell.

You can start a project from a new directory:

```sh
cd new-project
> Write me a Discord bot that answers questions using a FAQ.md file I will provide
```

Or work with an existing project:

```sh
git clone https://github.com/stevederico/grok-cli
cd grok-cli
grok
> Give me a summary of all of the changes that went in yesterday
```

### Next steps

- [Contribute or build from source](./CONTRIBUTING.md)
- [CLI Commands](./docs/cli/commands.md)
- [Troubleshooting guide](./docs/troubleshooting.md)
- [Full documentation](./docs/index.md)
- [Popular tasks](#popular-tasks)

### Troubleshooting

Head over to the [troubleshooting](docs/troubleshooting.md) guide if you're
having issues.

## Popular tasks

### Explore a new codebase

Start by `cd`ing into an existing or newly-cloned repository and running `grok`.

```text
> Describe the main pieces of this system's architecture.
```

```text
> What security mechanisms are in place?
```

### Work with your existing code

```text
> Implement a first draft for GitHub issue #123.
```

```text
> Help me migrate this codebase to the latest version of Java. Start with a plan.
```

### Automate your workflows

Use MCP servers to integrate your local system tools with your enterprise collaboration suite.

```text
> Make me a slide deck showing the git history from the last 7 days, grouped by feature and team member.
```

```text
> Make a full-screen web app for a wall display to show our most interacted-with GitHub issues.
```

### Interact with your system

```text
> Convert all the images in this directory to png, and rename them to use dates from the exif data.
```

```text
> Organise my PDF invoices by month of expenditure.
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Grok CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).

## Disclaimer

This project is not an official product or initiative of xAI or Grok. It is an independent endeavor and is not endorsed, sponsored, or affiliated with xAI or Grok in any way.

## Acknowledgments

This project is based on and inspired by the excellent work from [Google's Gemini CLI](https://github.com/google-gemini/gemini-cli). We acknowledge and appreciate their foundational contributions to the open-source AI tooling ecosystem.
