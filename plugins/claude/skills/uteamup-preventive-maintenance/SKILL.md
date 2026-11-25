---
name: uteamup-preventive-maintenance
description: "Plans recurring and preventive maintenance in UteamUP: asset maintenance plans with calendar or meter-based items, work-order templates and their recurring schedules, checklists for the job, meter definitions and reading schedules, and a review of what is due, projected or overdue. Use when the user says things like: set up preventive maintenance, service this pump every 3 months, oil change every 500 hours, create a PM plan, make a work order template, schedule this inspection every spring, add a checklist to the service, what maintenance is due, what is overdue, which meter readings are late, when is the next service."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP preventive maintenance

Helps a maintenance team decide what recurring work an asset needs and set it up in UteamUP:
the job (work-order template), the steps to tick off (checklist), when it happens (maintenance
plan items or a template schedule) and, for usage-based work, the meter that drives it. It also
reviews what is coming due or overdue. Reading is free; every write is shown to the user first
and needs a clear yes.

UteamUP has two ways to repeat work. Pick one per job:

- **Asset maintenance plan** (per asset): items that fall due by calendar days and/or meter
  value, with nesting (for example a 12-month service that replaces the 3-month one) and a
  read-only due projection. Use for equipment PM.
- **Work-order template schedule** (per template): a plain calendar recurrence (daily, weekly,
  monthly, yearly, hourly) that creates a work order from the template. Use for routine work not
  driven by meters, such as a weekly site round.

`references/intervals.md` explains how intervals, triggers and recurrences are written.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | `page` |
| `uteamup_asset_search` / `uteamup_asset_get_by_guid` | Find the asset and its GUID | `searchFilter` / `guid` |
| `uteamup_asset_maintenance_plan_list` / `uteamup_asset_maintenance_plan_get` | Plans on an asset, one plan with items | `assetExternalGuid` / `planExternalGuid` |
| `uteamup_asset_maintenance_plan_create` / `uteamup_asset_maintenance_plan_update` | Create or change a plan header | `assetExternalGuid` or `planExternalGuid`, `model` |
| `uteamup_asset_maintenance_plan_delete` | Mark a plan inactive (never deleted) | `planExternalGuid` |
| `uteamup_asset_maintenance_plan_get_items` | Items with `nextDueAt`, `lastTriggeredAt` | `planExternalGuid` |
| `uteamup_asset_maintenance_plan_add_item` / `uteamup_asset_maintenance_plan_update_item` | Add or change a plan item | `planExternalGuid` or `itemExternalGuid`, `model` |
| `uteamup_asset_maintenance_plan_nest_item` | Nest a longer calendar item under a shorter one | `planExternalGuid`, `itemExternalGuid`, `model.parentItemExternalGuid` |
| `uteamup_asset_maintenance_plan_delete_item` | Remove one item line from a plan | `itemExternalGuid` |
| `uteamup_asset_maintenance_plan_template_list` / `uteamup_asset_maintenance_plan_template_get` | Reusable plan templates (versioned) | `includeHistory` / `templateExternalGuid` |
| `uteamup_asset_maintenance_plan_template_create` / `uteamup_asset_maintenance_plan_template_create_version` | New template or new version | `model` / `templateExternalGuid`, `model` |
| `uteamup_asset_maintenance_due_projection_get` | Preview due dates, no writes | `planExternalGuid`, `asOf` |
| `uteamup_upmate_maintenance_due_explain` | Plain explanation of a projection | `planGuid`, `asOfUtc` |
| `uteamup_workorder_template_list` / `uteamup_workorder_template_get` | Find or read work-order templates | `nameFilter`, `isActive`, `page`, `pageSize` / `templateGuid` |
| `uteamup_workorder_template_create` / `uteamup_workorder_template_update` | Create or change a template | `model` / `templateGuid`, `model` |
| `uteamup_workorder_template_schedule_list` | Schedules on a template, `nextCreateDate` | `templateGuid` |
| `uteamup_workorder_template_schedule_create` | Recurring creation from a template | `model` (see references) |
| `uteamup_workorder_template_run_schedule_now` | Generate one work order from a schedule now | `scheduleGuid` |
| `uteamup_workorder_template_create_from_template_by_guid` | One-off work order from a template | `templateGuid`, `overrides` |
| `uteamup_checklist_list` | Find existing checklists | `nameFilter`, `page`, `pageSize` |
| `uteamup_checklist_create` / `uteamup_checklist_update` | Create a checklist with items; replace by GUID | `model` / `externalGuid`, `model` |
| `uteamup_meterreading_get_current` | Meters on an asset, `attributeDefinitionGuid`, current value | `assetGuid` |
| `uteamup_asset_type_meter_list_definitions` / `uteamup_asset_type_meter_add_definition` | Meters defined on an asset type | `assetTypeGuid`, `name`, `unit` |
| `uteamup_meterreading_record` | Record a reading (also a plan baseline) | `assetGuid`, `request` |
| `uteamup_meterschedule_create_by_guid` | Require readings on a cadence | `assetGuid`, `attributeDefinitionGuid`, `intervalSeconds`, `recurrenceType` |
| `uteamup_meterschedule_get_overdue` / `uteamup_meterschedule_compliance_summary` | Late readings, compliance | none / `assetGuid` |
| `uteamup_workorder_list` / `uteamup_workorder_list_by_type` | Open work for an asset; preventive work in a date range | `assetGuid`, `openOnly` / `maintenanceTypeCategory`, `dateFrom`, `dateTo` |
| `uteamup_asset_maintenance_history` | Past work on an asset | `assetGuid`, `page`, `pageSize` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a
   tool reports no tenant or the wrong one, show the list and ask which company to use.
