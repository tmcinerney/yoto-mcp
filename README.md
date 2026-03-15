# yoto-mcp

MCP server for the [Yoto](https://yotoplay.com) API — manage MYO cards, upload audio, control devices. Multi-account support.

Uses the official [@yotoplay/yoto-sdk](https://github.com/yotoplay/yoto-sdk) and the [Model Context Protocol](https://modelcontextprotocol.io) to expose Yoto operations as tools for AI assistants.

## Features

- OAuth device code flow — authenticate with your regular Yoto account (no developer account needed)
- Multi-account — store credentials for multiple Yoto accounts, switch between them
- MYO card management — create, update, delete cards and playlists
- Audio upload — upload MP3/M4A files with automatic transcoding
- Device listing — see your Yoto players and their status
- Streamable HTTP transport — connect from any MCP-compatible client over HTTP

## Prerequisites

- Node.js >= 22
- Yoto developer credentials from [dashboard.yoto.dev](https://dashboard.yoto.dev)

## Quick start

```bash
# Clone and install
git clone https://github.com/tmcinerney/yoto-mcp.git
cd yoto-mcp
npm install

# Set environment variables
export YOTO_CLIENT_ID="your-client-id"
export YOTO_CLIENT_SECRET="your-client-secret"

# Run in development
npm run dev
```

## Docker

```bash
# Build and run
docker compose up -d

# Or pull from GHCR
docker pull ghcr.io/tmcinerney/yoto-mcp:latest
docker run -d \
  -e YOTO_CLIENT_ID="your-client-id" \
  -e YOTO_CLIENT_SECRET="your-client-secret" \
  -v yoto-config:/config \
  -p 3100:3100 \
  ghcr.io/tmcinerney/yoto-mcp:latest
```

## MCP client configuration

### Claude Code (`~/.claude/mcp.json`)

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

### OpenClaw (`openclaw.json`)

```json
{
  "mcpServers": {
    "yoto-mcp": {
      "type": "streamable-http",
      "url": "http://<your-host>:3100/mcp"
    }
  }
}
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YOTO_CLIENT_ID` | Yes | — | Developer client ID from dashboard.yoto.dev |
| `YOTO_CLIENT_SECRET` | Yes | — | Developer client secret |
| `YOTO_MCP_PORT` | No | `3100` | Port for the HTTP server |
| `YOTO_CONFIG_DIR` | No | `~/.config/yoto-mcp` | Directory for account credentials |

## Available tools

| Tool | Description |
|------|-------------|
| `yoto_auth` | Authenticate a Yoto account via device code flow |
| `yoto_accounts` | List, switch, or remove authenticated accounts |
| `yoto_list_cards` | List MYO cards |
| `yoto_get_card` | Get card details with chapters and tracks |
| `yoto_create_card` | Create a new MYO card |
| `yoto_update_card` | Update card content |
| `yoto_delete_card` | Delete a MYO card |
| `yoto_upload_audio` | Upload audio file and wait for transcoding |
| `yoto_list_devices` | List Yoto player devices |
| `yoto_list_icons` | List available display icons |

## Development

```bash
npm run dev          # Start with hot reload
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint with Biome
npm run typecheck    # Type check
npm run check        # All checks (lint + typecheck + test)
```

## License

MIT
