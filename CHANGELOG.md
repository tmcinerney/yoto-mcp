# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
