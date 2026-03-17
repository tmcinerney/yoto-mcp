# yoto-mcp

MCP server for the [Yoto](https://yotoplay.com) API — manage MYO cards, upload audio, control devices. Multi-account support.

Uses the official [@yotoplay/yoto-sdk](https://github.com/yotoplay/yoto-sdk) and the [Model Context Protocol](https://modelcontextprotocol.io) to expose Yoto operations as tools for AI assistants.

## Features

- OAuth device code flow — authenticate with your regular Yoto account (no developer account needed)
- Multi-account — store credentials for multiple Yoto accounts, switch between them
- MYO card management — create, update, delete cards and playlists
- Audio upload — upload MP3/M4A files with automatic transcoding
- Device listing — see your Yoto players and their status
- Dual transport — stdio (for `npx` / MCP clients) or streamable HTTP (for Docker / remote)

## Quick start

### Via npx (stdio)

```bash
YOTO_CLIENT_ID="your-client-id" npx -y yoto-mcp --stdio
```

### Via Docker (HTTP)

```bash
docker run -d \
  -e YOTO_CLIENT_ID="your-client-id" \
  -v yoto-config:/config \
  -p 3100:3100 \
  ghcr.io/tmcinerney/yoto-mcp:latest
```

See [DEPLOY.md](DEPLOY.md) for full deployment and MCP client configuration.
See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, tooling, and release process.

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
| `yoto_search_icons` | Search icons by keyword (title and tags) |

## License

MIT
