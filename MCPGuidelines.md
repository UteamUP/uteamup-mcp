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

> **CRITICAL RULE — Always Use `https://api.uteamup.com`:**
> All MCP connections, external connectors (ChatGPT, Claude Desktop, Claude Code, Cursor, etc.), configuration, and live MCP verification MUST **always** use **`https://api.uteamup.com`** (`https://api.uteamup.com/mcp`).
> **NEVER** configure, point, or test MCP against `localhost`, local tunnels (`trycloudflare.com`, `ngrok`, etc.), or `devback.uteamup.com`. If a backend MCP fix is required, deploy it to production (`https://api.uteamup.com`) and verify directly against `https://api.uteamup.com/mcp`.

Environment variables (set by the MCP client in its `mcp.json`, or exported in the shell):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `UTEAMUP_API_KEY` | ✅ | — | 32-character API key |
| `UTEAMUP_SECRET` | ✅ | — | 64+ character secret |
| `UTEAMUP_API_BASE_URL` | — | `https://api.uteamup.com` | Production backend URL (`https://api.uteamup.com` — always use production; never use `localhost` or `devback.uteamup.com`) |
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
   The method name (e.g. `UteamupProjectMyProjects`) is exposed over MCP in **snake_case**
   (`uteamup_project_my_projects`). The backend derives it automatically and asserts every served
   name against `^[a-z][a-z0-9_]{0,63}$` (`McpToolCatalogContractTests.ServedToolNamesAreSnakeCase`),
   so the MCP test must call the snake_case name, not the C# method name.

2. **MCP test** — add a Jest file under `UteamUP_MCP/test/` following the `labour-rate.test.js` / `project-my-projects.test.js` pattern:
   - `nock`-mock the backend `/mcp` POST
   - Assert success, empty, and error shapes
   - Include `describeJsonRpcCompliance`, `describe401Unauthorized`, `describe503ServiceUnavailable` from `test/helpers/mcp-error-tests.js`

3. **CLI** — update `UteamUP_CLI/internal/registry/domains_<name>.go` to expose the new tool as a subcommand (see `CLIGuidelines.md`).

4. **Wiki** — append/update a JSON article under `UteamUP_Backend/UteamUP_API/SeedData/Wiki/` per `UteamUP_Frontend/Guidelines/WikiSeedGuidelines.md`.

**Do NOT** add tool-specific code in `UteamUP_MCP/index.js`. If you find yourself editing `index.js` to handle a specific tool, step back — either the backend contract is wrong, or the change belongs in `lib/` (generic proxy behavior).

---

## Authorization (MCP 2026-07-28)

The backend is the OAuth 2.1 authorization server for `/mcp` and `/mcp/read-only`:

- **RFC 9728** protected resource metadata, referenced from `WWW-Authenticate`.
- **RFC 9207** `iss` on every authorization response (code, error and consent decisions);
  metadata sets `authorization_response_iss_parameter_supported`.
- **RFC 8707** `resource` is bound to the code at `/oauth/authorize`; `/oauth/token` refuses another resource,
  and `McpApiKeyStatusMiddleware` accepts a token only on the exact resource it was issued for.
- **Dynamic Client Registration** (deprecated in the spec, still used by hosts) accepts `application_type`
  `web` (default) or `native` and echoes it; anything else is `invalid_client_metadata`.
- **Client ID Metadata Documents**: an https `client_id` URL (path required, default port, no fragment, user
  info or loopback) is fetched through `SsrfSafeHttpClientFactory` (no private addresses, no redirects, 5 s,
  5 KB). The document's `client_id` must equal the URL, the client must be public, and at least one
  `redirect_uri` must pass the redirect policy. It maps to a stable client row (`ToRegisteredClientId`) and then
  follows the registered-client consent flow; the consent page shows the document host next to the name.
  A document may instead declare `token_endpoint_auth_method: private_key_jwt` with an https `jwks_uri`
  (redirects then optional); such a client must send an RFC 7523 `client_assertion` on every token request.
