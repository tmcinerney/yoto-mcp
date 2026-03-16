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

## Quick start

```bash
git clone https://github.com/tmcinerney/yoto-mcp.git
cd yoto-mcp
npm install
cp .env.example .env
# Edit .env with your YOTO_CLIENT_ID (Public Client from dashboard.yoto.dev)
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup, tooling, and release process.

## Deployment

Docker image on GHCR, runs on NixOS homelab. See [DEPLOY.md](DEPLOY.md) for Docker, NixOS, and MCP client configuration.

## Available tools

| Tool | Description |
|------|-------------|
| `yoto_auth` | Start device code auth — returns verification URL and user code |
| `yoto_auth_complete` | Complete auth after user authorizes in browser |
| `yoto_accounts` | List, switch, or remove authenticated accounts |
| `yoto_list_cards` | List MYO cards |
| `yoto_get_card` | Get card details with chapters and tracks |
| `yoto_create_card` | Create a new MYO card |
| `yoto_update_card` | Update card content |
| `yoto_delete_card` | Delete a MYO card |
| `yoto_upload_audio` | Upload audio file and wait for transcoding |
| `yoto_list_devices` | List Yoto player devices |
| `yoto_list_icons` | List available display icons |

## License

MIT
