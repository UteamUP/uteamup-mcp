---
name: uteamup-workorder-triage
description: Turns a fault report into a well-formed UteamUP work order through the UteamUP MCP server. Finds the asset or location, checks for open work orders on that asset to avoid duplicates, proposes priority and EN 13306 maintenance type, creates the work order (directly or from a template) after the user confirms, then assigns it, attaches checklists, adds notes and updates status. Use when the user says things like "the conveyor is making a grinding noise, raise a job", "create a work order for the leaking valve in the boiler room", "log a fault on pump 3 and give it to Anna", "triage this breakdown", "put this job on hold", or "mark the work order in progress".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.1.0"
  access: write
---

# UteamUP work order triage

Take a free-text fault report ("the pump in hall 2 is leaking oil") and turn it into one correct
work order: linked to the right asset, not a duplicate of open work, with a sensible priority and
maintenance type, assigned, and with the right checklist and notes. Every write is shown to the
user first and only sent after a clear yes.

This skill needs the full UteamUP connection (`/mcp`). On the read-only connection only the
search and list steps work; explain that creating or changing work orders needs the full
connection and the user's `WorkOrder.Create` / `WorkOrder.Update` permissions.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_asset_search` | Find the faulty asset by name or serial number | `searchFilter` |
| `uteamup_asset_get_by_guid` | Confirm asset detail and its location | `guid` |
| `uteamup_location_list` | Find a location when there is no single asset | `search`, `pageSize` |
| `uteamup_workorder_list` | Open work on the asset (duplicate check) | `assetGuid`, `openOnly`, `pageSize` |
| `uteamup_workorder_search` | Open work mentioning the same fault words | `searchFilter` |
| `uteamup_workorder_get` | Read one work order before changing it | `workorderGuid` |
| `uteamup_workorder_template_get_active` | Active templates that may fit the job | `page`, `pageSize` |
| `uteamup_workorder_template_list` | Find a template by name | `nameFilter`, `isActive` |
| `uteamup_workorder_template_get` | Template detail (checklists, parts, defaults) | `templateGuid` |
| `uteamup_workorder_list_preview` | Checklists a new work order will inherit | `assetGuids`, `maintenanceType` |
| `uteamup_workorder_create` | Create the work order | `title`, `description`, `startUtc`, `dueUtc`, `idempotencyKey`, `priority`, `assetGuid`, `primaryAssigneeGuid`, `isEmergency` |
| `uteamup_workorder_template_create_from_template_by_guid` | Create an open work order from a template | `templateGuid`, `overrides` |
| `uteamup_workorder_classify` | Set the EN 13306 maintenance type | `workorderGuid`, `maintenanceType` |
| `uteamup_user_search` | Find the technician by name or email | `searchFilter` |
| `uteamup_team_list` | Find a team to own the job | `page`, `pageSize` |
| `uteamup_workorder_assign` | Assign a technician | `workorderGuid`, `assigneeGuid` |
| `uteamup_checklist_list` | Find a checklist by name (use its `externalGuid`) | `nameFilter`, `pageSize` |
| `uteamup_workorder_update` | Change status, location, team, checklists, dates | `workorderGuid`, `model` |
| `uteamup_comment_create` | Add a dated note to the work order | `model.text`, `model.workorderGuid` |
| `uteamup_document_find_by_hash` | Reuse a photo or file already stored | `sha256` |
| `uteamup_document_upload_with_content` | Upload a photo or file as base64 | `fileName`, `fileContentBase64`, `contentType`, `description` |
| `uteamup_workorder_add_documents` | Attach uploaded documents to the work order | `workorderGuid`, `documentGuids` (1-50) |
| `uteamup_workorder_similar_jobs` | Past completed jobs like this one and what fixed them | `workorderGuid`, `take` |

## Workflow

