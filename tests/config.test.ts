import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when YOTO_CLIENT_ID is missing', () => {
    expect(() => loadConfig({})).toThrow('YOTO_CLIENT_ID');
  });

  it('throws when YOTO_CLIENT_SECRET is missing', () => {
    expect(() => loadConfig({ YOTO_CLIENT_ID: 'test-id' })).toThrow('YOTO_CLIENT_SECRET');
  });

  it('returns config with defaults when required env vars are set', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
      YOTO_CLIENT_SECRET: 'test-secret',
    });

    expect(config).toEqual({
      port: 3100,
      yotoClientId: 'test-id',
      yotoClientSecret: 'test-secret',
      configDir: '~/.config/yoto-mcp',
    });
  });

  it('respects custom port and config dir', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
      YOTO_CLIENT_SECRET: 'test-secret',
      YOTO_MCP_PORT: '4200',
      YOTO_CONFIG_DIR: '/custom/config',
    });

    expect(config.port).toBe(4200);
    expect(config.configDir).toBe('/custom/config');
  });
});
