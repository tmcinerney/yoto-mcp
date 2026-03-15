import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { startPeriodicRefresh } from './auth/token-refresh.js';
import { TokenStore } from './auth/token-store.js';
import { loadConfig } from './config.js';
import { createRequestHandler } from './http-handler.js';
import { createServer } from './server.js';
import { ToolContext } from './tools/shared.js';

const config = loadConfig();
const store = new TokenStore(config.configDir);
await store.load();

const ctx = new ToolContext(store, config.auth);
const mcpServer = createServer(ctx);

// AIDEV-NOTE: Periodic refresh invalidates cached SDKs so they get fresh tokens
// AIDEV-NOTE: Cleanup function retained for graceful shutdown
void startPeriodicRefresh(config.auth, store, (refreshedIds) => {
  for (const id of refreshedIds) {
    ctx.invalidateSdk(id);
  }
});

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

await mcpServer.connect(transport);

const handler = createRequestHandler(transport, config.port);
const httpServer = createHttpServer(handler);

httpServer.listen(config.port, () => {
  console.log(`yoto-mcp server listening on port ${config.port}`);
});
