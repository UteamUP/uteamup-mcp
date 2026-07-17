# UteamUP MCP Server — Development & Release Guidelines

## Overview

The UteamUP MCP server (`@uteamup/mcp-server`) is a Node.js **OAuth 2.0 + PKCE authentication proxy** that bridges Claude Desktop / Claude Code (and any MCP-compatible client) to the UteamUP backend `/mcp` endpoint via JSON-RPC 2.0 over stdio.

```
Claude Desktop/Code → stdio → UteamUP MCP Server → HTTPS → UteamUP Backend /mcp
```

This server is a **generic proxy**: it does NOT hard-code individual tool schemas. Every MCP tool visible to Claude is registered on the **backend** as an `[McpServerTool]` method on a class decorated with `[McpServerToolType]` (see `UteamUP_Backend/UteamUP_API/MCP/Tools/*.cs`). Adding a new tool to the backend is enough to make it available through this proxy — no changes to `index.js` are required.

The MCP server's job is to:

1. Authenticate the user (OAuth 2.0 + PKCE or API key + secret)
2. Refresh tokens before they expire (configurable margin)
3. Forward `tools/list` and `tools/call` JSON-RPC requests with `Authorization: Bearer …`
4. Parse both plain-JSON and `text/event-stream` (SSE) backend responses
5. Retry transient errors (network, 429, 5xx) with exponential backoff
6. Emit structured logs to stderr (text or JSON) and metrics

---

## Build & Development

### Prerequisites

- Node.js >= 18.0.0
- npm

### Common Commands

Do not run npm/Jest tests from hooks or after turns, tasks, phases, sections, todos,
commits, or subagents. Only the primary agent, after the entire user goal and all
subagents are complete, may run one affected MCP test invocation with
`UTEAMUP_FINAL_GOAL_GATE=1`. Lint and formatting remain available during implementation.

```bash
npm install              # Install dependencies
UTEAMUP_FINAL_GOAL_GATE=1 npm test                 # Final full Jest gate
UTEAMUP_FINAL_GOAL_GATE=1 npm run test:integration # Final integration gate
npm run lint             # ESLint
npm run format           # Prettier
```

CLI utilities shipped with the binary:

```bash
node index.js --help
node index.js --version
node index.js --validate-config
node index.js --test-auth
```

No build step — `index.js` is published to npm as-is.

### Pre-commit Checklist

```bash
UTEAMUP_FINAL_GOAL_GATE=1 npm test # Final whole-goal Jest gate
npm run lint      # No ESLint errors
```

---

## Configuration

