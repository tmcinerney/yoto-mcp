# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.5.3] - 2026-03-16

### Changed
- CLAUDE.md: added references table, removed stale version locations (server.ts now reads from package.json)
- CONTRIBUTING.md: updated version locations to reflect single source of truth in package.json

## [0.5.2] - 2026-03-16

### Fixed
- NFD normalize file paths before filesystem operations — fixes ENOENT on macOS for filenames with emoji, accented characters, or special dashes (HFS+/APFS stores NFD, JSON/MCP transport delivers NFC)

## [0.5.1] - 2026-03-16

### Changed
- Introduced `YotoCard` interface — proper typing for Yoto API cards with top-level fields
- Removed all `as any` casts in favor of `YotoCard` typing
- Removed AIDEV-prefixed comments (not appropriate for public repo)
- Added husky pre-push hook running full lint + typecheck + test suite
- CI workflow simplified to use `npm run check` (same as release)

## [0.5.0] - 2026-03-16

### Fixed
- **Critical:** Card title placed at top level instead of `metadata.title` (titles were invisible)
- **Critical:** `cardId` injected into update payload — prevents accidental card creation (duplicates)
- **Critical:** Update now fetches existing card and merges — partial updates no longer wipe omitted fields
- Preserve `refresh_token` when Auth0 omits it on refresh grant (prevents permanent auth failure)
- Guard initial auth against missing refresh token
- HTTP handler catches transport errors (prevents server crash on malformed requests)
- Network errors in device code polling retry instead of killing auth flow
- `JSON.parse` catch scoped to parsing only, not downstream errors
- Validate `filePath` is absolute before reading (path traversal guard)
- Reject conflicting `cardId` in update payload vs parameter

### Added
- MIME type detection from file extension (mp3, m4a, wav, ogg, flac, aac, wma)
- Upload timeout via AbortController (5 minutes)
- File size guard rejects files over 500MB before loading into memory
- Port validation (NaN/out-of-range falls back to 3100)
- `touchAccount` wired in `getSdk` — `lastUsed` timestamps now updated
- Expired pending device codes pruned on each auth call
- Graceful shutdown cleans up periodic refresh timer on SIGTERM/SIGINT
- SDK cache checks token freshness before returning cached instance

### Changed
- Server version read from `package.json` instead of hardcoded
- `update_card` tool description updated to reflect merge semantics
- `TokenResponse.refresh_token` made optional to match Auth0 behavior

## [0.4.1] - 2026-03-15

### Changed
- Clean API response types — explicit interfaces for actual Yoto API responses instead of casting through `Record<string, unknown>`
- Removed dead SDK type fallbacks (`transcode.url`, `upload.fields`)
- Version assertion in stdio test reads from `package.json` instead of hard-coding

### Added
- Test for missing `transcodedSha256` error case

## [0.4.0] - 2026-03-15

### Fixed
- Construct `yoto:#hash` media URLs from `transcodedSha256` — the SDK types declare `{url, status}` but the real API returns `{progress, transcodedSha256, transcodedInfo}`

## [0.3.3] - 2026-03-15

### Changed
- Increased transcode poll timeout from 5 to 15 minutes for large audio files
- Increased poll interval from 5s to 10s to reduce API load

## [0.3.2] - 2026-03-15

### Fixed
- Poll `getTranscodedUpload` until `progress.phase === 'complete'` instead of checking once
- Skip S3 upload when presigned URL is null (file already uploaded, same SHA-256)

## [0.3.1] - 2026-03-15

### Fixed
- Bypass SDK's `uploadFile` which leaks the Authorization header to presigned S3 URLs, causing 400 InvalidArgument
- Use `uploadUrl` and `uploadId` fields from actual API response (SDK types incorrectly declare `url` and `fields`)
- Better error reporting with stack traces on upload failure

## [0.3.0] - 2026-03-15

### Added
- Stdio transport (`--stdio` flag) — use with `npx -y yoto-mcp --stdio`
- Published to npm as `yoto-mcp`
- `bin` field in package.json for npx support
- Release workflow publishes to both GHCR (Docker) and npm in parallel
- Integration tests for stdio and HTTP transport modes

### Changed
- Release workflow split into check → docker + npm parallel jobs

## [0.2.0] - 2026-03-15

### Added
- CLAUDE.md, CONTRIBUTING.md, DEPLOY.md — project documentation
- `yoto_auth_complete` tool — two-phase auth (initiate + complete) replaces blocking single-tool flow

### Changed
- Switched to Public Client auth (no `client_secret` needed)
- Removed dead `clientSecret` code from AuthConfig, config loading, and all test fixtures
- README slimmed down — links to CONTRIBUTING.md and DEPLOY.md instead of duplicating
- Docker Compose no longer references `YOTO_CLIENT_SECRET`

### Fixed
- CHANGELOG: SSE transport reference corrected to streamable HTTP
- README: added missing `yoto_auth_complete` to tools table
- README: prerequisites updated for Public Client registration

## [0.1.0] - 2026-03-15

### Added
- MCP server with streamable HTTP transport on configurable port
- OAuth device code flow with Auth0 (login.yotoplay.com)
- Multi-account token persistence with atomic JSON file writes
- Proactive token refresh (15min scan) + on-demand fallback
- 11 MCP tools: auth, accounts, cards CRUD, audio upload, devices, icons
- ToolContext with SDK caching and account resolution
- Docker multi-stage build (~60MB image, non-root user, health check)
- CI/CD: lint + typecheck + test on PR, multi-arch Docker push on tag
- Dependabot for npm and GitHub Actions
