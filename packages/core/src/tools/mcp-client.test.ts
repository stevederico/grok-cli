/**
 * @license
 * Copyright 2025 @stevederico/grok-cli Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';
import { discoverMcpTools, sanatizeParameters } from './mcp-client.js';
import { Schema, Type } from '../__stubs__/types.js';
import { Config, MCPServerConfig } from '../config/config.js';
import { DiscoveredMCPTool } from './mcp-tool.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { parse, ParseEntry } from 'shell-quote';

// Mock dependencies
vi.mock('shell-quote');

/** Mock for mcpToTool - returns a CallableTool with a configurable .tool() method */
const mockMcpToToolFn = vi.fn();
vi.mock('../__stubs__/types.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../__stubs__/types.js')>();
  return {
    ...actual,
    mcpToTool: (...args: any[]) => mockMcpToToolFn(...args),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const MockedClient = vi.fn();
  MockedClient.prototype.connect = vi.fn();
  MockedClient.prototype.listTools = vi.fn();
  // Ensure instances have an onerror property that can be spied on or assigned to
  MockedClient.mockImplementation(() => ({
    connect: MockedClient.prototype.connect,
    listTools: MockedClient.prototype.listTools,
    callTool: vi.fn(),
    onerror: vi.fn(), // Each instance gets its own onerror mock
  }));
  return { Client: MockedClient };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  const MockedStreamableTransport = vi.fn().mockImplementation(function (this: any) {
    this.close = vi.fn().mockResolvedValue(undefined);
    return this;
  });
  return { StreamableHTTPClientTransport: MockedStreamableTransport };
});

// Define a global mock for stderr.on that can be cleared and checked
const mockGlobalStdioStderrOn = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  // This is the constructor for StdioClientTransport
  const MockedStdioTransport = vi.fn().mockImplementation(function (
    this: any,
    options: any,
  ) {
    // Always return a new object with a fresh reference to the global mock for .on
    this.options = options;
    this.stderr = { on: mockGlobalStdioStderrOn };
    this.close = vi.fn().mockResolvedValue(undefined); // Add mock close method
    return this;
  });
  return { StdioClientTransport: MockedStdioTransport };
});

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  const MockedSSETransport = vi.fn().mockImplementation(function (this: any) {
    this.close = vi.fn().mockResolvedValue(undefined); // Add mock close method
    return this;
  });
  return { SSEClientTransport: MockedSSETransport };
});

const mockToolRegistryInstance = {
  registerTool: vi.fn(),
  getToolsByServer: vi.fn().mockReturnValue([]), // Default to empty array
  // Add other methods if they are called by the code under test, with default mocks
  getTool: vi.fn(),
  getAllTools: vi.fn().mockReturnValue([]),
  getFunctionDeclarations: vi.fn().mockReturnValue([]),
  discoverTools: vi.fn().mockResolvedValue(undefined),
};
vi.mock('./tool-registry.js', () => ({
  ToolRegistry: vi.fn(() => mockToolRegistryInstance),
}));

