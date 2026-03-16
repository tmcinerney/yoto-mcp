# Deployment

Two transports are available:
- **stdio** — via `npx`, ideal for local MCP clients (Claude Code, OpenClaw, Cursor)
- **HTTP** — via Docker, ideal for remote/shared deployments

## npm (stdio transport)

Published to npm on every `v*` tag push. Run directly with `npx`:

```bash
YOTO_CLIENT_ID="your-client-id" npx -y yoto-mcp --stdio
```

Credentials are stored in `~/.config/yoto-mcp/accounts.json` by default.

## Docker (HTTP transport)

The image is published to `ghcr.io/tmcinerney/yoto-mcp` on every `v*` tag push. Multi-arch: `linux/amd64` and `linux/arm64`.

### Image details

- Base: `node:22-alpine`
- Runs as non-root user (`yoto`)
- Config volume at `/config` (persists `accounts.json` across restarts)
- Health check: `GET /health` every 30s
- ~60MB image size

### Run with Docker

```bash
docker run -d \
  -e YOTO_CLIENT_ID="your-client-id" \
  -v yoto-config:/config \
  -p 3100:3100 \
  ghcr.io/tmcinerney/yoto-mcp:latest
```

### Run with Docker Compose

```bash
# Set YOTO_CLIENT_ID in .env or export it
docker compose up -d
```

### Verify

```bash
curl http://localhost:3100/health
docker logs <container-name>
```

## MCP client configuration

### Claude Code — stdio (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "yoto-mcp": {
      "command": "npx",
      "args": ["-y", "yoto-mcp", "--stdio"],
      "env": {
        "YOTO_CLIENT_ID": "your-client-id"
      }
    }
  }
}
```

### Claude Code — HTTP (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "yoto-mcp": {
      "type": "streamable-http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

Replace `localhost` with the hostname or IP where the server is running.

### OpenClaw (`openclaw.json` — ACPX plugin config)

```json
{
  "plugins": {
    "entries": {
      "acpx": {
        "mcpServers": {
          "yoto-mcp": {
            "command": "npx",
            "args": ["-y", "yoto-mcp", "--stdio"],
            "env": {
              "YOTO_CLIENT_ID": "your-client-id"
            }
          }
        }
      }
    }
  }
}
```

## Authentication

After the server is running, authenticate via MCP tools:

1. Call `yoto_auth` — returns a verification URL and user code
2. Open the URL in a browser, enter the code, authorize
3. Call `yoto_auth_complete` with the `userCode` — polls Auth0 and saves tokens

Tokens are persisted in `/config/accounts.json` (or `~/.config/yoto-mcp/accounts.json` locally) and auto-refreshed every 15 minutes.

### Multi-account

Multiple Yoto accounts can be authenticated. Use `yoto_accounts` to list, switch default, or remove accounts. All tool calls accept an optional `account` parameter to target a specific account.
