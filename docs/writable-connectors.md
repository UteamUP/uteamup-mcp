# Writable connectors (mcp:full) — setup and activation checklist

UTE-493. Staged, full-scope (read + write) OAuth connectors for the UteamUP MCP
endpoint `https://api.uteamup.com/mcp`, sign-in with the user's own UteamUP
account (no tenant API key). Permissions follow the user's role in the company
selected on the UteamUP consent page, exactly like the published read-only
connectors.

| Directory | Client | Transport / auth | Scope |
|---|---|---|---|
| `plugins/claude-full` | Claude (custom connector, Claude Code) | HTTP + OAuth 2.0 authorization code + PKCE | `mcp:full` |
| `plugins/openai-full` | ChatGPT / Codex (custom MCP server) | HTTP + OAuth DCR (`com.openai` extension) | `mcp:full` |

The published read-only connectors (`plugins/openai`, `plugins/claude`,
`plugins/uteamup-zcode`) are unchanged and keep serving `/mcp/read-only` with
`mcp:read`. Grok Bot is intentionally omitted until its marketplace supports a
full-scope remote connector; until then users can keep the read-only custom
connector and, where needed, the Node proxy with an API key.

## Why they are staged

Advertising `mcp:full` while user login is not actually possible on `/mcp`
recreates bug 180c49a7 (metadata promising an authority the endpoint does not
grant). The backend side (UTE-492, PR #250 `fix(mcp): allow full-scope
assistant OAuth on /mcp`, merge `c0a09cbe`) is merged to `main` in
UteamUP/uteamup-backend. Until that release is live and verified, these
manifests must not be referenced from any marketplace listing, registry entry
or public submission.

## Activation checklist (in order)

1. **Backend release is live.** The SRE & Release Engineer ships it on the
   UTE-534 release train. Verify `GET https://api.uteamup.com/version` returns
   a build at or after `c0a09cbe`.
2. **Metadata consistency.**
   `GET /.well-known/oauth-protected-resource?resource=https://api.uteamup.com/mcp`
   returns `resource …/mcp` with `scopes_supported: ["mcp:full"]`, and the
   read-only metadata still returns `["mcp:read"]` only.
3. **User login without an API key.** Dynamic client registration
   (`/oauth/register`), authorization code + PKCE S256 against
   `/oauth/authorize`, token exchange on `/oauth/token`, resulting access
   token accepted by `POST /mcp` (initialize) with `mcp:full`; refresh works.
   Use a production test account (demo user with a limited role), never an
   API key.
4. **Role-scoped access.** A write tool call inside the user's grants
   succeeds; a write the user's role lacks is denied. Read access for records
   outside the selected company is denied.
5. **Read-only regression.** `/mcp/read-only` still serves `mcp:read` and the
   published read-only connectors behave exactly as before.

Record evidence (version SHA, request outcomes) in the UTE-493 / UTE-534
threads on the Paperclip board.

## Promotion (after the checklist is green)

- Update this document and the README section to drop the staged status.
- Claude: keep the custom-connector flow. Directory submission for the full
  endpoint stays blocked until every advertised tool ships `title` and
  `readOnlyHint`/`destructiveHint` annotations (see
  `docs/claude-connectors-directory-submission.md` for the read-only
  precedent).
- OpenAI: build the `.codex-plugin/plugin.json` review package for the full
  connector (positive write cases + negative cases for out-of-role writes),
  then submit through the OpenAI directory flow. Keep the read-only package
  published and unchanged.
- Grok Bot: revisit when its marketplace allows a full-scope remote connector.

No step here may incur paid subscriptions or hosting cost (default deny,
`Gísli: deny subscription/hosting cost`). Production releases belong to the
SRE & Release Engineer on UTE-534.
