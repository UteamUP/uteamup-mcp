---
name: uteamup-job-resource-usage
description: "Reviews and corrects the resources UteamUP work orders used through MCP: tool usage (which tool, by whom, how long, rental rate and cost) and energy or utility consumption per job, with work order lookups and work order number prefixes; also looks up fleet inspection templates and the NFC, QR and barcode tags on locations and checkpoints used on inspection rounds. Use when the user says things like: which tools were used on this job, fix the tool time on work order X, the drill was returned at 15:00 not 17:00, how much electricity did this repair use, correct the energy recorded on the job, what tool rental cost went to jobs this month, which inspection checklist should I use for the van, where does this NFC tag belong, which checkpoints have tags, what does the work order number HVAC-2411-0042 mean."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP job resource usage

Tool time and energy consumption are recorded against work orders so job cost and
sustainability reports are right. Through MCP this skill finds those records, reads them and
corrects wrong values after confirmation. New tool usage or energy usage records are created on
the job in the UteamUP web or mobile app; MCP has no create tool for them. The skill also looks up
reference data used in the field: fleet inspection templates (checklists), the scan tags on
locations, route stops and patrol checkpoints, and the work order number prefixes.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm the active company | none |
| `uteamup_workorder_search` | Find a work order by title or description words | `searchFilter` |
| `uteamup_workorder_list` | Find by name, ticket ID or GUID, or by asset | `search`, `assetGuid`, `openOnly`, `page`, `pageSize` |
| `uteamup_workorder_get` | Read one work order | `workorderGuid` |
| `uteamup_workorder_prefix_list` / `uteamup_workorder_prefix_get` | Work order number series and their layout | `includeInactive` / `prefixGuid` |
| `uteamup_workorder_tool_usage_list` | Tool usage records, newest first | `page`, `pageSize` (max 100) |
| `uteamup_workorder_tool_usage_get` | One tool usage record | `usageGuid` |
| `uteamup_workorder_tool_usage_update` | Correct a tool usage record; every field replaced | `usageGuid`, `workorderGuid`, `toolGuid`, `startTime`, `endTime`, `durationMinutes`, `rateType`, `rentalRate`, `notes`, `userId` |
| `uteamup_tool_list` | Find a tool's GUID by name | `nameFilter`, `pageNumber`, `pageSize` |
| `uteamup_workorder_energy_usage_list` | Energy and utility use on work orders, newest first | `page`, `pageSize` (max 100) |
| `uteamup_workorder_energy_usage_get` | One energy usage record | `usageGuid` |
| `uteamup_workorder_energy_usage_update` | Correct an energy usage record; every field replaced | `usageGuid`, `workorderGuid`, `utilityType`, `consumption`, `assetGuid`, `unit`, `costPerUnit`, `totalCost`, `notes` |
| `uteamup_inspection_template_list` / `uteamup_inspection_template_get` | Fleet inspection checklists and their items | none / `templateGuid` |
| `uteamup_location_nfc_tag_list` | Active NFC, QR and barcode tags on locations, route stops, checkpoints | none |
| `uteamup_location_nfc_tag_get_by_tag_id` | Where a scanned tag value belongs (does not record a scan) | `tagId` |

Energy `utilityType` values: `electricity`, `naturalGas`, `water`, `steam`, `compressedAir`,
`diesel`, `propane`, `fuelOil`.

## Workflow

1. **Company.** Call `uteamup_tenant_get_my_tenants` if unsure. If a tool reports no tenant or the
   wrong one, list the companies and ask which to use. Energy usage also needs the
   Sustainability feature; inspection templates need the Fleet Inspections feature.
2. **Find the job.** `uteamup_workorder_list` with `search` (name or ticket ID such as
   `HVAC-2411-0042`) or `uteamup_workorder_search` with `searchFilter`. Confirm with
   `uteamup_workorder_get` and keep its `workorderGuid`.
3. **Tool usage on a job.** `uteamup_workorder_tool_usage_list` has no work order filter: page
   through it (newest first, `pageSize` 50–100) and keep the records whose `workorderGuid`
   matches. Report tool name, user, start, end, duration, rate and total cost. Stop paging once
   the records are older than the job.
