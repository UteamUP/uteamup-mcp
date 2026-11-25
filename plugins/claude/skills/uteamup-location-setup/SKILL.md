---
name: uteamup-location-setup
description: Sets up and maintains a company's places in UteamUP through the UteamUP MCP server - sites and buildings (locations), the floor, room and area tree inside each location, node types, floorplans, site-access windows and the location privacy policy - with search first, GUIDs only, and a confirmed change summary before every write. Use when the user says things like "add our new warehouse", "create floors 1 to 3 in building B", "add a plant room under the second floor", "move this room to another floor", "show the floorplan for level 2", "set access hours for the site", "archive the old depot", or "what is our location privacy policy".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP location setup

Build and maintain the physical structure of a company in UteamUP. A **location** is a site or
building with an address; locations do not nest. Everything inside a location (floors, rooms,
sections, areas such as a garage or plant room) is a **node** in that location's tree. Floorplans
hang off nodes. The skill always reads the current structure first, proposes the change, waits
for a clear yes, then writes using GUIDs.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_location_list` | Page or search locations by name | `page`, `pageSize` (max 100), `search` |
| `uteamup_location_get_by_guid` | One location: address, contact, type, `updatedDate` | `locationGuid` |
| `uteamup_location_create` | Create a site or building | `model` (`name`, `description`, `street`, `city`, `postalCode`, `country`, ...), `confirmed` |
| `uteamup_location_update` | Replace a location's details | `locationGuid`, `model` (full data + `idempotencyKey`, `expectedUpdatedAt`, `mutationOutcomeVersion` 1), `confirmed` |
| `uteamup_location_archive` | Retire a location (reversible) | `locationGuid` |
| `uteamup_location_restore` | Bring an archived location back | `locationGuid` |
| `uteamup_location_node_tree` | Floors, rooms and areas inside a location | `locationGuid`, optional `locationNodeTypeGuid` |
| `uteamup_location_node_type_list` | Node types (Floor, Room, Area, custom) and their GUIDs | none |
| `uteamup_location_node_type_create` | Add a custom node type | `model` (`name`, `iconName`, `displayOrder`), `confirmed` |
| `uteamup_location_node_type_update` | Rename or reorder a node type | `typeGuid`, `model`, `confirmed` |
| `uteamup_location_node_create` | Add a floor, room or area | `locationGuid`, `model` (`floorName`, `floorNumber`, `parentLocationFloorGuid`, `locationNodeTypeGuid`, `description`, `idempotencyKey`, `mutationOutcomeVersion` 1), `confirmed` |
| `uteamup_location_node_update` | Rename or retype a node | `nodeGuid`, `model` (`floorName`, `floorNumber`, `isActive`, `locationNodeTypeGuid`, `idempotencyKey`, `expectedUpdatedAt`, `mutationOutcomeVersion` 1), `confirmed` |
| `uteamup_location_node_move` | Move a node under another node, or to the root | `nodeGuid`, `model` (`newParentLocationFloorGuid` or null, `idempotencyKey`, `expectedUpdatedAt`, `mutationOutcomeVersion` 1), `confirmed` |
| `uteamup_location_node_delete` | Remove a node from the tree | `nodeGuid`, `model` (`idempotencyKey`, `expectedUpdatedAt`, `mutationOutcomeVersion` 1), `confirmed` |
| `uteamup_floorplan_get_by_location` | All floorplans in a location | `locationGuid` |
| `uteamup_floorplan_get_by_location_floor` | Floorplan of one node | `locationFloorGuid` |
| `uteamup_floorplan_search` | Page floorplans with filters | `request` (`pageNumber`, `pageSize`, `nameFilter`, `locationGuid`, `locationFloorGuid`, `archived`) |
| `uteamup_floorplan_get` | One floorplan with file details | `guid` |
| `uteamup_floorplan_download` | The floorplan file itself | `guid` |
| `archive_record` / `restore_record` | Archive or restore a floorplan | `recordType` `floorplan`, `recordGuid` |
| `uteamup_location_access_schedule_list` | Site-access windows of a location | `locationGuid` |
| `uteamup_location_access_schedule_create` | Add a recurring access window | `locationGuid`, `idempotencyKey`, `name`, `daysOfWeekMask`, `accessStartLocal`, `accessEndLocal`, `isAllDay`, `timeZoneId` |
| `uteamup_location_access_schedule_update` | Change an access window | `scheduleGuid`, `idempotencyKey`, `expectedUpdatedAtUtc`, same fields as create |
| `uteamup_location_access_schedule_delete` | Remove an access window | `scheduleGuid`, `idempotencyKey`, `expectedUpdatedAtUtc` |
| `uteamup_location_privacy_get_policy` | Read the company's location privacy policy | none |
| `uteamup_location_privacy_update_policy` | Save the full privacy policy | `model` (all policy fields) |
| `uteamup_location_privacy_my_grants` | Your own location shares and pending requests | none |
| `uteamup_location_privacy_my_access_log` | Who viewed your location | `page`, `pageSize` |
| `uteamup_location_privacy_revoke_grant` | End a share you gave or received | `grantGuid` |
| `uteamup_location_privacy_request_share` | Ask a colleague to share their location | `model` (`subjectUserGuid`, `scopes`, `durationDays`, `reason`) |

## Workflow

1. **Confirm the company.** If a tool reports no tenant or access denied, call
   `uteamup_tenant_get_my_tenants`, show the result and ask the user which company to use (the
   connection decides the company; ask them to reconnect if it is the wrong one).
2. **Find before creating.** Call `uteamup_location_list` with `search` set to the site name. If a
   match exists, use its `guid` instead of creating a duplicate. A room inside a building is a
   node, never a second location.
3. **Read the current tree.** Call `uteamup_location_node_tree` with the `locationGuid` and
   `uteamup_location_node_type_list` for type GUIDs. Show the tree as an indented outline.
4. **Propose the change** as a short list: what will be created, renamed, moved, archived or
   removed, with names, floor numbers, parent node and type. Ask for a clear yes.
5. **Write after the yes.** Generate a new GUID for every `idempotencyKey` and set
   `mutationOutcomeVersion` to 1. Pass `confirmed: true`.
   - New location: `uteamup_location_create` with `name` and address fields.
   - Edit location: read it with `uteamup_location_get_by_guid`, copy every field, change only
     what the user asked, set `expectedUpdatedAt` to the location's `updatedDate` (UTC), then
     `uteamup_location_update`.
   - New node: `uteamup_location_node_create` with `floorName`, `floorNumber`,
     `locationNodeTypeGuid` and, for a room under a floor, `parentLocationFloorGuid`. Do not set
     `expectedUpdatedAt` on create.
   - Edit, move or remove a node: set `expectedUpdatedAt` to that node's `updatedAt` from the
     tree. For a move to the top level pass `newParentLocationFloorGuid: null`.
   - Several nodes: create parents first, re-read the tree, then create children with the new
     parent GUIDs.
6. **Retire a site** with `uteamup_location_archive`. It is refused with `location_stocked` while
   stock locations there are active or hold stock; tell the user to empty and archive those first.
7. **Floorplans.** Read them with `uteamup_floorplan_get_by_location` or
   `uteamup_floorplan_get_by_location_floor`; fetch the file with `uteamup_floorplan_download`.
   Archive one with `archive_record` (`recordType: "floorplan"`). Uploading or editing a floorplan
   is not available through MCP with GUIDs; ask the user to do it in the web app.
8. **Access windows** (needs Workforce Planning): list first, then create or update.
   `daysOfWeekMask` adds Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64 (127 = every day).
   Times are local `HH:mm`.
9. **Privacy.** Read the policy with `uteamup_location_privacy_get_policy`. To change it, read it,
   show the old and new values, and send the full policy to
   `uteamup_location_privacy_update_policy` (requires Privacy.Manage). Personal share tools
   (`my_grants`, `my_access_log`, `revoke_grant`, `request_share`) only work when signed in as a
   person; API keys are refused.
10. **Report** what changed with names and the new tree; offer the next step.

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID. Never guess a GUID
  and never use the legacy integer tools (`uteamup_location_get`, `uteamup_floorplan_update`,
  `uteamup_floorplan_delete`, `uteamup_floorplan_upload`).
- Make sure the right company is active before writing.
- Before any create, update, move, archive or removal, show what will change and get a clear yes.
- Records are archived, never deleted. Use `uteamup_location_archive`, never
  `uteamup_location_delete`. Removing a node removes a line inside a location; confirm it and
  mention anything attached to it (assets, floorplan).
- Keep the original request (including the `idempotencyKey`) when a write times out and retry with
  the same values; do not create a second copy.
- A `expectedUpdatedAt` mismatch means someone else changed the record: re-read, show the new
  state, and ask again.
- Respect permission errors (Location.Create, Location.Update, Location.Delete, Privacy.Manage):
  report them; do not try other tools to get around them.
- Keep answers short: page with `pageSize` 10-25 and summarise.
- If a write tool is not listed, the connection is read-only; explain that changes need the full
  UteamUP connection.
- Location privacy data is personal. Never list other people's locations; this skill only reads
  the policy and the user's own shares.

## Examples

**"Set up building B with floors 1 to 3 and a plant room on floor 1."**
1. `uteamup_location_list` `{ "search": "Building B" }` → no match.
2. Propose: location "Building B" (address from user), three Floor nodes, one Room node under
   floor 1. User says yes.
3. `uteamup_location_create` `{ "model": { "name": "Building B", "street": "...", "city": "..." }, "confirmed": true }`
4. `uteamup_location_node_type_list` → GUIDs for Floor and Room.
5. `uteamup_location_node_create` three times (`floorNumber` 1-3, Floor type,
   new `idempotencyKey` each, `mutationOutcomeVersion` 1, `confirmed` true).
6. `uteamup_location_node_tree` → take floor 1's `guid`, then create "Plant room" with
   `parentLocationFloorGuid` set to it.

**"Move the server room from floor 2 to floor 3."**
1. `uteamup_location_list` → `uteamup_location_node_tree` → find both nodes and the room's `updatedAt`.
2. Confirm, then `uteamup_location_node_move` `{ "nodeGuid": "<room>", "model": { "newParentLocationFloorGuid": "<floor 3>", "idempotencyKey": "<new GUID>", "expectedUpdatedAt": "<updatedAt>", "mutationOutcomeVersion": 1 }, "confirmed": true }`

**"Show me the floorplan for level 2 of the main office."**
1. `uteamup_location_list` `{ "search": "main office" }` → `uteamup_location_node_tree`.
2. `uteamup_floorplan_get_by_location_floor` `{ "locationFloorGuid": "<level 2>" }`; offer
   `uteamup_floorplan_download` if the user wants the file.
