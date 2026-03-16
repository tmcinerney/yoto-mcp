import type { IncomingMessage, ServerResponse } from 'node:http';

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
      try {
        await transport.handleRequest(req, res);
      } catch (err) {
        console.error('MCP transport error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  };
}
