# Grok CLI Execution and Deployment

This document describes how to run Grok CLI and explains the deployment architecture that Grok CLI uses.

## Running Grok CLI

There are several ways to run Grok CLI. The option you choose depends on how you intend to use Grok CLI.

---

### 1. Standard installation (Recommended for typical users)

This is the recommended way for end-users to install Grok CLI. It involves downloading the Grok CLI package from the NPM registry.

- **Global install:**

  ```bash
  # Install the CLI globally
  npm install -g grok-cli

  # Now you can run the CLI from anywhere
  grok-cli
  ```

- **NPX execution:**
  ```bash
  # Execute the latest version from NPM without a global install
  npx grok-cli
  ```

---

### 2. Running in a sandbox (Docker/Podman)

For security and isolation, Grok CLI can be run inside a container. This is the default way that the CLI executes tools that might have side effects.

- **Directly from the Registry:**
  You can run the published sandbox image directly. This is useful for environments where you only have Docker and want to run the CLI.
  ```bash
  # Run the published sandbox image
  docker run --rm -it grok-cli-sandbox:latest
  ```
- **Using the `--sandbox` flag:**
  If you have Grok CLI installed locally (using the standard installation described above), you can instruct it to run inside the sandbox container.
  ```bash
  grok-cli --sandbox "your prompt here"
  ```

---

### 3. Running from source (Recommended for Grok CLI contributors)

Contributors to the project will want to run the CLI directly from the source code.

- **Development Mode:**
  This method provides hot-reloading and is useful for active development.
  ```bash
  # From the root of the repository
  npm run start
  ```
- **Production-like mode (Linked package):**
  This method simulates a global installation by linking your local package. It's useful for testing a local build in a production workflow.

  ```bash
  # Link the local cli package to your global node_modules
  npm link packages/cli

  # Now you can run your local version using the `grok-cli` command
  grok-cli
  ```

---

### 4. Running the latest Grok CLI commit from GitHub

You can run the most recently committed version of Grok CLI directly from the GitHub repository. This is useful for testing features still in development.

```bash
# Execute the CLI directly from the main branch on GitHub
npx https://github.com/stevederico/grok-cli
```

## Deployment architecture

The execution methods described above are made possible by the following architectural components and processes:

**NPM packages**

Grok CLI project is a monorepo that publishes two core packages to the NPM registry:

- `grok-cli-core`: The backend, handling logic and tool execution.
- `grok-cli`: The user-facing frontend.

These packages are used when performing the standard installation and when running Grok CLI from the source.

**Build and packaging processes**

There are two distinct build processes used, depending on the distribution channel:

- **NPM publication:** For publishing to the NPM registry, the TypeScript source code in `grok-cli-core` and `grok-cli` is transpiled into standard JavaScript using the TypeScript Compiler (`tsc`). The resulting `dist/` directory is what gets published in the NPM package. This is a standard approach for TypeScript libraries.

- **GitHub `npx` execution:** When running the latest version of Grok CLI directly from GitHub, a different process is triggered by the `prepare` script in `package.json`. This script uses `esbuild` to bundle the entire application and its dependencies into a single, self-contained JavaScript file. This bundle is created on-the-fly on the user's machine and is not checked into the repository.

**Docker sandbox image**

The Docker-based execution method is supported by the `grok-cli-sandbox` container image. This image is published to a container registry and contains a pre-installed, global version of Grok CLI. The `scripts/prepare-cli-packagejson.js` script dynamically injects the URI of this image into the CLI's `package.json` before publishing, so the CLI knows which image to pull when the `--sandbox` flag is used.

## Release process

A unified script, `npm run publish:release`, orchestrates the release process. The script performs the following actions:

1.  Build the NPM packages using `tsc`.
2.  Update the CLI's `package.json` with the Docker image URI.
3.  Build and tag the `grok-cli-sandbox` Docker image.
4.  Push the Docker image to the container registry.
5.  Publish the NPM packages to the artifact registry.