2. **Asset.** `uteamup_asset_search` with `searchFilter` (name or serial number). If several match,
   ask which one. Keep the asset `externalGuid`.
3. **What exists.** `uteamup_asset_maintenance_plan_list` for the asset, and
   `uteamup_workorder_template_list` with `nameFilter` for a matching job. Extend an existing plan
   or template instead of creating a duplicate.
4. **The job (template).** If no template fits, draft one for `uteamup_workorder_template_create`:
   `name`, `description`, `maintenanceType` (10 = PreventivePredetermined, 11 =
   PreventiveConditionBased, 12 = PreventiveScheduled), `estimatedDuration` (`"hh:mm:ss"`),
   `assetGuids`, and optional `locationGuid`, `teamGuid`, `checkListGuids`, `partGuids`,
   `toolGuids`. To change one, `uteamup_workorder_template_get` first and send the full model to
   `uteamup_workorder_template_update`.
5. **Checklist (optional).** Look first with `uteamup_checklist_list`. To create, send all steps
   in one `uteamup_checklist_create` call: `name`, `items` (`content`, `order`, `itemType` 0
   Checkbox, 1 PassFail, 2 Measurement with `unitOfMeasure`/`minValue`/`maxValue`, 3 Text, 4
   SingleSelect with `options`, 5 Photo, 6 Signature; `isRequired`), optional
   `workorderMaintenanceTypes`. Link it to the template through `checkListGuids`.
6. **When it happens.**
   - Plan route: `uteamup_asset_maintenance_plan_create` (or start from a reusable plan template
     via `model.templateExternalGuid`), then one `uteamup_asset_maintenance_plan_add_item` per
     interval with `name`, `triggerType`, `frequencyPreset` or `calendarIntervalDays`, or
     `meterIntervalValue` + `meterAttributeDefinitionExternalGuid`, and
     `workorderTemplateExternalGuid` pointing at the job.
   - Schedule route: `uteamup_workorder_template_schedule_create` with `workorderTemplateGuid`,
     `name`, `recurrenceType`, `recurrenceInterval`, `startDate` and the fields that apply.
