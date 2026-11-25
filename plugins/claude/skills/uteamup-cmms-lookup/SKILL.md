---
name: uteamup-cmms-lookup
description: Finds and summarises UteamUP CMMS records (assets, work orders, locations and spare parts) through the UteamUP MCP server, using search first and then the record GUID for detail, with paging to keep answers short. Works on the read-only connection and uses extra read tools when the full connection is available. Use when the user says things like "find the pump in building A", "list my assets", "show open work orders for this machine", "what work is assigned to the compressor", "where is this asset", "do we have this part in stock", or "look up work order WO-123".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
  read-only-connection: "yes"
---

# UteamUP CMMS lookup

Answer questions about a company's maintenance data in UteamUP: which assets exist, what state
they are in, which work orders are open or done, where things are located and which spare parts
are in stock. The skill only reads. It searches by name or text first, takes the GUID from the
result, then fetches details by that GUID, and summarises instead of dumping raw records.

## Connections

UteamUP offers two MCP connections:

- **Read-only** (`/mcp/read-only`): exposes only the five core read tools marked "RO" below.
  Any other tool call is refused by the server.
- **Full** (`/mcp`): exposes every tool in the table, plus write tools that this skill never uses.

Check which tools your client lists. Use the RO tools first; use full-only tools when they are
listed. If the user needs something only a full-only tool can answer and it is not listed, say
so and suggest connecting the full UteamUP connection or opening the web app.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Conn. | Purpose | Key arguments |
|------|-------|---------|---------------|
| `uteamup_asset_search` | RO | Find assets by partial name or serial number | `searchFilter` (1-200 chars) |
| `uteamup_asset_list` | RO | Page through assets with status and location | `page`, `pageSize` (max 100) |
| `uteamup_asset_get_by_guid` | RO | Full asset detail: attributes, location breadcrumb, documents, tags | `guid` |
| `uteamup_workorder_search` | RO | Find work orders by words in title or description | `searchFilter` |
| `uteamup_workorder_list` | RO | Page work orders; filter by asset, text or open only | `page`, `pageSize`, `assetGuid`, `search`, `openOnly` |
| `uteamup_workorder_get` | full | One work order with priority, assignee, asset | `workorderGuid` |
| `uteamup_comment_list_by_workorder_paginated` | full | Comments on a work order | `workorderGuid`, `page`, `pageSize` |
| `uteamup_asset_maintenance_history` | full | Completed work orders for an asset, newest first | `assetGuid`, `page`, `pageSize` |
| `uteamup_asset_state_get` | full | Lifecycle stage and operational state of an asset | `assetGuid` |
| `uteamup_location_list` | full | Page locations, optional name search | `page`, `pageSize`, `search` |
| `uteamup_location_get_by_guid` | full | One location: address, contact, type | `locationGuid` |
| `uteamup_location_node_tree` | full | Floors, rooms and areas inside a location | `locationGuid` |
| `uteamup_part_search` | full | Find parts by name, description, part or serial number | `searchTerm`, `maxResults` |
| `uteamup_part_list` | full | Page parts, optional name filter and sort | `pageNumber`, `pageSize`, `nameFilter` |
| `uteamup_part_get` | full | One part with specifications and vendor | `partGuid` |
| `uteamup_part_get_stock_levels` | full | Stock per location with low-stock warnings | `partGuid` |
| `uteamup_global_search` | full | Search many record types at once (also `#tag`) | `query` (3+ chars), `maxResults`, `entityTypes` |
| `uteamup_tenant_get_my_tenants` | full | Show the company (tenant) this connection works in | none |

## Workflow

1. **Confirm the company.** The company is fixed by the connection: on the read-only connection
   it is the company the user picked at sign-in; with an API key it is the key's company. No MCP
   tool switches company mid-session. If the user asks about another company, or a tool reports
   no tenant or access denied for the tenant, call `uteamup_tenant_get_my_tenants` when listed,
   show the result, and ask the user to reconnect and choose the right company.
2. **Identify the record type** the user means: asset, work order, location or part. If unclear
   and the full connection is available, call `uteamup_global_search` with `query` and
   `maxResults` 5, then ask which match they mean.
