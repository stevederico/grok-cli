# Troubleshooting Guide

This guide provides solutions to common issues and debugging tips.

## Authentication

- **Error: `XAI_API_KEY not set` or `Authentication failed`**

  - Ensure you have set the `XAI_API_KEY` environment variable with a valid API key from the xAI console.
  - Verify the key is exported in your current shell session:
    ```bash
    echo $XAI_API_KEY
    ```
  - If using Ollama, ensure `GROKCLI_PROVIDER` is set to `ollama` and the Ollama service is running.

- **Error: Ollama connection refused or timeout**

  - Verify Ollama is running: `curl http://localhost:11434/api/tags`
  - Check your endpoint configuration: `GROKCLI_OLLAMA_ENDPOINT` (preferred) or `OLLAMA_HOST`
  - If Ollama is on a non-default port or remote host, update the endpoint accordingly.

## Frequently asked questions (FAQs)

- **Q: How do I update Grok CLI to the latest version?**

  - A: If installed globally via npm, update Grok CLI using the command `npm install -g @stevederico/grok-cli@latest`. If run from source, pull the latest changes from the repository and rebuild using `npm run build`.

- **Q: Where are Grok CLI configuration files stored?**

  - A: The CLI configuration is stored within two `settings.json` files: one in your home directory and one in your project's root directory. In both locations, `settings.json` is found in the `.grok-cli/` folder.

- **Q: How do I switch providers?**

  - A: Use the `/provider` command interactively, or set the `GROKCLI_PROVIDER` environment variable to `grok` or `ollama`.

## Common error messages and solutions

- **Error: `EADDRINUSE` (Address already in use) when starting an MCP server.**

  - **Cause:** Another process is already using the port the MCP server is trying to bind to.
  - **Solution:**
    Either stop the other process that is using the port or configure the MCP server to use a different port.

- **Error: Command not found (when attempting to run Grok CLI).**

  - **Cause:** Grok CLI is not correctly installed or not in your system's PATH.
  - **Solution:**
    1.  Ensure Grok CLI installation was successful.
    2.  If installed globally, check that your npm global binary directory is in your PATH.
    3.  If running from source, ensure you are using the correct command to invoke it (e.g., `node packages/cli/dist/index.js ...`).

- **Error: `MODULE_NOT_FOUND` or import errors.**

  - **Cause:** Dependencies are not installed correctly, or the project hasn't been built.
  - **Solution:**
    1.  Run `npm install` to ensure all dependencies are present.
    2.  Run `npm run build` to compile the project.

- **Error: "Operation not permitted", "Permission denied", or similar.**

  - **Cause:** If sandboxing is enabled, then the application is likely attempting an operation restricted by your sandbox, such as writing outside the project directory or system temp directory.
  - **Solution:** See [Sandboxing](./sandbox.md) for more information.

- **Error: Request timeout or slow responses.**

  - **Cause:** Network issues, provider API latency, or Ollama model loading.
  - **Solution:**
    1.  Check your internet connection (for xAI provider).
    2.  For Ollama, the first request after loading a model may be slow. Subsequent requests should be faster.
    3.  Run with `DEBUG=1 grok` to see detailed request/response timing.

## Debugging Tips

- **Enable debug mode:**

  - Run `DEBUG=1 grok` to enable verbose logging of API requests, retries, and internal state.

- **CLI debugging:**

  - Check the CLI logs, often found in a user-specific configuration or cache directory.

- **Core debugging:**

  - Check the server console output for error messages or stack traces.
  - Use Node.js debugging tools (e.g., `node --inspect`) if you need to step through server-side code.

- **Tool issues:**

  - If a specific tool is failing, try to isolate the issue by running the simplest possible version of the command or operation the tool performs.
  - For `run_shell_command`, check that the command works directly in your shell first.
  - For file system tools, double-check paths and permissions.

If you encounter an issue not covered here, consider searching the project's issue tracker on GitHub or reporting a new issue with detailed information.