- **Enterprise-Managed Authorization** (`io.modelcontextprotocol/enterprise-managed-authorization`, ID-JAG):
  a company owner sets one trusted issuer with `PUT /api/tenant/enterprise-auth` (`Tenant.ManageSaml`, owner
  or configured platform admin); enabling reads `<issuer>/.well-known/openid-configuration`, whose `issuer`
  must match exactly. A `private_key_jwt` client sends `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
  with the ID-JAG as `assertion`. `McpEnterpriseAuthorizationService` checks: typ `oauth-id-jag+jwt`,
  RS256/ES256, keys only from the issuer's discovery document, a single `aud` equal to our issuer,
  `client_id` equal to the authenticated client, `sub`, `jti` single use (`OAuthAssertionReplays`), lifetime
  at most one hour, 60 s skew, no `cnf`, `resource` limited to `/mcp` and `/mcp/read-only`. The person is the
  account already linked to the issuer and `sub`, or else one confirmed account whose email is in a verified
  company domain (then linked). Accounts with local two-factor sign-in use the consent flow. `CanLinkAsync`
  (current licensed member, assistant linking on) applies as for consent. No refresh token is issued.

## Upload tickets (large files)

`uteamup_document_create_upload_ticket` returns a single-use URL (`PUT /api/mcp/upload-tickets/{token}`) valid
for 15 minutes, for clients that can make HTTP requests (Claude Code, Codex) and files too large for base64.

- The 43-character token is the only credential and is stored as a SHA-256 hash (`McpUploadTickets`, shared
  database, no file content). It is bound to tenant, user, API key, file name, content type and exact size.
- The PUT claims the ticket atomically (`ExecuteUpdate`), so a token works once; unknown, used and expired tokens
  all answer 404. Membership (`HasCurrentMembershipAsync`), `Document.Upload` and the API key are re-checked at
  upload; a tenant frozen for a data move answers 503.
- The file goes through `IDocumentRepository.UploadDocumentAsync` (same validation and storage as the web upload)
  inside `SchedulingDatabaseScope` for the ticket's tenant, so dedicated databases are honoured.
- `uteamup_document_upload_ticket_get` shows status and `documentGuid` to the issuing caller only.

## Structured output (outputSchema)

Only curated read tools set `[McpServerTool(UseStructuredContent = true)]`: today `uteamup_asset_get`,
`uteamup_workorder_get`, `uteamup_part_get` and `uteamup_location_get`. The SDK then publishes an `outputSchema`
and returns the DTO as `structuredContent` next to the same JSON as text (the CLI and older clients read the
text). Rules, enforced by `McpStructuredOutputContractTests`:

- Add a tool to the list only when its DTO schema stays under 16 KB; every schema is sent on each `tools/list`.
- The OpenAI connector is recognised by its client name (`_meta["io.modelcontextprotocol/clientInfo"].name`)
  or User-Agent containing `openai`/`chatgpt` (`IsOpenAiConnectorRequest`, `ClientNameOf`); only a request that
  names no client falls back to "2026-07-28 without `X-Request-ID`".
- `SanitizeToolForMcp` keeps the schema for standard MCP clients and removes integer `*Id`/`*Ids` properties
  (results lose them through `McpIntegerIdentifiers`). The OpenAI connector path and the read-only pilot
  still strip `outputSchema`.
- `RequireStructuredObject` turns a success without an object (for example a `null` "not found") into a tool
  error, because clients validate `structuredContent` against the schema.

## Download links (resource_link)

`uteamup_document_create_download_link` (`Document.View`) returns three things for one document: a JSON text
block first (older clients read `content[0].text`), an MCP `resource_link` (uri, name, mimeType, size), and the
same JSON as `structuredContent`. The `downloadUrl` is `GET /api/mcp/download-links/{token}`: a data-protected
token (`McpDownloadLinkRepository`, nothing stored when issued) bound to tenant, user, API key and document,
valid 10 minutes and single use (its id is consumed in `OAuthAssertionReplays` on the first GET; HEAD checks
without consuming). Membership, `Document.View`, the API key and the company's data-move freeze are checked
again on use. The anonymous request has no viewer, so documents hidden by reading-privacy rules are not served
(fail closed). The file is always sent as an attachment with `nosniff`, `no-store` and `no-referrer`. The CLI
mirror is `uteamup document-upload download-link <documentGuid>`.

## Tasks (long-running tools, SEP-2663)

The backend implements the `io.modelcontextprotocol/tasks` extension for a short allow-list of slow tools
(`McpTaskExecution.TaskCapableTools`: reports, PDFs, exports, imports, summaries). A client that declares the
extension gets a task handle and polls `tasks/get`; every other tool, and every client that does not declare
it, stays synchronous. The proxy forwards `tasks/*` unchanged.

Security model — read before adding a tool to the list:

- The SDK runs a task's call pipeline **after** the HTTP request ends, when `HttpContext` would be null.
  `McpTaskExecution.PinCallerAsync` (an alternate-result filter registered before `WithTasks`) copies the
  caller's user, request items (tenant, API key, `TenantDbInfo`) and connection into a detached context, gives
  the call its own service scope and pins both through `McpTaskHttpContextAccessor` (an `AsyncLocal`, never the
  live request's holder). All ordinary filters (session revocation, tenant kind, argument checks) still run.
- `McpTaskStore` keeps tasks in the tenant's data database (`McpTaskRecords`, dedicated databases included) and
  binds every read, cancel and status change to the creating tenant **and** owner (`userId|apiKeyId`).
  A missing caller is nobody. Terminal states never change. A task past its one-hour lease reads as failed.
- Only add a tool whose handler takes everything from its command and the pinned context. Tests:
  `McpTaskStoreTests`, `McpTaskExecutionTests` (real SDK client, other-user and other-tenant denial).

## Agent Skills (portable, every host)

Workflow skills live in **one** place: `UteamUP_Backend/Skills/<name>/SKILL.md` (+ optional `references/*.md`).
They reach every agent host three ways, from the same bytes:

| Route | Hosts | How |
|-------|-------|-----|
| MCP Skills extension (`io.modelcontextprotocol/skills`, `skills/list`, `skills/get`, `skill://` resources) | Claude Code ≥2.1.331, claude.ai, VS Code Copilot, other hosts that implement SEP-2640 | Backend `McpConfiguration.cs` → `WithSkillPackages(McpAgentSkillCatalog.Packages)` |
| Tools `uteamup_agent_skill_list` / `uteamup_agent_skill_get` | Every MCP client: ChatGPT/OpenAI, Kimi, MiniMax, ZCode, Cursor, Gemini, older Claude clients | Backend `MCP/Tools/AgentSkillTools.cs` |
| `SKILL.md` folders in host plugins | Claude Code plugin, MiniMax, ZCode | `npm run sync-skills` copies from the backend; `node scripts/sync-skills.js --check` verifies |

Authoring rules (enforced by `UteamUP_API_Tests/Unit/MCP/McpAgentSkillsTests.cs` and `test/plugin-skills.test.js`):

- agentskills.io format only: frontmatter keys `name`, `description`, `license`, `compatibility`, `metadata`. No host-specific keys (`allowed-tools`, `when_to_use`, `model`, …).
- `name` is kebab-case, prefixed `uteamup-`, and equals the folder name. `description` ≤ 1,024 chars, third person, with "Use when …".
- `metadata.access` is `read` or `write`. Read skills may only name read tools. `/mcp/read-only` and the read-only plugins (MiniMax, ZCode) serve only five tools, so they get only read skills that also set `metadata.read-only-connection: "yes"`. Home and Individual tenants get none.
- Tool names come from the SDK's snake_case policy, so acronyms split: `UteamupITManagementDashboard` is `uteamup_it_management_dashboard`, `UteamupIoTAlertsList` is `uteamup_io_t_alerts_list`. Check names against the served catalogue (the backend test does), not against a hand-made conversion.
- Name tools by their bare MCP name (`uteamup_asset_search`); every name must exist in the served catalogue.
- Text only (`.md`), references one level deep, ≤ 100 KB per file and ≤ 400 KB per skill (Anthropic's directory scan limits). No scripts, no tenant data.
- Changing a skill changes its digest, so hosts ask users to approve it again. Edit deliberately, then run `npm run sync-skills` in this repo.

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

Releases are published to **npm** (`@uteamup/mcp-server`) by the `publish-npm` job in `.github/workflows/release-please.yml`, using npm Trusted Publishing (GitHub OIDC, provenance, no `NPM_TOKEN`). Until 2026-10-20 that job did not exist and npm stayed on `1.0.0-beta.9` while GitHub releases moved on, so check `npm view @uteamup/mcp-server dist-tags` after every release.

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

3. Review and merge the Release PR. Branch protection requires a review; the owner merges with
   `gh pr merge <n> --admin --squash`.

4. On merge, Release Please creates the tag `v<X.Y.Z>` and a GitHub release.

5. In the same workflow run, `publish-npm` checks out that tag, runs the Jest suite (`prepublishOnly`) and
   publishes with `--tag latest`. `publish-mcp-registry` then updates the Official MCP Registry.

6. Verify: `npm view @uteamup/mcp-server dist-tags` shows the new version as `latest`. Users on
   `npx @uteamup/mcp-server` may keep a cached copy; `npx -y @uteamup/mcp-server@latest` forces the new one.

**Trusted Publisher configuration (owned by npmjs.com):** package `@uteamup/mcp-server` →
Settings → Trusted Publisher. The existing `publish-npm` job already uses a GitHub-hosted
runner, `id-token: write`, Node 22 and npm 11.6.2. Its npm connection must match:

| Setting | Required value |
|---------|----------------|
| Publisher | GitHub Actions |
| Organization or user | `UteamUP` |
| Repository | `uteamup-mcp` |
| Workflow filename | `release-please.yml` (filename only, case-sensitive) |
| Environment name | Empty; the publishing job has no GitHub environment |
| Allow npm publish | Enabled; the workflow publishes directly |
| Allow npm dist-tag | Disabled; the workflow does not manage tags separately |

New npm connections allow staged publishing by default. Explicitly enable `npm publish`
for this workflow; enabling OIDC in GitHub alone does not authorize npm publication.
Follow the project configuration approval gate before creating or replacing the connection.
The package's existing two-factor policy is independent of this OIDC configuration.

With npm 11.15 or newer, the official CLI can create the same connection after approval:

```bash
UTEAMUP_DEPLOYED_CONFIG_APPROVED=1 npm trust github @uteamup/mcp-server \
  --repo UteamUP/uteamup-mcp --file release-please.yml \
  --allow-publish --yes --auth-type=web
```

Keep stdin and stdout attached to a real terminal for the one-time web authentication.
Use this command if the website discards the form after authentication. Confirm the
success response and the saved connection on npmjs.com before starting validation.

Validate a new connection within npm's two-day window using a new Release Please release.
Require a successful `publish-npm` job, the expected npm `latest` version and npm provenance
that identifies this repository, workflow and release commit. Rollback is to remove only
this package's `UteamUP/uteamup-mcp` → `release-please.yml` Trusted Publisher connection.
Do not add a separate replay workflow or a long-lived publish token as a recovery shortcut.

Reference: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

### Do NOT

- Manually bump `package.json`'s `version` field (Release Please manages it).
- Create `v*` tags by hand (Release Please creates them).
- Publish to npm manually (`npm publish`) unless recovering from a broken CI release. A manual publish needs
  `npm login --auth-type=web`, the owner's security key, and `UTEAMUP_FINAL_GOAL_GATE=1` because
  `prepublishOnly` runs `npm test`.

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
- Frontend styling rules (when docs/examples touch UI): `UteamUP_Frontend/Guidelines/InterfaceAndStyleGuidelines.md`
