import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export function createMcpServer(tools) {
  const server = new McpServer({
    name: 'sonarqube-mcp-fixer',
    version: '0.1.0'
  });

  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
  }

  return server;
}

export async function startStdioServer(tools) {
  const server = createMcpServer(tools);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
