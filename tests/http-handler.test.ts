import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createRequestHandler } from '../src/http-handler.js';

function createMockReq(url: string, method = 'GET'): IncomingMessage {
  return { url, method } as IncomingMessage;
}

function createMockRes() {
  const res = {
    writeHead: vi.fn().mockReturnThis(),
    end: vi.fn(),
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  return res;
}

function createMockTransport() {
  return {
    handleRequest: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createRequestHandler', () => {
  it('returns 200 JSON on /health', async () => {
    const handler = createRequestHandler(createMockTransport(), 3100);
    const res = createMockRes();

    await handler(createMockReq('/health'), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }));
  });

  it('delegates /mcp to transport.handleRequest', async () => {
    const transport = createMockTransport();
    const handler = createRequestHandler(transport, 3100);
    const req = createMockReq('/mcp', 'POST');
    const res = createMockRes();

    await handler(req, res);

    expect(transport.handleRequest).toHaveBeenCalledWith(req, res);
  });

  it('returns 404 for unknown routes', async () => {
    const handler = createRequestHandler(createMockTransport(), 3100);
    const res = createMockRes();

    await handler(createMockReq('/unknown'), res);

    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith('Not found');
  });

  it('handles /health with query params', async () => {
    const handler = createRequestHandler(createMockTransport(), 3100);
    const res = createMockRes();

    await handler(createMockReq('/health?verbose=true'), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
  });

  it('returns 404 for root path', async () => {
    const handler = createRequestHandler(createMockTransport(), 3100);
    const res = createMockRes();

    await handler(createMockReq('/'), res);

    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  it('returns 500 when transport.handleRequest throws', async () => {
    const transport = createMockTransport();
    vi.mocked(transport.handleRequest).mockRejectedValue(new Error('Transport blew up'));
    const handler = createRequestHandler(transport, 3100);
    const req = createMockReq('/mcp', 'POST');
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(res.end).toHaveBeenCalled();
  });

  it('does not crash when transport throws after headers sent', async () => {
    const transport = createMockTransport();
    vi.mocked(transport.handleRequest).mockImplementation(async (_req, res) => {
      res.writeHead(200);
      throw new Error('Boom after headers');
    });
    const handler = createRequestHandler(transport, 3100);
    const req = createMockReq('/mcp', 'POST');
    const res = createMockRes();
    // Simulate headersSent being true after writeHead
    Object.defineProperty(res, 'headersSent', { get: () => true });

    // Should not throw — handler catches the error gracefully
    await expect(handler(req, res)).resolves.toBeUndefined();
  });
});
