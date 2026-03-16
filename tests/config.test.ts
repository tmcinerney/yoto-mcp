import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when YOTO_CLIENT_ID is missing', () => {
    expect(() => loadConfig({})).toThrow('YOTO_CLIENT_ID');
  });

  it('returns config with defaults when required env vars are set', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
    });

    expect(config).toEqual({
      port: 3100,
      yotoClientId: 'test-id',
      configDir: '~/.config/yoto-mcp',
      auth: {
        clientId: 'test-id',
        clientSecret: undefined,
        authDomain: 'login.yotoplay.com',
        audience: 'https://api.yotoplay.com',
      },
    });
  });

  it('passes through client secret when provided', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
      YOTO_CLIENT_SECRET: 'test-secret',
    });

    expect(config.auth.clientSecret).toBe('test-secret');
  });

  it('respects custom port and config dir', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
      YOTO_MCP_PORT: '4200',
      YOTO_CONFIG_DIR: '/custom/config',
    });

    expect(config.port).toBe(4200);
    expect(config.configDir).toBe('/custom/config');
  });

  it('respects custom auth domain and audience', () => {
    const config = loadConfig({
      YOTO_CLIENT_ID: 'test-id',
      YOTO_AUTH_DOMAIN: 'custom-auth.example.com',
      YOTO_AUDIENCE: 'https://custom-api.example.com',
    });

    expect(config.auth.authDomain).toBe('custom-auth.example.com');
    expect(config.auth.audience).toBe('https://custom-api.example.com');
  });
});
