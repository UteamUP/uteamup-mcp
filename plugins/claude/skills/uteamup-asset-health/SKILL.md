---
name: uteamup-asset-health
description: "Gives a read-only condition overview of one asset or the whole site in UteamUP: operational state and lifecycle stage, availability, recent maintenance, open and past failures with statistics, readiness holds and damage, inspection health score, meter compliance, and calibrations and certifications that are overdue or due soon. Use when the user asks things like: how is pump P-204 doing, is the compressor running, give me a health check on line 3, what failed on this machine, what is broken right now, which assets are on hold, what calibrations are overdue, which certificates expire this month, is this asset fit for use, what happened around last week's breakdown."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP asset health

Answers "how is this asset doing?" from UteamUP records only, without changing anything. It
gathers the asset's state, its failure and maintenance record, anything that blocks its use, and
compliance items that are due, then gives a short verdict with the evidence behind it. When the
user wants to act on what was found, hand off: work orders to `uteamup-workorder-triage`, meter
readings to `uteamup-meter-readings`, calibration and certification records to
`uteamup-calibration-and-certification`, maintenance plans to `uteamup-preventive-maintenance`
(each if available).

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`). Every tool here only reads.

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_asset_search` | Find the asset by name or serial number | `searchFilter` |
| `uteamup_asset_get_by_guid` | Asset details (type, location, dates) | `guid` |
| `uteamup_asset_state_get` | Operational state, lifecycle stage, lifespan used | `assetGuid` |
| `uteamup_asset_state_history` | Operational state changes over time | `assetGuid` |
| `uteamup_asset_state_availability` | Availability over a window | `assetGuid`, `from`, `to` |
| `uteamup_asset_maintenance_history` | Completed work orders on the asset | `assetGuid`, `page`, `pageSize` |
| `uteamup_workorder_list` | Open work orders on the asset | `assetGuid`, `openOnly`, `page`, `pageSize` |
| `uteamup_assetfailure_get_by_asset` | All failures of the asset | `assetGuid` |
| `uteamup_assetfailure_get_statistics` | Failure count, MTBF, downtime, cost | `assetGuid` |
| `uteamup_assetfailure_get_open` | Unresolved failures, whole company | none |
| `uteamup_assetfailure_get_by_severity` | Failures of one severity | `severity` (Critical, High, Medium, Low) |
| `uteamup_assetfailure_get` | One failure in full | `failureGuid` |
| `uteamup_asset_failure_evidence_pack` | Meters, IoT alerts, changes and work around a failure | `failureGuid`, `hoursBefore`, `hoursAfter` |
| `uteamup_assetreadiness_get_holds` | Holds that block use (maintenance, damage, compliance, …) | `assetGuid` |
| `uteamup_assetreadiness_get_damage` | Open and past damage cases | `assetGuid` |
| `uteamup_inspection_asset_healthscore` | Health score from inspection rounds and anomalies | `assetGuid` |
| `uteamup_inspection_asset_health_summary` | Inspection health across all assets | none |
| `uteamup_meterreading_get_current` | Latest value of each meter | `assetGuid` |
| `uteamup_meterschedule_compliance_summary` | Meter readings on time or overdue | `assetGuid` (optional) |
| `uteamup_assetcalibration_get_by_asset` | Calibrations of the asset, due dates, results | `assetGuid` |
| `uteamup_assetcalibration_get_overdue` / `uteamup_assetcalibration_get_due_soon` | Calibrations overdue / due within N days | none / `days` |
| `uteamup_assetcertification_get_by_asset_guid` | Certifications of the asset | `assetGuid` |
| `uteamup_assetcertification_get_expired` / `uteamup_assetcertification_get_expiring_soon` | Certifications expired / expiring within N days | none / `days` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use.
2. **Scope.** One asset ("how is pump P-204") or the whole company ("what is broken right now").
   For one asset, `uteamup_asset_search`, confirm the match if more than one, keep the GUID.
3. **State first.** `uteamup_asset_state_get`. Report the operational state (Online, Offline,
   Standby, UnderMaintenance, Degraded, Lost, Stolen, InTransit, InStorage), the lifecycle stage
   and the lifespan block (age, percent used, past end of life). `Unknown` means the state was
   never set, not that the asset is down. For "how often was it down", use
   `uteamup_asset_state_availability` with a UTC `from`/`to` window (default: last 30 days) and
   `uteamup_asset_state_history` for the changes.
