# Deployment

## Docker image

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

## NixOS deployment (apollo)

The container is defined in `homelab-nixos/containers/yoto-mcp.nix` and imported by `hosts/apollo/configuration.nix`.

### Container config

- Image: `ghcr.io/tmcinerney/yoto-mcp:latest` with `--pull=always`
- Port: `3100` (opened in firewall)
- Volume: `yoto-mcp-config:/config`
- Client ID is set directly in the nix config (public client, not a secret)

### Deploy to apollo

```bash
cd ~/Code/Private/homelab-nixos

# Check the config builds
nfc   # nix flake check

# Build without switching (verify)
nrb   # sudo nixos-rebuild build --no-link --flake .

# Apply
nrs   # sudo nixos-rebuild switch --flake .
```

### Verify

```bash
# Check container is running
docker ps | grep yoto-mcp

# Check health
curl http://apollo:3100/health

# Check logs
docker logs homelab-yoto-mcp
```

### Update the image

The container uses `--pull=always`, so restarting pulls the latest tag:

```bash
systemctl restart docker-homelab-yoto-mcp.service
```

To deploy a specific version, update the image tag in `containers/yoto-mcp.nix` and `nrs`.

## MCP client configuration

### Claude Code (`~/.claude/mcp.json`)

```json
{
  "mcpServers": {
    "yoto-mcp": {
      "type": "streamable-http",
      "url": "http://apollo:3100/mcp"
    }
  }
}
```

For local development, use `http://localhost:3100/mcp` instead.

### OpenClaw (`openclaw.json`)

```json
{
  "mcpServers": {
    "yoto-mcp": {
      "type": "streamable-http",
      "url": "http://apollo:3100/mcp"
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
