import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('creates an MCP server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