4. **What blocks use.** `uteamup_assetreadiness_get_holds` and `uteamup_assetreadiness_get_damage`.
   An active hold means the asset must not be used or rented until it is released, whatever its
   operational state says.
5. **Failures.** `uteamup_assetfailure_get_by_asset` and `uteamup_assetfailure_get_statistics`.
   List open failures first (severity, date, description), then the trend (count, mean time
   between failures, downtime, cost). For one failure the user asks about, `uteamup_assetfailure_get`
   and, for "what happened around it", `uteamup_asset_failure_evidence_pack` (`hoursBefore` 1-168,
   default 24; `hoursAfter` 1-168, default 6). Sections the user may not see come back marked
   with the reason (permission, feature, noData); say so instead of guessing.
6. **Maintenance.** `uteamup_workorder_list` (`assetGuid`, `openOnly: true`) for open work and
   `uteamup_asset_maintenance_history` (`pageSize` 5-10) for the last completed jobs. Note when the
   last preventive job was done.
7. **Condition signals.** `uteamup_meterreading_get_current` (latest meter values),
   `uteamup_meterschedule_compliance_summary` (`assetGuid`) for late readings, and, when the site
   uses inspection rounds, `uteamup_inspection_asset_healthscore`.
8. **Compliance.** `uteamup_assetcalibration_get_by_asset` and
   `uteamup_assetcertification_get_by_asset_guid`. Flag anything overdue (`isOverdue`,
   `daysUntilDue` below 0), failed (`calibrationResult: Fail`) or expired/revoked.
9. **Company-wide questions.** Use the list tools instead of looping over assets:
   `uteamup_assetfailure_get_open` (or `uteamup_assetfailure_get_by_severity` with `Critical`),
   `uteamup_assetcalibration_get_overdue`, `uteamup_assetcalibration_get_due_soon` (`days`, default
   30), `uteamup_assetcertification_get_expired`, `uteamup_assetcertification_get_expiring_soon`
   (`days`), `uteamup_inspection_asset_health_summary`. Group by asset and sort by urgency.
10. **Verdict.** Start with one line: Fit for use / Use with caution / Not fit for use, and why.
    Then short sections: State, Blocks, Failures, Maintenance, Compliance. Cite dates and GUIDs of
    the records you relied on. Say which checks could not be made (permission, feature, no data).
    End with suggested next steps and the skill that handles each; do not perform them.

## Rules

- This skill only reads. Do not call create, update, resolve, release, archive or delete tools.
  If the user wants a change, hand off as described above and say a write needs the full
  UteamUP connection.
- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids (use `uteamup_assetcertification_get_by_asset_guid`, not the integer-id variant).
- Base every statement on a tool result. Do not infer a failure cause or predict remaining life
  beyond what the records say; label any judgement as your assessment.
- Respect permission errors (Asset.View, AssetFailure.View, AssetCalibration.View,
  OperationalRoute.Analytics, IOT.View, …): report which part is missing and continue with the
  rest; do not try another tool to get around them.
- Keep results short: use `page`/`pageSize` and day windows; summarise lists (counts, worst
  items, dates) instead of dumping records.

## Examples

**"How is compressor C-3 doing?"**
`uteamup_asset_search` → `uteamup_asset_state_get` → `uteamup_assetreadiness_get_holds` →
`uteamup_assetfailure_get_by_asset` → `uteamup_assetfailure_get_statistics` →
`uteamup_workorder_list` (`openOnly: true`) → `uteamup_asset_maintenance_history` →
`uteamup_assetcalibration_get_by_asset` → `uteamup_assetcertification_get_by_asset_guid` → verdict.

**"What is broken right now and what calibrations are overdue?"**
`uteamup_assetfailure_get_open` → `uteamup_assetcalibration_get_overdue` → grouped summary.

**"What happened before conveyor 7 stopped on Tuesday?"**
`uteamup_asset_search` → `uteamup_assetfailure_get_by_asset` (Tuesday's failure) →
`uteamup_asset_failure_evidence_pack` (`hoursBefore: 48`) → timeline of readings, alerts,
changes and the last preventive work order.
