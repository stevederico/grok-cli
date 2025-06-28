# Grok CLI Extensions

Grok CLI supports extensions that can be used to configure and extend its functionality.

## How it works

On startup, Grok CLI looks for extensions in two locations:

1.  `<workspace>/.grok-cli/extensions`
2.  `<home>/.grok-cli/extensions`

Grok CLI loads all extensions from both locations. If an extension with the same name exists in both locations, the extension in the workspace directory takes precedence.

Within each location, individual extensions exist as a directory that contains a `grok-cli-extension.json` file. For example:

`<workspace>/.grok-cli/extensions/my-extension/grok-cli-extension.json`

### `grok-cli-extension.json`

The `grok-cli-extension.json` file contains the configuration for the extension. The file has the following structure:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "mcpServers": {
    "my-server": {
      "command": "node my-server.js"
    }
  },
  "contextFileName": "GROK-CLI.md"
}
```

- `name`: The name of the extension. This is used to uniquely identify the extension. This should match the name of your extension directory.
- `version`: The version of the extension.
- `mcpServers`: A map of MCP servers to configure. The key is the name of the server, and the value is the server configuration. These servers will be loaded on startup just like MCP servers configured in a [`settings.json` file](./cli/configuration.md). If both an extension and a `settings.json` file configure an MCP server with the same name, the server defined in the `settings.json` file takes precedence.
- `contextFileName`: The name of the file that contains the context for the extension. This will be used to load the context from the workspace. If this property is not used but a `GROK-CLI.md` file is present in your extension directory, then that file will be loaded.

When Grok CLI starts, it loads all the extensions and merges their configurations. If there are any conflicts, the workspace configuration takes precedence.
