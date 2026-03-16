import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('creates an MCP server instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  // --- Batch 3: Version from package.json ---

  it('server version is not hardcoded (reads from package.json)', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    // Verify the source file imports/reads version from package.json
    // rather than using a hardcoded string literal
    const serverSource = await readFile(join(__dirname, '..', 'src', 'server.ts'), 'utf-8');

    // The source should import version from package.json (or a constants module
    // that reads it). It should NOT contain a hardcoded version string literal
    // in the McpServer constructor.
    const hasHardcodedVersion = /version:\s*['"][0-9]+\.[0-9]+\.[0-9]+['"]/.test(serverSource);
    const importsPackageJson = /package\.json/.test(serverSource);

    expect(hasHardcodedVersion).toBe(false);
    expect(importsPackageJson).toBe(true);
  });
});
