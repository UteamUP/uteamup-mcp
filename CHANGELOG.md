# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.6] - 2026-02-10

### Fixed
- **Notification Handling:** Properly handle JSON-RPC notifications with empty responses
  - Backend returns HTTP 202 (Accepted) with empty body for notifications
  - Proxy now skips sending response for notifications (id: undefined)
  - Fixes "Received a response for an unknown message ID" error
  - Notifications are now properly acknowledged without generating errors

## [1.0.0-beta.5] - 2026-02-10

### Fixed
- **CRITICAL:** Added Server-Sent Events (SSE) response parsing
  - Backend returns responses in `text/event-stream` format (SSE)
  - Proxy now correctly parses SSE format: extracts JSON from `data:` field
  - Fixes "Unexpected token 'e'" parse error in Cursor/Claude Code
  - Falls back to plain JSON parsing if response is not SSE format

## [1.0.0-beta.4] - 2026-02-10

### Fixed
- **NPM Package:** Fixed bin field path from `index.js` to `./index.js` for proper npm installation
- **Debug Logging:** Added comprehensive MCP response logging to help diagnose JSON-RPC format issues
  - Now logs raw response body
  - Now logs parsed JSON response
  - Now logs parse errors if they occur

## [1.0.0-beta.3] - 2026-02-10

### Fixed
- **CRITICAL:** Added `Accept: application/json, text/event-stream` header to MCP requests
  - Backend requires both content types for HTTP transport compatibility
  - Fixes HTTP 406 "Not Acceptable" error
  - Enables proper MCP endpoint communication

## [1.0.0-beta.2] - 2026-02-10

### Fixed
- **CRITICAL:** Token response parsing now accepts both `accessToken` (camelCase) and `access_token` (snake_case) formats
  - Backend returns `accessToken` but code only checked for `access_token`
  - This caused authentication to fail despite successful OAuth flow
  - Discovered via MCP Inspector testing

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