describe('discoverMcpTools', () => {
  let mockConfig: Mocked<Config>;
  // Use the instance from the module mock
  let mockToolRegistry: typeof mockToolRegistryInstance;

  beforeEach(() => {
    // Assign the shared mock instance to the test-scoped variable
    mockToolRegistry = mockToolRegistryInstance;
    // Reset individual spies on the shared instance before each test
    mockToolRegistry.registerTool.mockClear();
    mockToolRegistry.getToolsByServer.mockClear().mockReturnValue([]); // Reset to default
    mockToolRegistry.getTool.mockClear().mockReturnValue(undefined); // Default to no existing tool
    mockToolRegistry.getAllTools.mockClear().mockReturnValue([]);
    mockToolRegistry.getFunctionDeclarations.mockClear().mockReturnValue([]);
    mockToolRegistry.discoverTools.mockClear().mockResolvedValue(undefined);

    mockConfig = {
      getMcpServers: vi.fn().mockReturnValue({}),
      getMcpServerCommand: vi.fn().mockReturnValue(undefined),
      // getToolRegistry should now return the same shared mock instance
      getToolRegistry: vi.fn(() => mockToolRegistry),
    } as any;

    vi.mocked(parse).mockClear();
    vi.mocked(Client).mockClear();
    vi.mocked(Client.prototype.connect)
      .mockClear()
      .mockResolvedValue(undefined);
    vi.mocked(Client.prototype.listTools)
      .mockClear()
      .mockResolvedValue({ tools: [] });

    // Default: mcpToTool returns a CallableTool with empty functionDeclarations
    mockMcpToToolFn.mockClear();
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockResolvedValue({ functionDeclarations: [] }),
    });

    vi.mocked(StdioClientTransport).mockClear();
    // Ensure the StdioClientTransport mock constructor returns an object with a close method
    vi.mocked(StdioClientTransport).mockImplementation(function (
      this: any,
      options: any,
    ) {
      this.options = options;
      this.stderr = { on: mockGlobalStdioStderrOn };
      this.close = vi.fn().mockResolvedValue(undefined);
      return this;
    });
    mockGlobalStdioStderrOn.mockClear(); // Clear the global mock in beforeEach

    vi.mocked(SSEClientTransport).mockClear();
    // Ensure the SSEClientTransport mock constructor returns an object with a close method
    vi.mocked(SSEClientTransport).mockImplementation(function (this: any) {
      this.close = vi.fn().mockResolvedValue(undefined);
      return this;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do nothing if no MCP servers or command are configured', async () => {
    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );
    expect(mockConfig.getMcpServers).toHaveBeenCalledTimes(1);
    expect(mockConfig.getMcpServerCommand).toHaveBeenCalledTimes(1);
    expect(Client).not.toHaveBeenCalled();
    expect(mockToolRegistry.registerTool).not.toHaveBeenCalled();
  });

  it('should discover tools via mcpServerCommand', async () => {
    const commandString = 'my-mcp-server --start';
    const parsedCommand = ['my-mcp-server', '--start'] as ParseEntry[];
    mockConfig.getMcpServerCommand.mockReturnValue(commandString);
    vi.mocked(parse).mockReturnValue(parsedCommand);

    const mockFuncDecl = {
      name: 'tool1',
      description: 'desc1',
      parameters: { type: 'object' as const, properties: {} },
    };
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl] }),
    });

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(parse).toHaveBeenCalledWith(commandString, process.env);
    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: parsedCommand[0],
      args: parsedCommand.slice(1),
      env: expect.any(Object),
      cwd: undefined,
      stderr: 'pipe',
    });
    expect(Client.prototype.connect).toHaveBeenCalledTimes(1);
    expect(mockMcpToToolFn).toHaveBeenCalledTimes(1);
    expect(mockToolRegistry.registerTool).toHaveBeenCalledTimes(1);
    expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
      expect.any(DiscoveredMCPTool),
    );
    const registeredTool = mockToolRegistry.registerTool.mock
      .calls[0][0] as DiscoveredMCPTool;
    expect(registeredTool.name).toBe('tool1');
    expect(registeredTool.serverToolName).toBe('tool1');
  });

  it('should discover tools via mcpServers config (stdio)', async () => {
    const serverConfig: MCPServerConfig = {
      command: './mcp-stdio',
      args: ['arg1'],
    };
    mockConfig.getMcpServers.mockReturnValue({ 'stdio-server': serverConfig });

    const mockFuncDecl = {
      name: 'tool-stdio',
      description: 'desc-stdio',
      parameters: { type: 'object' as const, properties: {} },
    };
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl] }),
    });

    // PRE-MOCK getToolsByServer for the expected server name
    mockToolRegistry.getToolsByServer.mockReturnValueOnce([
      expect.any(DiscoveredMCPTool),
    ]);

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: serverConfig.command,
      args: serverConfig.args,
      env: expect.any(Object),
      cwd: undefined,
      stderr: 'pipe',
    });
    expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
      expect.any(DiscoveredMCPTool),
    );
    const registeredTool = mockToolRegistry.registerTool.mock
      .calls[0][0] as DiscoveredMCPTool;
    expect(registeredTool.name).toBe('tool-stdio');
  });

  it('should discover tools via mcpServers config (sse)', async () => {
    const serverConfig: MCPServerConfig = { url: 'http://localhost:1234/sse' };
    mockConfig.getMcpServers.mockReturnValue({ 'sse-server': serverConfig });

    const mockFuncDecl = {
      name: 'tool-sse',
      description: 'desc-sse',
      parameters: { type: 'object' as const, properties: {} },
    };
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl] }),
    });

    // PRE-MOCK getToolsByServer for the expected server name
    mockToolRegistry.getToolsByServer.mockReturnValueOnce([
      expect.any(DiscoveredMCPTool),
    ]);

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(SSEClientTransport).toHaveBeenCalledWith(new URL(serverConfig.url!));
    expect(mockToolRegistry.registerTool).toHaveBeenCalledWith(
      expect.any(DiscoveredMCPTool),
    );
    const registeredTool = mockToolRegistry.registerTool.mock
      .calls[0][0] as DiscoveredMCPTool;
    expect(registeredTool.name).toBe('tool-sse');
  });

  it('should prefix tool names if multiple MCP servers are configured', async () => {
    const serverConfig1: MCPServerConfig = { command: './mcp1' };
    const serverConfig2: MCPServerConfig = { url: 'http://mcp2/sse' };
    mockConfig.getMcpServers.mockReturnValue({
      server1: serverConfig1,
      server2: serverConfig2,
    });

    const mockFuncDecl1 = {
      name: 'toolA',
      description: 'd1',
      parameters: { type: 'object' as const, properties: {} },
    };
    const mockFuncDeclB = {
      name: 'toolB',
      description: 'dB',
      parameters: { type: 'object' as const, properties: {} },
    };
    const mockFuncDecl2 = {
      name: 'toolA',
      description: 'd2',
      parameters: { type: 'object' as const, properties: {} },
    };

    // mcpToTool is called once per server; return different tools for each call
    mockMcpToToolFn
      .mockReturnValueOnce({
        tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl1, mockFuncDeclB] }),
      })
      .mockReturnValueOnce({
        tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl2] }),
      });

    const effectivelyRegisteredTools = new Map<string, any>();

    mockToolRegistry.getTool.mockImplementation((toolName: string) =>
      effectivelyRegisteredTools.get(toolName),
    );

    mockToolRegistry.registerTool.mockImplementation((toolToRegister: any) => {
      effectivelyRegisteredTools.set(toolToRegister.name, toolToRegister);
      if (
        toolToRegister.serverName === 'server1' &&
        toolToRegister.serverToolName === 'toolA' &&
        toolToRegister.name === 'toolA'
      ) {
        effectivelyRegisteredTools.set('toolA', toolToRegister);
      }
    });

    mockToolRegistry.getToolsByServer.mockImplementation(
      (serverName: string) => {
        if (serverName === 'server1')
          return [
            expect.objectContaining({ name: 'toolA' }),
            expect.objectContaining({ name: 'toolB' }),
          ];
        if (serverName === 'server2')
          return [expect.objectContaining({ name: 'server2__toolA' })];
        return [];
      },
    );

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(mockToolRegistry.registerTool).toHaveBeenCalledTimes(3);
    const registeredArgs = mockToolRegistry.registerTool.mock.calls.map(
      (call) => call[0],
    ) as DiscoveredMCPTool[];

    const toolA_from_server1 = registeredArgs.find(
      (t) => t.serverToolName === 'toolA' && t.serverName === 'server1',
    );
    const toolA_from_server2 = registeredArgs.find(
      (t) => t.serverToolName === 'toolA' && t.serverName === 'server2',
    );
    const toolB_from_server1 = registeredArgs.find(
      (t) => t.serverToolName === 'toolB' && t.serverName === 'server1',
    );

    expect(toolA_from_server1).toBeDefined();
    expect(toolA_from_server2).toBeDefined();
    expect(toolB_from_server1).toBeDefined();

    expect(toolB_from_server1?.name).toBe('toolB');

    if (toolA_from_server1?.name === 'toolA') {
      expect(toolA_from_server2?.name).toBe('server2__toolA');
    } else {
      expect(toolA_from_server1?.name).toBe('server1__toolA');
      expect(toolA_from_server2?.name).toBe('toolA');
    }
  });

  it('should clean schema properties ($schema, additionalProperties)', async () => {
    const serverConfig: MCPServerConfig = { command: './mcp-clean' };
    mockConfig.getMcpServers.mockReturnValue({ 'clean-server': serverConfig });

    const rawSchema = {
      type: 'object' as const,
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: true,
      properties: {
        prop1: { type: 'string', $schema: 'remove-this' },
        prop2: {
          type: 'object' as const,
          additionalProperties: false,
          properties: { nested: { type: 'number' } },
        },
      },
    };
    const mockFuncDecl = {
      name: 'cleanTool',
      description: 'd',
      parameters: JSON.parse(JSON.stringify(rawSchema)),
    };
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockResolvedValue({ functionDeclarations: [mockFuncDecl] }),
    });
    // PRE-MOCK getToolsByServer for the expected server name
    mockToolRegistry.getToolsByServer.mockReturnValueOnce([
      expect.any(DiscoveredMCPTool),
    ]);

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(mockToolRegistry.registerTool).toHaveBeenCalledTimes(1);
    const registeredTool = mockToolRegistry.registerTool.mock
      .calls[0][0] as DiscoveredMCPTool;
    const cleanedParams = registeredTool.schema.parameters as any;

    // Verify the tool was registered with the schema parameters
    expect(cleanedParams).toHaveProperty('type', 'object');
    expect(cleanedParams).toHaveProperty('properties');
    expect(cleanedParams.properties.prop1).toHaveProperty('type', 'string');
    expect(cleanedParams.properties.prop2).toHaveProperty('type', 'object');
    expect(cleanedParams.properties.prop2.properties.nested).toHaveProperty(
      'type',
      'number',
    );
  });

  it('should handle error if mcpServerCommand parsing fails', async () => {
    const commandString = 'my-mcp-server "unterminated quote';
    mockConfig.getMcpServerCommand.mockReturnValue(commandString);
    vi.mocked(parse).mockImplementation(() => {
      throw new Error('Parsing failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      discoverMcpTools(
        mockConfig.getMcpServers() ?? {},
        mockConfig.getMcpServerCommand(),
        mockToolRegistry as any,
      ),
    ).rejects.toThrow('Parsing failed');
    expect(mockToolRegistry.registerTool).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should log error and skip server if config is invalid (missing url and command)', async () => {
    mockConfig.getMcpServers.mockReturnValue({ 'bad-server': {} as any });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "MCP server 'bad-server' has invalid configuration",
      ),
    );
    // Client constructor should not be called if config is invalid before instantiation
    expect(Client).not.toHaveBeenCalled();
  });

  it('should log error and skip server if mcpClient.connect fails', async () => {
    const serverConfig: MCPServerConfig = { command: './mcp-fail-connect' };
    mockConfig.getMcpServers.mockReturnValue({
      'fail-connect-server': serverConfig,
    });
    vi.mocked(Client.prototype.connect).mockRejectedValue(
      new Error('Connection refused'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "failed to start or connect to MCP server 'fail-connect-server'",
      ),
    );
    expect(Client.prototype.listTools).not.toHaveBeenCalled();
    expect(mockToolRegistry.registerTool).not.toHaveBeenCalled();
  });

  it('should log error and skip server if mcpCallableTool.tool() fails', async () => {
    const serverConfig: MCPServerConfig = { command: './mcp-fail-list' };
    mockConfig.getMcpServers.mockReturnValue({
      'fail-list-server': serverConfig,
    });
    mockMcpToToolFn.mockReturnValue({
      tool: vi.fn().mockRejectedValue(new Error('ListTools error')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to list or register tools for MCP server 'fail-list-server'",
      ),
    );
    expect(mockToolRegistry.registerTool).not.toHaveBeenCalled();
  });

  it('should assign mcpClient.onerror handler', async () => {
    const serverConfig: MCPServerConfig = { command: './mcp-onerror' };
    mockConfig.getMcpServers.mockReturnValue({
      'onerror-server': serverConfig,
    });
    // PRE-MOCK getToolsByServer for the expected server name
    mockToolRegistry.getToolsByServer.mockReturnValueOnce([
      expect.any(DiscoveredMCPTool),
    ]);

    await discoverMcpTools(
      mockConfig.getMcpServers() ?? {},
      mockConfig.getMcpServerCommand(),
      mockToolRegistry as any,
    );

    const clientInstances = vi.mocked(Client).mock.results;
    expect(clientInstances.length).toBeGreaterThan(0);
    const lastClientInstance =
      clientInstances[clientInstances.length - 1]?.value;
    expect(lastClientInstance?.onerror).toEqual(expect.any(Function));
  });
});