Environment variables (set by the MCP client in its `mcp.json`, or exported in the shell):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `UTEAMUP_API_KEY` | ✅ | — | 32-character API key |
| `UTEAMUP_SECRET` | ✅ | — | 64+ character secret |
| `UTEAMUP_API_BASE_URL` | — | `https://api.uteamup.com` | Backend URL (`https://devback.uteamup.com` for dev, `https://localhost:5002` for local) |
| `UTEAMUP_LOG_LEVEL` | — | `INFO` | `TRACE` \| `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |
| `UTEAMUP_LOG_FORMAT` | — | `text` | `text` \| `json` |
| `UTEAMUP_MAX_RETRIES` | — | `3` | 0–10 |
| `UTEAMUP_REQUEST_TIMEOUT` | — | `30000` | Milliseconds |

Secret handling:

- API key and secret live in client-side `mcp.json`, never in the repo.
- Logs auto-redact sensitive substrings (api_key, secret, password, token) via `lib/logger.js`.
- Tokens are cached in memory with 7-day TTL and refreshed automatically.

---

## Adding a New MCP Tool

Because the MCP server is a generic proxy, **adding a new tool happens on the backend**, not here. The workflow:

1. **Backend** — create a Command + Handler + Tool:
   ```
   UteamUP_Backend/UteamUP_API/MCP/Commands/<Domain>/<Name>Command.cs
   UteamUP_Backend/UteamUP_API/MCP/Handlers/<Domain>/<Name>CommandHandler.cs
   UteamUP_Backend/UteamUP_API/MCP/Tools/<Domain>Tools.cs  ← add [McpServerTool] method
   ```
   The method name (e.g. `UteamupProjectMyProjects`) **is** the tool name exposed over MCP.

2. **MCP test** — add a Jest file under `UteamUP_MCP/test/` following the `labour-rate.test.js` / `project-my-projects.test.js` pattern:
   - `nock`-mock the backend `/mcp` POST
   - Assert success, empty, and error shapes
   - Include `describeJsonRpcCompliance`, `describe401Unauthorized`, `describe503ServiceUnavailable` from `test/helpers/mcp-error-tests.js`

3. **CLI** — update `UteamUP_CLI/internal/registry/domains_<name>.go` to expose the new tool as a subcommand (see `CLIGuidelines.md`).

4. **Wiki** — append/update a JSON article under `UteamUP_Backend/UteamUP_API/SeedData/Wiki/` per `UteamUP_Frontend/Guidelines/WikiSeedGuidelines.md`.

**Do NOT** add tool-specific code in `UteamUP_MCP/index.js`. If you find yourself editing `index.js` to handle a specific tool, step back — either the backend contract is wrong, or the change belongs in `lib/` (generic proxy behavior).

---

## Test Structure

All tests live under `UteamUP_MCP/test/` and run via Jest.

### File naming

- `<domain>.test.js` — tests for a tool or group of tools (`labour-rate.test.js`, `project-my-projects.test.js`, `workorder-watchlist.test.js`)
- `<lib>.test.js` — tests for a generic module (`config.test.js`, `logger.test.js`, `retry.test.js`)
- `helpers/` — test helpers shared across files

### Helper modules

- [`test/helpers/mcp-test-helpers.js`](test/helpers/mcp-test-helpers.js) — `callMcpTool()`, `sendRawRequest()`, `successReply()`, `errorReply()`
- [`test/helpers/mcp-error-tests.js`](test/helpers/mcp-error-tests.js) — reusable `describeJsonRpcCompliance()`, `describe401Unauthorized()`, `describe503ServiceUnavailable()` describe blocks

### Required coverage per new tool (minimum)

1. **Success** — happy path returns expected shape
2. **Empty** — zero-item response surfaces as `[]` or `null` as the backend documents
3. **Error** — JSON-RPC error shape round-trips without crashing the proxy
4. **JSON-RPC compliance** — via `describeJsonRpcCompliance(call, [{name, args}])`
5. **401** — via `describe401Unauthorized(BASE_URL, [{name, args}])`
6. **503** — via `describe503ServiceUnavailable(BASE_URL, [{name, args}])`

Tools that take arguments also need:

7. **Argument round-trip** — pass non-default args, assert the proxy forwards them verbatim
8. **Regression guards** — for user-scoped tools (like `UteamupProjectMyProjects`), explicitly assert the tool takes NO `userId` / `tenantId` arg. The user identity comes from the Bearer token — adding such args would silently invite spoofing.

---

## Release Process

Releases are published to **npm** (`@uteamup/mcp-server`) via Release Please.

### How Release Please drives releases

1. Push commits to `main` with conventional prefixes:
   | Prefix | Bump |
   |--------|------|
   | `feat:` | minor |
   | `fix:` | patch |
   | `feat!:` or `BREAKING CHANGE:` | major |
   | `chore:` / `refactor:` / `docs:` / `test:` / `perf:` | patch |

2. Release Please opens a **Release PR** with:
   - `package.json` version bumped
   - `.release-please-manifest.json` updated
   - `CHANGELOG.md` entries moved from `[Unreleased]` into a new version section

3. Review and merge the Release PR.

4. On merge, Release Please creates a tag `mcp-v<X.Y.Z>`.

5. The tag triggers the existing CI workflow, which publishes to npm.

### Do NOT

- Manually bump `package.json`'s `version` field (Release Please manages it).
- Create `mcp-v*` tags by hand (Release Please creates them).
- Publish to npm manually (`npm publish`) unless recovering from a broken CI release.

### Prerelease (`beta`)

While the MCP server is on `1.0.0-beta.N`, Release Please increments the `beta` counter with every merged commit. When the product is stable enough for GA, bump to `1.0.0` with a `feat!:` or an explicit `Release-As: 1.0.0` commit footer.

---

## Critical Behaviors (Regression Zones)

These behaviors are load-bearing. Any PR that changes them needs an accompanying test in `test/`.

| Behavior | Where | Test |
|----------|-------|------|
| JSON-RPC 2.0 envelope (`jsonrpc`, `method`, `params`, `id`) | `index.js` request builder | Every `*.test.js` via `callMcpTool` |
| Bearer token attached to every forwarded request | `index.js` HTTPS options | `config.test.js` / integration |
| SSE (`text/event-stream`) and plain JSON responses both parsed | `index.js` response reader | `integration.test.js` |
| Notifications (no `id` field) forwarded but produce no response | `index.js` request dispatch | `integration.test.js` |
| Retry on network + 429 + 5xx; fail fast on 4xx | `lib/retry.js` | `retry.test.js` |
| Token refresh before the configured margin | `index.js` token cache | `metrics.test.js` / `integration.test.js` |
| Sensitive substrings redacted in logs | `lib/logger.js` | `logger.test.js` |

Do NOT regress these without a corresponding spec update and migration note in the PR description.

---

## Security

- **Never log tokens in plaintext** — the logger redacts known sensitive key names; prefer structured logging (`logger.info({...})`) over string concatenation so redaction can kick in.
- **Only accept `https://` base URLs in production.** Local development (`https://localhost:5002`) allows self-signed certs via the dev-mode check in `lib/config.js`.
- **Retries must fail fast on 4xx** — retrying a 400 is a bug that can amplify abuse; retrying a 401 risks lockout. Only network errors, 429, and 5xx are retryable.
- **Token cache is process-local** — it is never persisted to disk. Restarting the MCP server forces a re-auth.
- **Changes to `lib/retry.js` or the HTTPS options in `index.js` are security-sensitive** — require `uteamup-security-review` (see CLAUDE.md) plus code-reviewer sign-off.

---

## Common Mistakes

- ❌ Adding tool-specific code in `index.js`. The proxy is generic — tools live on the backend.
- ❌ Forgetting the `describeJsonRpcCompliance` / `describe401Unauthorized` / `describe503ServiceUnavailable` blocks on a new tool test.
- ❌ Manually editing `package.json`'s `version` field (Release Please manages it).
- ❌ Logging token strings without going through the structured logger.
- ❌ Adding a new retry trigger for 4xx status codes.
- ❌ Shipping a new tool on the backend without a matching `test/*.test.js` file (Rule 6 coverage gap).

---

## Pointers

- Backend tool registration: `UteamUP_Backend/UteamUP_API/MCP/Tools/*.cs`
- CLI subcommand registration (mirrors MCP tools): `UteamUP_CLI/internal/registry/domains_*.go`
- Wiki seed guide: `UteamUP_Frontend/Guidelines/WikiSeedGuidelines.md`
- Frontend styling rules (when docs/examples touch UI): `UteamUP_Frontend/Guidelines/PageAndComponentStylesGuidelines.md`
