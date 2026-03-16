import type { AuthConfig } from './auth/types.js';
import { AUTH_DEFAULTS } from './auth/types.js';

export interface ServerConfig {
  port: number;
  yotoClientId: string;
  configDir: string;
  auth: AuthConfig;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const yotoClientId = env.YOTO_CLIENT_ID;
  if (!yotoClientId) {
    throw new Error('YOTO_CLIENT_ID environment variable is required');
  }

  return {
    port: Number.parseInt(env.YOTO_MCP_PORT ?? '3100', 10),
    yotoClientId,
    configDir: env.YOTO_CONFIG_DIR ?? '~/.config/yoto-mcp',
    auth: {
      clientId: yotoClientId,
      clientSecret: env.YOTO_CLIENT_SECRET,
      authDomain: env.YOTO_AUTH_DOMAIN ?? AUTH_DEFAULTS.authDomain,
      audience: env.YOTO_AUDIENCE ?? AUTH_DEFAULTS.audience,
    },
  };
}
