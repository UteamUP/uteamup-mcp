UteamUP CMMS — writable OAuth connector for OpenAI (ChatGPT / Codex)

Server: https://api.uteamup.com/mcp
Authentication: OAuth dynamic client registration (RFC 7591) against
https://api.uteamup.com, resource https://api.uteamup.com/mcp, scope mcp:full.
No API key or secret is included.

This package mirrors plugins/openai (the published read-only ChatGPT/Codex
connector) but targets the full endpoint. Users sign in with their own UteamUP
account; write access is bounded by the user's role in the company they select
on the UteamUP consent page.

STATUS (2026-11-18): staged, not submitted. The published read-only package in
plugins/openai stays on /mcp/read-only with mcp:read and must remain unchanged
until this full-scope flow is verified on production. Do not submit this
package to the OpenAI directory before the activation checklist in
docs/writable-connectors.md is complete (backend release of UTE-492, verified
user login, role-scoped write test, read-only regression check).