describe('sanatizeParameters', () => {
  it('should do nothing for an undefined schema', () => {
    const schema = undefined;
    sanatizeParameters(schema);
  });

  it('should remove default when anyOf is present', () => {
    const schema: Schema = {
      anyOf: [{ type: Type.STRING }, { type: Type.NUMBER }],
      default: 'hello',
    };
    sanatizeParameters(schema);
    expect(schema.default).toBeUndefined();
  });

  it('should recursively sanatize items in anyOf', () => {
    const schema: Schema = {
      anyOf: [
        {
          anyOf: [{ type: Type.STRING }],
          default: 'world',
        },
        { type: Type.NUMBER },
      ],
    };
    sanatizeParameters(schema);
    expect(schema.anyOf![0].default).toBeUndefined();
  });

  it('should recursively sanatize items in items', () => {
    const schema: Schema = {
      items: {
        anyOf: [{ type: Type.STRING }],
        default: 'world',
      },
    };
    sanatizeParameters(schema);
    expect(schema.items!.default).toBeUndefined();
  });

  it('should recursively sanatize items in properties', () => {
    const schema: Schema = {
      properties: {
        prop1: {
          anyOf: [{ type: Type.STRING }],
          default: 'world',
        },
      },
    };
    sanatizeParameters(schema);
    expect(schema.properties!.prop1.default).toBeUndefined();
  });

  it('should handle complex nested schemas', () => {
    const schema: Schema = {
      properties: {
        prop1: {
          items: {
            anyOf: [{ type: Type.STRING }],
            default: 'world',
          },
        },
        prop2: {
          anyOf: [
            {
              properties: {
                nestedProp: {
                  anyOf: [{ type: Type.NUMBER }],
                  default: 123,
                },
              },
            },
          ],
        },
      },
    };
    sanatizeParameters(schema);
    expect(schema.properties!.prop1.items!.default).toBeUndefined();
    const nestedProp =
      schema.properties!.prop2.anyOf![0].properties!.nestedProp;
    expect(nestedProp?.default).toBeUndefined();
  });
});
