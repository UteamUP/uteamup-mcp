# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Tests for the 5 new image/document import MCP tools.** New file `test/document-import-tools.test.js` exercises `UteamupDocumentImportGetBatch`, `UteamupLogbookImportGet`, `UteamupDocumentReviewQueue`, `UteamupDocumentReviewAcknowledge`, and `UteamupAIUsageSummary` over the JSON-RPC tools/call transport (nock-mocked HTTPS, mirrors the labour-rate / project-my-projects pattern). Eleven passing tests cover the happy path for each tool, the `aiQuotaExhausted=true` flag in batch payloads, the SkippedQuotaExhausted enum value (5) on items, optional `batchId` filter on the review queue, optional `comment` on acknowledge, default-window AI usage summary, and the JSON-RPC error shape for backend 503 / cross-tenant 404 surfaces.
- `test/project-my-projects.test.js` — Jest coverage for the new `UteamupProjectMyProjects` MCP tool (proxies backend `GET /api/project/my-projects`). Covers happy path, empty list, `myWorkorderCount` shape, JSON-RPC error pass-through, and a regression guard asserting the tool accepts NO arguments (user identity must come from the Bearer token). Wires in the shared `describeJsonRpcCompliance`, `describe401Unauthorized`, and `describe503ServiceUnavailable` suites. 8 tests, all passing.
- `MCPGuidelines.md` — New top-level guide documenting the generic-proxy architecture, configuration, tool-addition workflow (backend-first — NEVER edit `index.js` for a specific tool), test structure and required coverage per new tool, Release Please versioning, critical regression zones, and security rules.
- `test/helpers/mcp-test-helpers.js` — Shared `callMcpTool`, `sendRawRequest`, `successReply`, `errorReply` utilities for all MCP tool tests
- `test/helpers/mcp-error-tests.js` — Reusable test factories: `describeJsonRpcCompliance`, `describe401Unauthorized`, `describe503ServiceUnavailable`
- 58 new error-handling tests from normalization (503 tests added to 4 files that lacked them; all 3 sections added to `labour-rate.test.js`)
- 8 MCP proxy tests for `UteamupWorkforceGetGroupMembers` and `UteamupWorkforceAssignWorkOrder` tools in `workforce-planning.test.js`
- 7 IconName field tests in `workforce-categories.test.js`: create with icon, create without (backwards-compat), update, clear, list returns, get by id returns, create request params

### Changed
- Extracted duplicated `callMcpTool` helper (~40 lines each) and error-handling describe blocks from 12 MCP tool test files into shared modules, reducing ~1,800 lines of duplication
- All 12 MCP tool test files now use shared helpers and standardized error test factories
- Test count: 714 → 772 tests (18 suites, all passing)
- **test/labour-rate.test.js** — 20 tests covering all 6 `LabourRateTools`: `UteamupLabourRateGetMyEffectiveRate` (including at= param), `UteamupLabourRateGetRules`, `UteamupLabourRateGetModifiers`, `UteamupLabourRateCreateModifier`, `UteamupLabourRateUpdateModifier`, `UteamupLabourRateDeleteModifier`. Tests cover success paths, validation errors (missing name, zero rateValue, invalid id), permission denial (LaborCost.All), and 401 unauthorized.
- **test/schedule.test.js** — 33 new tests covering all 3 `ScheduleTools`: `UteamupScheduleGetMySchedule`, `UteamupScheduleGetTeamSchedule`, `UteamupScheduleGetAvailableTechnicians`. Tests include success responses, empty results, invalid input errors, parameter capture, JSON-RPC 2.0 compliance, 401/503 handling, and permission denial.
- **test/schedule-ai-tools.test.js** — Added tests for 3 previously uncovered `WorkforcePlanningTools`: `UteamupWorkforceSuggestAssignment`, `UteamupWorkforceGetCapacity`, `UteamupWorkforceGetAvailableTechnicians`. Updated JSON-RPC compliance and 401 unauthorized suites to cover all 7 workforce tools.

### Changed
- Total test count increased from 70+ to 161 across 9 test suites (100% tool coverage for Schedule and WorkforcePlanning domains).

## [1.0.0-beta.7] - 2026-02-11

### Added
- **Structured Logging:** Production-ready logging with Pino
  - Log levels: TRACE, DEBUG, INFO, WARN, ERROR (configurable via `UTEAMUP_LOG_LEVEL`)
  - JSON and text output formats (configurable via `UTEAMUP_LOG_FORMAT`)
  - Automatic sensitive data redaction (credentials, tokens, secrets)
  - Pretty-printed logs in development, JSON logs in production
- **Configuration Validation:** Runtime validation with Zod
  - Strict validation of all environment variables
  - Clear error messages with actionable guidance
  - Type-safe configuration with schema enforcement
- **Performance Monitoring:** Built-in metrics tracking
  - OAuth flow duration and success rate
  - Request latency and success rate
  - Token cache hit/miss ratio
  - Automatic metrics summary on shutdown
- **Retry Logic:** Exponential backoff with jitter
  - Configurable max retries (`UTEAMUP_MAX_RETRIES`, default: 3)
  - Smart retry detection (network errors, timeouts, 5xx, 429)
  - Exponential backoff with jitter to prevent thundering herd
  - Request timeout support (`UTEAMUP_REQUEST_TIMEOUT`)
- **Request Tracing:** Unique request IDs for correlation
  - X-Request-ID header in all MCP requests
  - Full request/response logging at TRACE level
  - Request timing information
- **CLI Utilities:** Developer-friendly command-line tools
  - `--help` / `-h`: Show usage information
  - `--version` / `-v`: Print version
  - `--validate-config`: Validate environment variables
  - `--test-auth`: Test OAuth authentication flow
- **Test Suite:** Comprehensive test coverage (70 tests)
  - Unit tests for configuration, logging, metrics, retry logic
  - Integration tests with mock HTTP server
  - SSE parser tests
  - Error handling tests

### Changed
- Refactored codebase into modular structure (`lib/` directory)
  - `lib/logger.js`: Structured logging module
  - `lib/config.js`: Configuration validation module
  - `lib/metrics.js`: Performance monitoring module
  - `lib/retry.js`: Retry logic module
- Enhanced error messages with more context and actionable guidance
- Improved token refresh logic with configurable margin (`UTEAMUP_TOKEN_REFRESH_MARGIN`)
- Better backward compatibility with legacy `UTEAMUP_DEBUG` flag

### Dependencies
- **Added:** `pino` (^9.6.0) - Structured logging
- **Added:** `pino-pretty` (^12.0.0) - Pretty-printed logs for development
- **Added:** `zod` (^3.25.0) - Runtime type validation
- **Added (dev):** `nock` (^13.5.0) - HTTP mocking for tests
- **Added (dev):** `@types/node` (^20.11.0) - Node.js type definitions

### Improved
- Production-readiness: Meets industry standards for observability and reliability
- Developer experience: Better debugging with structured logs and CLI utilities
- Error recovery: Automatic retry on transient failures
- Security: Enhanced sensitive data redaction in logs

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
