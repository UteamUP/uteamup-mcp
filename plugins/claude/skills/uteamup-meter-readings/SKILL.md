---
name: uteamup-meter-readings
description: "Records and reviews meter readings in UteamUP (odometer, run hours, temperature, pressure, counters): finds the asset and its meter, records or corrects a reading, registers a replaced meter, reads history, sets up meter reading schedules, lists overdue readings and compliance, and creates or records meter-reading work orders. Use when the user says things like: log 45230 km on van 12, record the run hours for the generator, what is the current reading on pump P-204, show the meter history, that reading was wrong, we swapped the hour meter, which meters are overdue, read this meter every Monday, add an odometer to this asset type."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP meter readings

Keeps an asset's meters correct and on schedule. A meter is an attribute of the asset's type
(`attributeDefinitionGuid`) marked as a meter; readings are stored per asset and per meter, and
they drive usage-based maintenance. Reading is free; every reading, correction, schedule or meter
definition change is shown to the user first and needs a clear yes. Meter-based maintenance plans
are a separate step (the `uteamup-preventive-maintenance` skill, if available); statutory odometer
readings for road vehicles belong to the `uteamup-fleet-management` skill.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_asset_search` | Find the asset by name or serial number | `searchFilter` |
| `uteamup_asset_get_by_guid` | Read one asset (type, location) | `guid` |
| `uteamup_meterreading_get_current` | Meters on the asset, their `attributeDefinitionGuid` and latest value | `assetGuid` |
| `uteamup_meterreading_get_attributes` | Every attribute (static and meter) of the asset | `assetGuid` |
| `uteamup_meterreading_get_history` | History of one meter | `assetGuid`, `attributeDefinitionGuid`, `page`, `pageSize`, `from`, `to` |
| `uteamup_meterreading_list` | Readings across all assets, newest first | `page`, `pageSize`, `from`, `to`, `assetGuid`, `attributeDefinitionGuid`, `source`, `quality`, `search` |
| `uteamup_meterreading_get` | One reading with who/where/linked work order | `readingGuid` |
| `uteamup_meterreading_record` | Record a manual reading | `assetGuid`, `request` |
| `uteamup_meterreading_correct` | Correct a wrong reading (new linked row) | `assetGuid`, `readingGuid`, `request` (`correctedValue`, `notes`) |
| `uteamup_meterreading_replace_meter` | Register a new physical meter or odometer | `assetGuid`, `attributeDefinitionGuid`, `request` (`initialValue`, `notes`) |
| `uteamup_meterreading_ocr` | Suggest a value from a photo of the meter (uses AI credits, saves nothing) | `assetGuid`, `attributeDefinitionGuid`, `photoBase64` |
| `uteamup_meterschedule_get_overdue` | Overdue meter reading schedules, whole company | none |
| `uteamup_meterschedule_compliance_summary` | Compliant vs overdue, per schedule | `assetGuid` (optional) |
| `uteamup_meterschedule_create_by_guid` | Require readings on a cadence | `assetGuid`, `attributeDefinitionGuid`, `intervalSeconds`, `recurrenceType`, … |
| `uteamup_meterschedule_get_open_workorders` | Open meter-reading work orders for an asset | `assetGuid` |
| `uteamup_meterschedule_create_workorder` | Create a work order for a schedule now | `scheduleGuid`, `useScheduleTemplate`, `workorderTemplateGuid` |
| `uteamup_meterschedule_record_workorder` | Record a reading inside a work order | `workorderGuid`, `attributeDefinitionGuid`, `readingValue`, `notes` |
| `uteamup_asset_type_meter_list_definitions` | Meters defined on an asset type | `assetTypeGuid` |
| `uteamup_asset_type_meter_add_definition` | Add a meter to an asset type | `assetTypeGuid`, `name`, `unit`, `alertThresholdMin`, `alertThresholdMax`, `expectedReadingIntervalSeconds` |
| `uteamup_asset_type_meter_toggle` | Turn metering on or off for an asset type | `assetTypeGuid`, `isMetered` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use.
2. **Asset.** `uteamup_asset_search` with the name, number or serial the user gave. If several
   match, show them (name, location, serial) and ask which one. Keep the asset GUID.
3. **Meter.** `uteamup_meterreading_get_current` lists the asset's meters with name, unit,
   `attributeDefinitionGuid` and latest value. Pick the meter the user means; if it is unclear
   (for example two hour meters), ask. If the asset has no meter, see step 8.
4. **Record a reading.**
   - Check the value against the latest one. A value lower than the last reading on a counting
     meter (odometer, hours, cycles) is stored as Quarantined (a backwards jump). Ask whether the
     meter was replaced (step 6) or the number is a typo before recording.
   - Show: asset, meter, value with unit, time (now unless the user gave one), notes. On yes, call
     `uteamup_meterreading_record` with `request`: `attributeDefinitionGuid`, `readingValue`,
     optional `readingTimestamp` (UTC ISO 8601), `notes`.
   - Special meter kinds: Photo, Signature, Audio or Video meters need `request.documentGuid`
     (upload first with `uteamup_document_upload_with_content`); an NfcCheck meter takes
     `request.scannedNfcValue` exactly as read; when the asset type requires a location, pass
     `request.latitude` and `request.longitude`. RecordedBy and Location attributes are never
     recorded directly.
   - When the reading is part of a work order, use `uteamup_meterschedule_record_workorder`
     (`workorderGuid`, `attributeDefinitionGuid`, `readingValue`, `notes`) instead, so the work
     order and any matching schedule are satisfied. Find the work order with
     `uteamup_meterschedule_get_open_workorders` (`assetGuid`).
5. **From a photo.** If the user sends a picture of the display, tell them it uses AI credits and
   ask first. Then `uteamup_meterreading_ocr`; show the suggested value, confidence and the text it
   saw. Nothing is saved: record only after the user confirms or corrects the number (step 4).
6. **Fix mistakes.**
   - Wrong value: find it with `uteamup_meterreading_get_history` or `uteamup_meterreading_list`
     (`assetGuid`, `attributeDefinitionGuid`), confirm, then `uteamup_meterreading_correct` with
     `readingGuid` and `request.correctedValue`. The original stays, flagged Corrected.
   - New physical meter or odometer: `uteamup_meterreading_replace_meter` with
     `request.initialValue` (what the new meter shows, default 0). Later lower readings are then
     accepted and distance totals continue across the swap.
7. **Overdue and compliance.** `uteamup_meterschedule_get_overdue` for the company, or
   `uteamup_meterschedule_compliance_summary` (`assetGuid` optional) for compliant vs overdue per
   schedule. Summarise by asset and how late each is. Offer to record the missing readings or to
   create a work order for a schedule with `uteamup_meterschedule_create_workorder` (`scheduleGuid`;
   `useScheduleTemplate: true` seeds from the schedule's template, or pass `workorderTemplateGuid`).
8. **Schedules.** To require readings on a cadence, confirm then call
   `uteamup_meterschedule_create_by_guid`:
   - Sliding interval: `recurrenceType: "none"` and `intervalSeconds` (minimum 300; one day is
     86400, one week 604800).
   - Calendar: `recurrenceType` `weekly` with `daysOfWeek` (0 = Sunday … 6 = Saturday), or
     `monthly`/`yearly` with `dayOfMonthMode` (`specificDay`, `firstDay`, `lastDay`,
     `firstWorkday`, `lastWorkday`), `dayOfMonth`, and for yearly `monthOfYear`. Still pass
     `intervalSeconds` (for example 86400).
   - Optional `scheduleLabel`, `preferredTimeOfDay` (`"08:00:00"`), `timeZoneId` (IANA, e.g.
     `Europe/London`).
   There is no MCP tool to list, change or stop an existing schedule; check
   `uteamup_meterschedule_compliance_summary` first so you do not add a duplicate, and ask the user
   to change or stop schedules in the web app.
9. **Meters on the asset type.** If the asset has no suitable meter, read the type's meters with
   `uteamup_asset_type_meter_list_definitions` (`assetTypeGuid` from the asset). Adding one with
   `uteamup_asset_type_meter_add_definition` (`name`, `unit`, optional `alertThresholdMin`,
   `alertThresholdMax`, `expectedReadingIntervalSeconds`) changes every asset of that type; say so
   and get a yes. If the type is not metered, `uteamup_asset_type_meter_toggle` with
   `isMetered: true` first.
10. **Report.** Asset, meter, value and unit, time, quality (Normal, Estimated, Quarantined,
    Corrected) and anything skipped.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids.
- Before any reading, correction, meter replacement, schedule, work order or type change, show the
  user what will happen and get a clear yes. A batch of readings may be confirmed as one list.
- Never record a reading the user did not give or confirm. Do not round or convert units silently;
  if the user's unit differs from the meter's unit, convert only after saying so.
- Never "fix" a reading by recording a new one on top; use `uteamup_meterreading_correct`.
- Records are archived, never deleted. Do not remove a meter definition from an asset type
  (`uteamup_asset_type_meter_remove_definition`) unless the user explicitly asks; it affects every
  asset of that type.
- The OCR tool spends AI credits; ask before each use and report `creditsCharged` and `remaining`.
- Respect permission errors (MeterReading.Read, MeterReading.Create, MeterReading.Update): report
  them and stop; do not try another tool to get around them.
- Keep results short: use `page`/`pageSize` and `from`/`to`; summarise history (first, last,
  min, max, gaps) instead of dumping rows.
- If a write tool is unavailable (read-only connection), explain that recording readings needs the
  full UteamUP connection.

## Examples

**"Log 45,230 km on van FL-12."**
`uteamup_asset_search` → `uteamup_meterreading_get_current` (odometer GUID, last value 44,980) →
confirm → `uteamup_meterreading_record` (`request.attributeDefinitionGuid`,
`request.readingValue: 45230`).

**"The 1,250 hours I entered yesterday on generator G2 should be 1,205."**
`uteamup_asset_search` → `uteamup_meterreading_get_current` →
`uteamup_meterreading_get_history` (`from` yesterday) → confirm →
`uteamup_meterreading_correct` (`readingGuid`, `request.correctedValue: 1205`).

**"Which meter readings are overdue, and read the boiler pressure every Monday at 8."**
`uteamup_meterschedule_get_overdue` → summary → `uteamup_asset_search` (boiler) →
`uteamup_meterreading_get_current` → `uteamup_meterschedule_compliance_summary` (`assetGuid`) →
confirm → `uteamup_meterschedule_create_by_guid` (`recurrenceType: "weekly"`, `daysOfWeek: [1]`,
`preferredTimeOfDay: "08:00:00"`, `intervalSeconds: 604800`).
