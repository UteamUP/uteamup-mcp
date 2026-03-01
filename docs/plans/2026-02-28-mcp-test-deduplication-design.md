# MCP Test Deduplication Design

**Date**: 2026-02-28
**Status**: Approved

## Problem

12 MCP tool test files share ~40-line `callMcpTool` helper, ~30-line raw HTTP request blocks, and identical error-handling `describe` sections (JSON-RPC 2.0 compliance, 401 Unauthorized, 503 Service Unavailable). Total duplication: ~1,940 lines. Additionally, not all files have all 3 error-handling sections — coverage is inconsistent.

## Solution

### 1. `test/helpers/mcp-test-helpers.js`

Shared module exporting:
- `callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply)` — JSON-RPC 2.0 tool call via nock-mocked HTTPS
- `sendRawRequest(baseUrl, toolName, toolArgs, opts)` — raw HTTP request for status-code-only tests (401/503)
- `successReply(data, id)` / `errorReply(code, message, id)` — reply factory functions
- `TEST_BASE_URL` constant (`https://api.test.com`)

### 2. `test/helpers/mcp-error-tests.js`

Three factory functions generating `describe` blocks from a tool list:
- `describeJsonRpcCompliance(callFn, tools)` — tests JSON-RPC 2.0 success shape (id, result, no error)
- `describe401Unauthorized(baseUrl, tools)` — tests 401 surfacing for each tool
- `describe503ServiceUnavailable(baseUrl, accessToken, tools)` — tests 503 surfacing for each tool

### 3. Test file changes

Each of the 12 files:
- Removes inline `callMcpTool` function (~40 lines)
- Removes inline 401/503/JSON-RPC describe blocks (~30-50 lines each)
- Imports from helpers
- Adds `toolList` array (already exists in most files as `authTools`/`complianceTools`/`serviceTools`)
- Calls the 3 factory functions at the bottom
- Files missing any of the 3 sections get them added via factory calls

### Files affected

| File | Action |
|------|--------|
| `test/helpers/mcp-test-helpers.js` | **NEW** — shared callMcpTool, sendRawRequest, reply factories |
| `test/helpers/mcp-error-tests.js` | **NEW** — error-handling test factories |
| `schedule.test.js` | Extract helpers, use factories |
| `schedule-ai-tools.test.js` | Extract helpers, use factories |
| `schedule-assignment.test.js` | Extract helpers, add missing error tests via factories |
| `shift-instances.test.js` | Extract helpers, use factories |
| `shift-requests.test.js` | Extract helpers, use factories |
| `shift-handover-acceptance.test.js` | Extract helpers, use factories |
| `shift-user-assignments.test.js` | Extract helpers, use factories |
| `tenant-holidays.test.js` | Extract helpers, use factories |
| `workforce-ai.test.js` | Extract helpers, use factories |
| `workforce-categories.test.js` | Extract helpers, use factories |
| `workforce-planning.test.js` | Extract helpers, use factories |
| `labour-rate.test.js` | Extract helpers, add missing error tests via factories |

### Not touched

`config.test.js`, `logger.test.js`, `metrics.test.js`, `retry.test.js`, `sse-parser.test.js`, `integration.test.js` — these are unit tests for specific lib modules, not MCP tool tests.

### Estimated impact

- **Net line reduction**: ~1,940 lines (16,788 → ~14,850)
- **New shared code**: ~200 lines across 2 helper files
- **Test coverage added**: 401/503/JSON-RPC compliance tests normalized across all 12 files
