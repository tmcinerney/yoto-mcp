import type { IncomingMessage, ServerResponse } from 'node:http';

// AIDEV-NOTE: Transport interface matches StreamableHTTPServerTransport.handleRequest
export interface McpTransport {
  handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
}

export function createRequestHandler(
  transport: McpTransport,
  port: number,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/mcp') {
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  };
}
