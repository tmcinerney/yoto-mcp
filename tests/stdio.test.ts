import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

describe('stdio transport', () => {
  it('starts in stdio mode with --stdio flag', async () => {
    const child = spawn('tsx', ['src/index.ts', '--stdio'], {
      env: { ...process.env, YOTO_CLIENT_ID: 'test-stdio-id' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send an MCP initialize request over stdin
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    });

    child.stdin.write(`${initRequest}\n`);

    const response = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Timeout waiting for stdio response'));
      }, 10_000);

      let data = '';
      child.stdout.on('data', (chunk: Buffer) => {
        data += chunk.toString();
        // MCP stdio responses are newline-delimited JSON
        if (data.includes('\n')) {
          clearTimeout(timeout);
          resolve(data.trim().split('\n')[0]);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString();
        // Ignore non-fatal stderr (e.g. refresh warnings for test client ID)
        if (msg.includes('Error') && !msg.includes('refresh')) {
          clearTimeout(timeout);
          reject(new Error(`stderr: ${msg}`));
        }
      });
    });

    child.kill();

    const parsed = JSON.parse(response);
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(1);
    expect(parsed.result.serverInfo.name).toBe('yoto-mcp');
    expect(parsed.result.serverInfo.version).toBe(pkg.version);
    expect(parsed.result.capabilities).toBeDefined();
  }, 15_000);

  it('starts HTTP server without --stdio flag', async () => {
    const child = spawn('tsx', ['src/index.ts'], {
      env: { ...process.env, YOTO_CLIENT_ID: 'test-http-id', YOTO_MCP_PORT: '3199' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const output = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Timeout waiting for HTTP startup'));
      }, 10_000);

      child.stdout.on('data', (chunk: Buffer) => {
        const msg = chunk.toString();
        if (msg.includes('listening')) {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    child.kill();

    expect(output).toContain('listening on port 3199');
  }, 15_000);
});
