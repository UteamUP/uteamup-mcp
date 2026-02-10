# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2026-02-10

### Added
- Initial beta release
- OAuth 2.0 Authorization Code + PKCE authentication flow
- Automatic token caching with 7-day expiration
- Stdio transport for Claude Desktop/Code compatibility
- Support for self-signed certificates (development mode)
- Debug logging via `UTEAMUP_DEBUG` environment variable
- Graceful shutdown handling (SIGINT/SIGTERM)
- Comprehensive error messages for common authentication issues
- Configuration validation with helpful error messages
- JSDoc documentation for all public functions

### Fixed
- Token response parsing to use OAuth 2.0 standard `access_token` field (was incorrectly expecting `accessToken`)
- JSON-RPC 2.0 response format to always include request IDs
- Error handling for 401/403 HTTP status codes with user-friendly messages

### Security
- Single-use authorization codes enforced
- PKCE S256 challenge method (SHA-256)
- Token-only authentication (credentials never logged)
- Memory-only token storage (not persisted to disk)

## [Unreleased]

### Planned
- Automatic token refresh on expiration
- Configurable token cache location
- Additional error recovery strategies
- Rate limiting support