1. **Check the company.** Writes go to the company the connection is signed in to. If the user
   names another company, or a tool reports no tenant or wrong tenant, call
   `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect to the right company.
   No MCP tool switches company mid-session.
2. **Read the report.** Extract: what is affected, the symptom, safety or production impact,
   who reported it, any requested assignee or deadline. Ask one short question only if the
   affected equipment or place is missing.
3. **Find the asset.** `uteamup_asset_search` with `searchFilter`. If several match, list them
   (name, serial number, location) and ask. Confirm with `uteamup_asset_get_by_guid` and note
   its location GUID. With no matching asset, find the place with `uteamup_location_list`
   (`search`) and create the work order without an asset.
4. **Check for duplicates.** `uteamup_workorder_list` with `assetGuid` and `openOnly` true. For
   location-only faults, `uteamup_workorder_search` with two or three fault words. If open work
   already covers the fault, show it and offer to add a note to it (step 10) instead of
   creating a new one.
5. **Propose priority and type.** Priority is 1 (low) to 5 (critical):
   - 5: injury risk, fire, gas, major leak, or a full production stop.
   - 4: equipment down or degrading fast, no safe workaround.
   - 3 (default): fault with a workaround; schedule normally.
   - 1-2: cosmetic or can wait for planned maintenance.
   Maintenance type for a fault is usually `CorrectiveImmediate` (fix now), `CorrectiveDeferred`
   (fix later) or `CorrectiveIncident`; use `Safety` for safety hazards. Other values:
   `PreventivePredetermined`, `PreventiveConditionBased`, `PreventiveScheduled`, `Improvement`,
   `Installation`, `Exceptional`, `Training`, `MeterReading`. Set `isEmergency` only when the
   user says it is an emergency; otherwise leave it out.
6. **Consider a template.** `uteamup_workorder_template_get_active` or
   `uteamup_workorder_template_list` with `nameFilter`. If one fits, read it with
   `uteamup_workorder_template_get`. Optionally call `uteamup_workorder_list_preview` with
   `assetGuids` and `maintenanceType` to see which checklists will attach automatically.
7. **Confirm the draft.** Show title, description, asset or location, priority, type, planned
   start and due (UTC), assignee, and template if any. Wait for a clear yes.
8. **Create once.** Generate one new GUID string as `idempotencyKey` and keep it; reuse the same
   key and identical arguments only to retry this exact request.
   - Without template: `uteamup_workorder_create` with `title`, `description`, `startUtc`,
     `dueUtc`, `idempotencyKey`, `priority`, `assetGuid`, and `primaryAssigneeGuid` if known.
   - With template: `uteamup_workorder_template_create_from_template_by_guid` with
     `templateGuid` and `overrides` (`name`, `description`, `priority`, `maintenanceType`,
     `assetGuid`, `locationGuid`, `primaryAssigneeGuid`, `startDateUtc`, `dueDateUtc`,
     `idempotencyKey`).
   Keep the returned work order GUID.
9. **Complete the setup** (each change confirmed with the user, can be combined into one
   confirmation):
   - Type: `uteamup_workorder_classify` with `workorderGuid` and `maintenanceType` (create has no
     type argument).
   - Assignee: `uteamup_user_search` with `searchFilter`, then `uteamup_workorder_assign` with
     `workorderGuid` and the user's GUID as `assigneeGuid`.
   - Location, team, category or checklists: `uteamup_workorder_update` with `workorderGuid` and
     a `model` holding only the fields to change, for example `locationGuid`, `teamGuid` (from
     `uteamup_team_list`), or `checkListGuids` (the `externalGuid` values from
     `uteamup_checklist_list`). `checkListGuids` replaces the manual checklist set, so include
     the ones already attached (read them with `uteamup_workorder_get`).
10. **Add notes.** `uteamup_comment_create` with `model` `{ "text": "...", "workorderGuid": "..." }`
    for the reporter's words, observations or photos context. Keep the description for the work
    to do; put dated observations in comments. To attach photos or files, confirm first, then
    reuse a stored file via `uteamup_document_find_by_hash` (SHA-256 of the bytes) or upload it
    with `uteamup_document_upload_with_content` (`fileName` with extension, `fileContentBase64`,
    `contentType`, optional `description`), and link it with `uteamup_workorder_add_documents`
    (`workorderGuid`, `documentGuids`). Uploading alone does not attach. Large files are better
    uploaded in the app.
11. **Help the technician (optional).** `uteamup_workorder_similar_jobs` with `workorderGuid`
    shows past fixes and parts; it uses no AI credits.
12. **Change status later.** Read with `uteamup_workorder_get`, confirm, then
    `uteamup_workorder_update` with `model` `{ "status": n }`: 0 Not started, 1 Pending,
    2 In progress, 3 On hold, 5 Cancelled. Do not complete work through this skill; completion
    needs a work report (`uteamup_workorder_complete`) and is the technician's step.
13. **Report back** in two or three lines: work order name and GUID, priority, type, assignee,
    and anything that was not done.

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids (`uteamup_checklist_get` and `uteamup_checklist_add_item` take legacy
  integer ids; do not use them).
- Before any create or update, show exactly what will change and get a clear yes. One fault
  report creates at most one work order unless the user asks for more.
- Never delete. Records are archived, never deleted; do not call `uteamup_workorder_delete`.
  To stop unwanted work, set status 5 (Cancelled) after confirmation.
- On `uteamup_workorder_update`, send only fields that change. `startDate` and `dueDate` cannot
  be cleared. Do not send `actualCost`; it is read-only.
- Respect permission errors (for example `WorkOrder.Create`, `WorkOrders.Assign`): report them;
  do not retry through other tools such as quick reports to get around them.
- If a tool is not listed or is refused on this connection, say writing needs the full UteamUP
  connection and stop after the read steps.
- Dates are UTC ISO 8601. If the user gives a local time, convert it and show both.
- Do not invent fault causes. Quote the reporter; mark your own suggestions as suggestions.
- Keep output short: no raw JSON dumps, at most about 10 rows per list.

## Not covered

- Answering or adding steps to a checklist on a specific work order is not available through
  MCP; ask the user to do it in the UteamUP app. Checklist template item tools use legacy
  integer ids, so this skill does not edit templates either.

## Examples

**"Conveyor C2 is grinding and getting hot, give it to Anna."**
1. `uteamup_asset_search` `{ "searchFilter": "C2" }` → confirm asset.
2. `uteamup_workorder_list` `{ "assetGuid": "<asset>", "openOnly": true }` → none open.
3. Propose priority 4, `CorrectiveImmediate`, due today; user says yes.
4. `uteamup_user_search` `{ "searchFilter": "Anna" }` → one match.
5. `uteamup_workorder_create` `{ "title": "Conveyor C2 grinding and overheating", "description": "...", "startUtc": "...", "dueUtc": "...", "idempotencyKey": "<new GUID>", "priority": 4, "assetGuid": "<asset>", "primaryAssigneeGuid": "<Anna>" }`
6. `uteamup_workorder_classify` `{ "workorderGuid": "<wo>", "maintenanceType": "CorrectiveImmediate" }`

**"The boiler room valve is dripping again."**
1. `uteamup_asset_search` `{ "searchFilter": "valve" }` → user picks the boiler room valve.
2. `uteamup_workorder_list` `{ "assetGuid": "<asset>", "openOnly": true }` → an open job exists.
3. Offer a note instead of a duplicate; on yes, `uteamup_comment_create` `{ "model": { "text": "Reported dripping again today.", "workorderGuid": "<wo>" } }`

**"Put the C2 job on hold, waiting for bearings."**
1. `uteamup_workorder_search` `{ "searchFilter": "C2" }` → `uteamup_workorder_get`.
2. Confirm, then `uteamup_workorder_update` `{ "workorderGuid": "<wo>", "model": { "status": 3 } }`
3. `uteamup_comment_create` with the reason "Waiting for bearings".
