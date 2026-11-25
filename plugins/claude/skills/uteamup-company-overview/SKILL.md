---
name: uteamup-company-overview
description: Gives a new user a read-only tour of how their company is set up in UteamUP through the UteamUP MCP server - the company (tenant) and licence, enabled product modules and feature levels, industry profile, people, teams and roles, sites and the room tree, asset types, categories, currencies and holidays - summarised in plain language without changing anything. Use when the user says things like "give me an overview of our company in UteamUP", "I am new, how is this set up", "which modules do we have", "who is on the maintenance team", "what roles exist and what can they do", "what can I do here", "list our sites", or "what asset types do we use".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP company overview

Orient a new user in their company's UteamUP setup. The skill only reads: it collects a few
facts from each area, summarises them in short sections, and points to where things live. It
never changes settings, roles, members, modules or any record, even if asked during the tour;
for changes it names the right place (the web app's Tenant Management, or a write skill).

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`). All are read tools. They need the full UteamUP
connection; the read-only connection exposes only a few core search tools.

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies this connection can see | none |
| `uteamup_tenant_get_by_guid` | Company details | `tenantGuidToGet` |
| `uteamup_tenant_has_license` | Whether the signed-in user has a licence here | none |
| `uteamup_tenant_modules_get` | Module families: included in plan, switched on | none |
| `uteamup_tenant_feature_maturity_get` | Feature level for web and mobile (General, Preview, Beta, Internal) | none |
| `uteamup_tenant_industry_profiles_get` | Primary and additional industry profiles | none |
| `uteamup_menu_visibility_get` | Menu items hidden for the company or the user | none |
| `uteamup_user_list` | Page people in the company | `page`, `pageSize` (max 100) |
| `uteamup_user_search` | Find a person by name or email | `searchFilter` |
| `uteamup_user_get` | One person | `userGuid` |
| `uteamup_user_permissions` | Permissions of one person | `userId` (the user GUID) |
| `uteamup_team_list` | Page teams with member counts | `page`, `pageSize` |
| `uteamup_team_get` / `uteamup_team_members` | One team / its members | `teamGuid` |
| `uteamup_role_list` | Roles with permission and user counts | none |
| `uteamup_role_get` / `uteamup_role_get_users` | One role / who has it | `id` / `roleId` (role id string from the list) |
| `uteamup_location_list` | Sites and buildings | `page`, `pageSize`, `search` |
| `uteamup_location_node_tree` | Floors and rooms in one site | `locationGuid` |
| `uteamup_location_node_type_list` | Node types used in the room tree | none |
| `uteamup_asset_type_get_tree` | Asset type hierarchy | none |
| `uteamup_asset_type_list` | Flat asset type list | `includeInactive` |
| `uteamup_category_list` | Categories for assets, parts and work | none |
| `uteamup_currency_list` | Currencies in use | `page`, `pageSize`, `nameFilter` |
| `uteamup_tenant_holiday_get_by_year` | Company holidays | `year` |
| `uteamup_global_search` | Find any record by text | `query` (3+ chars), `entityTypes`, `maxResults` |

## Workflow

1. **Company.** Call `uteamup_tenant_get_my_tenants`. If several companies are listed, ask which
   one the tour is for; the connection decides the active company, so if it is not the active one
   ask the user to reconnect and choose it. Then `uteamup_tenant_get_by_guid` for its details and
   `uteamup_tenant_has_license` for the user's own licence.
2. **Ask what matters.** Offer the sections below and let the user pick, or run them all in order
   with a short summary each. Stop after each section if the user wants to dig in.
3. **Product setup.** `uteamup_tenant_modules_get`: list modules that are on, and those included
   in the plan but switched off. `uteamup_tenant_feature_maturity_get`: explain the level (Preview
   and Beta must also be switched on per phone in the mobile app's Settings).
   `uteamup_tenant_industry_profiles_get`: name the primary profile (it sets the coding system).
4. **People.** `uteamup_user_list` with `pageSize` 25: give the total and a few names with job
   titles; do not dump the whole directory. `uteamup_team_list`, then `uteamup_team_members` for
   teams the user asks about.
5. **Roles and access.** `uteamup_role_list`: each role's name, user count and a one-line
   description of what it allows. For "what can I do here", find the user with
   `uteamup_user_search` and call `uteamup_user_permissions` with their GUID; group permissions
   by area (for example Assets: view, create, update).
6. **Places.** `uteamup_location_list` (first page) and, for the main site,
   `uteamup_location_node_tree` as an indented outline.
7. **Asset setup.** `uteamup_asset_type_get_tree` as a short hierarchy (top two levels), plus
   `uteamup_category_list` names.
8. **Money and calendar.** `uteamup_currency_list` and `uteamup_tenant_holiday_get_by_year` for
   the current year.
9. **Close** with a 5-line summary and two or three suggested next steps (for example "look up
   your open work orders" or "see where the compressors are"), pointing to the matching skill.

## Rules

- Read only. Never call create, update, set, archive, delete, invite, assign or transfer tools,
  even if the user asks during the tour. Explain where the change is made (Tenant Management in
  the web app, or a write skill such as `uteamup-location-setup`) and that it needs the right
  permission.
- Identifiers are GUIDs. List or search first and reuse the returned GUID; never guess one and
  never use integer ids.
- Make sure the right company is active; if tools report no tenant or a different company, stop
  and ask.
- Respect permission errors (for example Users.View, Role.View, Tenant.View): say that section is
  not visible to this user and move on. Do not try other tools to get the same data.
- People data is personal. Show names, job titles and team membership only as needed; never list
  emails or phone numbers in bulk, and never export the directory.
- Keep it short: first pages only (`pageSize` 10-25), counts plus examples, no raw JSON.
- If a tool is not listed or is refused as not allowed on this connection, explain that the
  overview needs the full UteamUP connection.

## Examples

**"I just joined. Give me the overview."**
1. `uteamup_tenant_get_my_tenants` → one company → `uteamup_tenant_get_by_guid`, `uteamup_tenant_has_license`.
2. `uteamup_tenant_modules_get`, `uteamup_tenant_industry_profiles_get`.
3. `uteamup_user_list` `{ "pageSize": 25 }`, `uteamup_team_list` `{ "pageSize": 25 }`, `uteamup_role_list`.
4. `uteamup_location_list` `{ "pageSize": 10 }`, `uteamup_asset_type_get_tree`.
5. Summarise in short sections and suggest next steps.

**"What am I allowed to do?"**
1. `uteamup_user_search` `{ "searchFilter": "<user's name or email>" }` → user GUID.
2. `uteamup_user_permissions` `{ "userId": "<user GUID>" }` → grouped list by area.

**"Who is on the electrical team?"**
1. `uteamup_team_list` → find "Electrical" → `uteamup_team_members` `{ "teamGuid": "<GUID>" }`.
2. List names and job titles.