3. **Search, do not guess.**
   - Asset: `uteamup_asset_search` with `searchFilter` set to the name or serial number.
   - Work order: `uteamup_workorder_search` with `searchFilter`, or `uteamup_workorder_list` with
     `search` (name, ticket ID or exact GUID).
   - Location: `uteamup_location_list` with `search`.
   - Part: `uteamup_part_search` with `searchTerm` and a small `maxResults` (for example 10).
   If several records match, show a short numbered list (name plus one distinguishing field such
   as serial number, location or status) and ask the user to pick one.
4. **Fetch detail by GUID** from the chosen result:
   - Asset: `uteamup_asset_get_by_guid` with `guid`.
   - Work order: `uteamup_workorder_get` with `workorderGuid` (full); on read-only, use the row
     returned by `uteamup_workorder_list` or `uteamup_workorder_search`.
   - Location: `uteamup_location_get_by_guid`, then `uteamup_location_node_tree` for rooms.
   - Part: `uteamup_part_get` with `partGuid`, then `uteamup_part_get_stock_levels` for stock.
5. **Follow links when asked.**
   - Open work on an asset: `uteamup_workorder_list` with `assetGuid` and `openOnly` true.
   - Past work on an asset: `uteamup_asset_maintenance_history` with `assetGuid` (full).
   - Is it running: `uteamup_asset_state_get` with `assetGuid` (full); on read-only, report the
     status field from `uteamup_asset_get_by_guid`.
   - Discussion on a work order: `uteamup_comment_list_by_workorder_paginated` (full).
6. **Page deliberately.** Start with `pageSize` 10 (or the user's number, max 100). Tell the user
   how many results exist and offer the next page instead of fetching everything.
7. **Summarise.** Lead with the answer, then key fields: name, status (`statusName` for work
   orders), location, assignee, dates. Mention the GUID only when the user may need it again.

## Rules

- Identifiers are GUIDs. Always search or list first and reuse the returned GUID. Never invent a
  GUID and never use integer ids (some legacy tools accept them; do not use those paths).
- This skill never creates, updates, archives or completes anything. For changes, hand over to a
  write skill such as `uteamup-workorder-triage`, or tell the user writing needs the full
  UteamUP connection and their permission.
- Work order status: `Completed` means finished, `Cancelled` is not completed, `Unknown` is an
  unrecognised value. Use `statusName` rather than the numeric status in answers.
- If a tool returns a permission error (for example missing `Asset.View`), report it plainly. Do
  not try other tools to get around it.
- If a tool is not listed or is refused as not allowed on this connection, explain that it
  needs the full UteamUP connection; continue with the read-only tools where possible.
- If a call returns 401 or `invalid_token`, the link, licence or company setting has ended. Ask
  the user to reconnect or contact their UteamUP administrator.
- `uteamup_asset_search` needs non-blank text; `uteamup_global_search` needs at least 3
  characters. Ask for a better term rather than sending an empty search.
- Keep answers short. Do not paste whole JSON responses; never list more than about 20 rows
  without asking.
- Do not use AI-priced tools (for example `uteamup_asset_ask`) for lookups; these reads spend no
  AI credits.

## Examples

**"Is anything open on the main air compressor?"**
1. `uteamup_asset_search` `{ "searchFilter": "air compressor" }` → user picks the match.
2. `uteamup_workorder_list` `{ "assetGuid": "<asset GUID>", "openOnly": true, "pageSize": 10 }`
3. Summarise: count, then each work order's name, `statusName`, due date and assignee.

**"Where is pump P-12 and when was it last serviced?"** (full connection)
1. `uteamup_asset_search` `{ "searchFilter": "P-12" }`
2. `uteamup_asset_get_by_guid` `{ "guid": "<asset GUID>" }` → location breadcrumb.
3. `uteamup_asset_maintenance_history` `{ "assetGuid": "<asset GUID>", "pageSize": 1 }`

**"Do we have V-belts in stock?"** (full connection)
1. `uteamup_part_search` `{ "searchTerm": "V-belt", "maxResults": 10 }`
2. `uteamup_part_get_stock_levels` `{ "partGuid": "<part GUID>" }` → quantity per location and
   any low-stock warning. On read-only, say part lookups need the full connection.