7. **Meters (usage-based items).** Get the meter GUID from `uteamup_meterreading_get_current`
   (`attributeDefinitionGuid`). If the asset type has no meter, the type needs one first
   (`uteamup_asset_type_meter_add_definition`; it affects every asset of that type, so say so).
   Without recent readings the projection reports `NotEnoughData`; offer
   `uteamup_meterreading_record` or a `uteamup_meterschedule_create_by_guid` reading cadence.
8. **Check the result.** Call `uteamup_asset_maintenance_due_projection_get` and show each item:
   `name`, `state`, `dueAt`, `dueSource`, `reason`, `confidence`. For templates,
   `uteamup_workorder_template_schedule_list` shows `nextCreateDate`.
9. **Review due and overdue.** For one asset: plan items (`nextDueAt`), the projection, and
   `uteamup_workorder_list` with `assetGuid` and `openOnly: true`. Across the company:
   `uteamup_workorder_list_by_type` with `maintenanceTypeCategory: 1` (Preventive) and a date
   window, plus `uteamup_meterschedule_get_overdue` for late readings. There is no single
   company-wide "overdue PM" tool; say which sources you combined.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids. Avoid `uteamup_checklist_get`, `uteamup_checklist_add_item`,
  `uteamup_checklist_update_item`, `uteamup_checklist_delete_item` and `uteamup_checklist_delete`:
  they take integer ids. Change a checklist with `uteamup_checklist_update` (by `externalGuid`,
  sending the complete ordered item list).
- Before any create, update or deactivate, show the user exactly what will change (asset, plan,
  intervals, template, start date) and get a clear yes.
- Records are archived, never deleted. Retire a plan with `uteamup_asset_maintenance_plan_delete`
  (it only marks it inactive). Retire a template with `uteamup_workorder_template_update` and
  `isActive: false`; do not use `uteamup_workorder_template_delete`, which deletes permanently.
- Do not call `uteamup_workorder_template_run_schedule_now` or create work orders unless the user
  asks for work to be created now.
- Template schedules are limited by plan quota and a per-template cap. On `invalid_state`, report
  the count and maximum from the message; do not retry.
- `uteamup_workorder_template_analyze` spends AI credits. Call
  `uteamup_workorder_template_analyze_preview` first and get a yes on the quoted cost.
- Respect permission errors (for example MaintenancePlan.Create, WorkOrder.Template.Create):
  report them and stop; do not try another tool to get around them.
- Keep results short: use `page`/`pageSize` and filters; summarise as a table.
- If a write tool is unavailable (read-only connection), explain that setting up maintenance needs
  the full UteamUP connection.

## Examples

**"Service pump P-101 every 3 months and do a full overhaul every year."**
`uteamup_asset_search` → `uteamup_asset_maintenance_plan_list` → `uteamup_workorder_template_list`
(find or draft "Pump quarterly service" and "Pump annual overhaul") → confirm →
`uteamup_asset_maintenance_plan_create` (`nestingPolicy: 1` so the overhaul replaces the
quarterly service when both are due) → `uteamup_asset_maintenance_plan_add_item` twice
(`frequencyPreset: 3` and `5`) → `uteamup_asset_maintenance_plan_nest_item` (the annual item as
`itemExternalGuid`, the quarterly item as `parentItemExternalGuid`; the child must be the longer
interval) → `uteamup_asset_maintenance_due_projection_get`.

**"Change the oil on the loader every 500 engine hours."**
`uteamup_asset_search` → `uteamup_meterreading_get_current` (engine-hours meter GUID) → confirm →
plan create or reuse → `uteamup_asset_maintenance_plan_add_item` with `triggerType: 1`,
`meterIntervalValue: 500`, `meterAttributeDefinitionExternalGuid` → projection; if
`NotEnoughData`, offer to record a reading.

**"What preventive maintenance is overdue this month?"**
`uteamup_workorder_list_by_type` (`maintenanceTypeCategory: 1`, `dateFrom`/`dateTo`) →
`uteamup_meterschedule_get_overdue` → short table of open preventive work and late readings.
