# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-03-15

### Added
- CLAUDE.md, CONTRIBUTING.md, DEPLOY.md — project documentation
- `yoto_auth_complete` tool — two-phase auth (initiate + complete) replaces blocking single-tool flow
- NixOS container config for apollo deployment

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
