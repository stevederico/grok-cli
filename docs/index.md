# Welcome to Grok CLI documentation

This documentation provides a comprehensive guide to installing, using, and developing Grok CLI. This tool lets you interact with various LLM models through a command-line interface.

## Overview

Grok CLI brings powerful LLM agents (especially Grok) directly into your terminal. It is a single package (`@stevederico/grok-cli`) containing both a rich React/Ink TUI and a reusable engine that can also be used programmatically via `@stevederico/grok-cli/core`.

## Navigating the documentation

This documentation is organized into the following sections:

- **[Execution and Deployment](./deployment.md):** Information for running Grok CLI.
- **[Architecture Overview](./architecture.md):** Understand the high-level design of Grok CLI, including its components and how they interact.
- **CLI Usage:** Documentation for the terminal interface.
  - **[CLI Introduction](./cli/index.md):** Overview of the command-line interface.
  - **[Commands](./cli/commands.md):** Description of available CLI commands.
  - **[Popular Tasks](./popular-tasks.md):** A guide to performing popular tasks with Grok CLI.
  - **[Checkpointing](./checkpointing.md):** Documentation for the checkpointing feature.
  - **[Extensions](./extension.md):** How to extend the CLI with new functionality.
- **Programmatic Usage:**
  - The core engine is available via `@stevederico/grok-cli/core` (see [Architecture](./architecture.md)).
- **Tools:**
  - **[Tools Overview](./tools/index.md):** Overview of the available tools.
  - **[File System Tools](./tools/file-system.md):** Documentation for the `read_file` and `write_file` tools.
  - **[Multi-File Read Tool](./tools/multi-file.md):** Documentation for the `read_many_files` tool.
  - **[Shell Tool](./tools/shell.md):** Documentation for the `run_shell_command` tool.
  - **[Web Fetch Tool](./tools/web-fetch.md):** Documentation for the `web_fetch` tool.
  - **[Memory Tool](./tools/memory.md):** Documentation for the `save_memory` tool.
- **[Contributing & Development Guide](../CONTRIBUTING.md):** Information for contributors and developers, including setup, building, testing, and coding conventions.
- **[Troubleshooting Guide](./troubleshooting.md):** Find solutions to common problems and FAQs.
- **[Terms of Service and Privacy Notice](./tos-privacy.md):** Information on the terms of service and privacy notices applicable to your use of Grok CLI.

We hope this documentation helps you make the most of Grok CLI!
