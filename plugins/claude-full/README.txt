UteamUP CMMS — writable OAuth connector for Claude

Server: https://api.uteamup.com/mcp
Authentication: UteamUP user OAuth (authorization code + PKCE, RFC 7591 dynamic
registration). Requested access: mcp:full (read + write, bounded by the
signed-in user's role).

This is the full-scope companion to the published read-only connector. It signs
in with the user's own UteamUP account; permissions follow the user's role in
the company they select on the UteamUP consent page. No API key or secret is
used.

STATUS (2026-11-18): staged, not yet activated. The backend user-login flow for
mcp:full on /mcp (UTE-492, UteamUP/uteamup-backend PR #250) is merged to main
but must be released to production and verified before users connect through
this manifest. See docs/writable-connectors.md for the activation checklist.
Do not reference this manifest from the Claude marketplace listing until that
checklist is complete.

How a user connects (after activation):
- Claude.ai / Claude Desktop: Settings -> Connectors -> Add custom connector
  with the URL https://api.uteamup.com/mcp, choose "Sign in now" and "Register
  automatically", then approve on the UteamUP consent page and pick the company.
- Claude Code: add the mcpServers entry from this file to the user or project
  MCP configuration.

The company must allow assistant connections (Company -> API Keys -> Allow
members to connect AI assistants). Directory submission for the full endpoint
stays blocked until every advertised tool ships title and
readOnlyHint/destructiveHint annotations; until then this remains a custom
connector.
