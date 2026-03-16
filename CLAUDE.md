# yoto-mcp — Claude Context

MCP server exposing Yoto API operations as tools. TypeScript, Node 22, ESM.

## Quick reference

- **Dev**: `npm run dev` (tsx watch on :3100)
- **Check**: `npm run check` (lint + typecheck + test — run before committing)
- **Architecture, testing, versioning**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Docker, deploy, MCP client config**: See [DEPLOY.md](DEPLOY.md)

## Code conventions

- **Biome** for lint + format (not ESLint/Prettier). Run `npm run lint:fix` to auto-fix
- **Single quotes**, semicolons, trailing commas, 2-space indent, 100 char lines
- **Tool handlers are pure functions**: `(sdk, args) → CallToolResult` — no MCP wiring in handlers
- **Config via DI**: `loadConfig(env)` takes an env record for testability
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`

## Auth model

- **Public Client** — device code flow, no client secret
- Auth0 domain: `login.yotoplay.com`, audience: `https://api.yotoplay.com`
- Token store: atomic JSON file writes (write-temp + rename)
- Auto-refresh: 15min periodic scan + on-demand before API calls

## Version locations

Keep these in sync (see [CONTRIBUTING.md § Versioning](CONTRIBUTING.md#versioning-and-releases)):

| Location | File |
|----------|------|
| npm | `package.json` → `version` |
| MCP server | `src/server.ts` → `McpServer({ version })` |
| lockfile | `package-lock.json` |

Tag `vX.Y.Z` triggers multi-arch Docker build + push to GHCR, and `npm publish`.

## Transport modes

- `--stdio` flag: stdio transport for `npx` / local MCP clients
- Default (no flag): streamable HTTP on configurable port for Docker / remote

## Deployment

Published to npm (`npx -y yoto-mcp --stdio`) and GHCR (Docker). See [DEPLOY.md](DEPLOY.md) for all options and MCP client configs.
