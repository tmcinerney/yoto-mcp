export interface ServerConfig {
  port: number;
  yotoClientId: string;
  yotoClientSecret: string;
  configDir: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const yotoClientId = env.YOTO_CLIENT_ID;
  if (!yotoClientId) {
    throw new Error('YOTO_CLIENT_ID environment variable is required');
  }

  const yotoClientSecret = env.YOTO_CLIENT_SECRET;
  if (!yotoClientSecret) {
    throw new Error('YOTO_CLIENT_SECRET environment variable is required');
  }

  return {
    port: Number.parseInt(env.YOTO_MCP_PORT ?? '3100', 10),
    yotoClientId,
    yotoClientSecret,
    configDir: env.YOTO_CONFIG_DIR ?? '~/.config/yoto-mcp',
  };
}