4. **Correct tool usage.** Read the record with `uteamup_workorder_tool_usage_get`. Show old and
   new values and get a yes. Then call `uteamup_workorder_tool_usage_update` with every field:
   take `workorderGuid`, `toolGuid`, `startTime`, `endTime`, `durationMinutes`, `rateType`,
   `rentalRate`, `notes` and `userId` from the record and change only what the user asked. A
   field left out is cleared (for example omitting `userId` leaves the record unassigned). To
   switch to a different tool, find its GUID with `uteamup_tool_list` (`nameFilter`). Total cost
   is recalculated from duration, rate and rate type; do not compute it yourself.
5. **Energy on a job.** Page `uteamup_workorder_energy_usage_list` and keep records whose
   `workorderGuid` matches. Report utility type, consumption with unit, asset and cost.
6. **Correct energy usage.** Read with `uteamup_workorder_energy_usage_get`, show old and new
   values, get a yes, then `uteamup_workorder_energy_usage_update` sending every field from the
   record with only the requested change (`workorderGuid`, `utilityType`, `consumption`, and the
   current `assetGuid`, `unit`, `costPerUnit`, `totalCost`, `notes`). Omitting `assetGuid` removes
   the asset link.
7. **New usage.** If nothing is recorded yet and the user wants to add tool time or energy, say
   that adding a new record is done on the work order in the web or mobile app.
8. **Cost summaries.** For "tool rental cost on jobs this month", page the tool usage list to the
   start of the period and total `totalCost` per tool or per work order; say if the total is
   partial.
9. **Inspection references.** `uteamup_inspection_template_list` shows the vehicle inspection
   checklists (pre-trip, post-trip, custom and system). Read the items of one with
   `uteamup_inspection_template_get`. Starting or recording an inspection is done in the app.
10. **Scan tags.** `uteamup_location_nfc_tag_list` shows which locations, route stops and
    checkpoints carry a tag. For a value the user scanned, call
    `uteamup_location_nfc_tag_get_by_tag_id` with `tagId`; it identifies the place and does not
    record a check-in.
11. **Ticket numbers.** `uteamup_workorder_prefix_list` explains the number series (prefix,
    maintenance type, date parts, digits, next number). Listing creates the standard defaults if
    the company has none yet, as the web app does; tell the user if that happened.

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs; never guess one or use an
  integer id. Do not use tools that take integer tool or work order ids; `userId` on tool usage
  is copied from the existing record, never typed in.
- Make sure the right company is active.
- Before any update, show exactly what will change and get a clear yes. Updates replace every
  field, so always start from the current record. Records are archived, never deleted.
- Never invent usage. Times are UTC ISO 8601; convert local times the user gives and show both.
- Respect permission errors (`WorkorderToolUsage.View`, `WorkorderToolUsage.Update`,
  `WorkorderEnergyUsage.Read`, `WorkorderEnergyUsage.Update`, `InspectionTemplate.Read`,
  `Asset.View`): report them; do not retry with other tools.
- Keep results short: page lists and summarise, at most about 10 rows per answer.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.

## Examples

**"The drill on work order 'Replace roof fan' was returned at 15:00, not 17:00."**
`uteamup_workorder_list` (`search: "Replace roof fan"`) → `uteamup_workorder_tool_usage_list`
(match `workorderGuid`) → `uteamup_workorder_tool_usage_get` → confirm →
`uteamup_workorder_tool_usage_update` (all current fields, new `endTime` and `durationMinutes`).

**"How much electricity did the compressor overhaul use?"**
`uteamup_workorder_search` (`searchFilter: "compressor overhaul"`) →
`uteamup_workorder_energy_usage_list` (match `workorderGuid`) → total consumption and cost.

**"I scanned tag 04A2B9C1 — where is it, and which checklist do I use for the van?"**
`uteamup_location_nfc_tag_get_by_tag_id` (`tagId: "04A2B9C1"`) →
`uteamup_inspection_template_list` → `uteamup_inspection_template_get` for the pre-trip template.
