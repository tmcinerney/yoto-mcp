import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'yoto-mcp',
    version: '0.1.0',
  });

  // AIDEV-NOTE: Tools will be registered here in Phase 3
  return server;
}
