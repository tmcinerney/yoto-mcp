# Contributing

## Prerequisites

- Node.js >= 22
- A Yoto developer app client ID from [dashboard.yoto.dev](https://dashboard.yoto.dev) (register as a **Public Client** — confidential clients don't support device code grant)

## Setup

```bash
git clone https://github.com/tmcinerney/yoto-mcp.git
cd yoto-mcp
npm install
cp .env.example .env
# Edit .env with your YOTO_CLIENT_ID
```

## Development

```bash
npm run dev          # Start with hot reload (tsx watch)
npm run test         # Run tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run lint         # Lint with Biome
npm run lint:fix     # Lint and auto-fix
npm run typecheck    # Type check (tsc --noEmit)
npm run check        # All checks (lint + typecheck + test)
```

## Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| TypeScript 5.9 | Language, strict mode, ESM | `tsconfig.json` |
| Biome 2.x | Linting + formatting (replaces ESLint + Prettier) | `biome.json` |
| Vitest 4.x | Test runner | `vitest.config.ts` |
| tsx | Dev server with watch mode | — |

### Biome conventions

- Single quotes, semicolons, trailing commas
- 2-space indent, 100 char line width
- Import organization is automatic (`organizeImports: "on"`)
- `noUnusedImports` and `noUnusedVariables` are errors

## Testing

TDD red/green throughout. Tests mirror the `src/` directory structure under `tests/`.

- **Unit tests**: Mock SDK and HTTP calls. Each tool handler is a pure function that takes an SDK instance and args, returns `CallToolResult`
- **HTTP handler tests**: Test the Express-like request handler in isolation
- **Auth tests**: Mock `fetch` globally, use temp directories for token store persistence

Run `npm run check` before committing — CI runs the same checks.

## Code architecture

```
src/
├── index.ts              # Entry point — wires config, auth, transport, server
├── config.ts             # Environment → ServerConfig (dependency injection)
├── server.ts             # MCP server — tool registration with Zod schemas
├── http-handler.ts       # Streamable HTTP handler (testable, decoupled from MCP)
├── auth/
│   ├── types.ts          # Interfaces: AccountRecord, AuthConfig, DeviceCodeResponse, etc.
│   ├── device-code-flow.ts  # Auth0 device code initiation + polling
│   ├── token-store.ts    # JSON file persistence with atomic writes
│   └── token-refresh.ts  # Proactive refresh (15min scan) + on-demand fallback
└── tools/
    ├── shared.ts         # ToolContext (SDK caching, account resolution), helpers
    ├── auth.ts           # yoto_auth, yoto_auth_complete, yoto_accounts
    ├── library.ts        # yoto_list_cards, yoto_get_card
    ├── content.ts        # yoto_create_card, yoto_update_card, yoto_delete_card
    ├── media.ts          # yoto_upload_audio (hash → presign → upload → transcode)
    ├── devices.ts        # yoto_list_devices
    └── icons.ts          # yoto_list_icons
```

### Key patterns

- **Tool handlers are pure functions**: `(sdk, args) → CallToolResult`. No MCP wiring in handlers
- **ToolContext**: Encapsulates account lookup → token refresh → SDK creation. Returns discriminated union `{ sdk, account } | { error }`. Caches SDK instances per account
- **Config via dependency injection**: `loadConfig(env)` takes an env record, not `process.env` directly — makes testing trivial
- **Atomic file writes**: Token store uses write-to-temp + rename for crash safety

## Versioning and releases

### Version locations

Version must be consistent across all three:

| Location | File |
|----------|------|
| npm | `package.json` → `version` |
| MCP server | `src/server.ts` → `McpServer({ version })` |
| lockfile | `package-lock.json` (updated by `npm version`) |

### Release process

1. Bump version in `package.json` and `src/server.ts`
2. Update `CHANGELOG.md` — move `[Unreleased]` entries to a versioned section
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push && git push origin vX.Y.Z`

The `v*` tag triggers `.github/workflows/release.yml` which:
- Runs `npm run check` (lint + typecheck + test)
- Builds multi-arch Docker image (linux/amd64 + linux/arm64 via QEMU + Buildx)
- Pushes to `ghcr.io/tmcinerney/yoto-mcp` with tags: `X.Y.Z`, `X.Y`, `X`, `latest`

### CI

Every push to `main` and every PR runs `.github/workflows/ci.yml`:
- Lint (Biome)
- Type check (tsc)
- Test (Vitest)
- Docker build (build only, no push)

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new tool, new capability
- `fix:` — bug fix
- `refactor:` — code change that doesn't add features or fix bugs
- `chore:` — versioning, CI, dependencies
- `docs:` — documentation only
- `test:` — test additions or corrections

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YOTO_CLIENT_ID` | Yes | — | Public Client ID from dashboard.yoto.dev |
| `YOTO_MCP_PORT` | No | `3100` | Port for the HTTP server |
| `YOTO_CONFIG_DIR` | No | `~/.config/yoto-mcp` | Directory for account credentials |
| `YOTO_AUTH_DOMAIN` | No | `login.yotoplay.com` | Auth0 domain |
| `YOTO_AUDIENCE` | No | `https://api.yotoplay.com` | Auth0 audience |
