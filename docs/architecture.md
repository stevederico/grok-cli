# Grok CLI Architecture Overview

This document provides a high-level overview of Grok CLI's architecture.

## Core components

Grok CLI is a **single package** (`@stevederico/grok-cli`) with a clear internal separation between the terminal UI and the engine.

### Main layers

1. **User Interface (TUI)**
   - Built with React + Ink (`packages/cli/src/ui/`)
   - Handles input handling, slash commands, rich terminal rendering, themes, history, provider switching, and interactive tool approval flows.

2. **Engine / Core Logic** (`packages/cli/src/core/`)
   - The reusable backend of Grok CLI.
   - Can be imported programmatically:
     ```ts
     import { runQuery, getProvider, ToolRegistry, AskUserTool } from '@stevederico/grok-cli/core';
     ```
   - Responsibilities include:
     - Multi-provider support (Grok, Claude, GPT, Gemini, Ollama, Groq, etc.)
     - Full tool system and agent loop
     - Prompt construction, token management, and hooks
     - Git and file discovery services

3. **Tools** (`packages/cli/src/core/tools/`)
   - Individual modules that give the LLM the ability to act in the environment (read/write/edit files, run shell commands, search the web, use MCP servers, manage memory, apply patches, ask the user questions, etc.).

## Interaction Flow

A typical interaction follows this flow:

1. User types a prompt in the terminal (handled by the TUI).
2. The engine constructs a prompt (including conversation history and available tool definitions) and sends it to the chosen LLM provider.
3. The LLM responds — either with a final answer or a request to use one or more tools.
4. For tools that modify state (edit, write, shell, patch, etc.), the user is shown a confirmation dialog and must approve.
5. Approved tools are executed and their results are sent back to the LLM.
6. This continues until the model produces a final response, which is then displayed in the terminal.

## Key Design Principles

- **Single package, clear internals**: One published package (`@stevederico/grok-cli`) that contains both the TUI and a reusable engine accessible via the `/core` subpath.
- **Extensibility**: New tools and providers can be added easily. The tool system and provider registry are designed for extension.
- **Safety first**: Destructive actions require explicit user approval. macOS sandbox support is available for extra safety.
- **Great terminal UX**: Rich Ink-based interface with themes, syntax highlighting, and smooth interaction.
