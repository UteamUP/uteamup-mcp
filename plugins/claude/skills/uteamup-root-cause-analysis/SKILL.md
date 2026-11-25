---
name: uteamup-root-cause-analysis
description: Investigates equipment failures and runs root cause analyses (RCA) in UteamUP through the UteamUP MCP server. Gathers an asset's failure history, statistics, evidence around a failure and matching failure codes, ranks bad actors and recurrence, records and classifies failures, runs a 5 Whys RCA (manually or from an AI draft) with steps, corrective, preventive and detective actions and linked assets, completes it with the confirmed root cause, and reviews whether the action stopped the failures. Also reads reliability forecasts and review-only strategy proposals. Use when the user says things like "why does pump 3 keep failing", "start an RCA on the conveyor gearbox", "log a breakdown on compressor 2", "what failed most this year", "show the failure history of this asset", "what happened around yesterday's trip", "draft a 5 whys for the boiler", "add a corrective action to the RCA", "close the RCA, root cause was a worn coupling", or "did the fix work".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP root cause analysis

Find out why something failed and make sure it does not happen again. The skill reads the
failure record and history first, then runs a structured 5 Whys RCA in UteamUP, records the
agreed actions, and later checks whether the failures actually stopped. Facts come from the
tools; causes are only recorded when the user confirms them.

Needs the full UteamUP connection (`/mcp`). On the read-only connection only asset and work
order lookups work; explain that failure records, RCA and reliability tools need the full
connection and the user's `AssetFailure.*`, `RootCauseAnalysis.*` and `Asset.View` permissions.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_asset_search` / `uteamup_asset_get_by_guid` | Find and confirm the asset | `searchFilter` / `guid` |
| `uteamup_assetfailure_get_by_asset` | Failure history of an asset | `assetGuid` |
| `uteamup_assetfailure_get_open` | All open failures | (none) |
| `uteamup_assetfailure_get` | One failure record | `failureGuid` |
| `uteamup_assetfailure_get_statistics` | Counts, MTBF-style stats for an asset | `assetGuid` |
| `uteamup_asset_failure_evidence_pack` | Sensors, alarms, PM and changes around a failure | `failureGuid`, `hoursBefore`, `hoursAfter` |
| `uteamup_assetfailure_create` | Record a failure | `model` |
| `uteamup_assetfailure_update` | Change a failure record (full model) | `failureGuid`, `model` |
| `uteamup_assetfailure_classify` | EN 13306 failure classification | `failureGuid`, `failureClassification` |
| `uteamup_assetfailure_resolve` | Record the fix and root cause on the failure | `model` |
| `uteamup_failure_code_search` / `uteamup_failure_code_get_most_common` | Matching failure codes, most common codes | `searchTerm` / `count` |
| `uteamup_workorder_list` / `uteamup_workorder_get` | Work history on the asset | `assetGuid`, `pageSize` / `workorderGuid` |
| `uteamup_workorder_similar_jobs` | Past jobs like this one and what fixed them | `workorderGuid`, `take` |
| `uteamup_reliability_risk_get` | Ranked bad actors (failures, downtime, recurrence) | `assetGuid`, `fromUtc`, `toUtc`, `limit` |
| `uteamup_reliability_recurrence_get` | Faults per 1000 km or 100 engine hours | `fromUtc`, `toUtc`, `assetGuid`, `exposureBasis` |
| `uteamup_analytics_mean_time_to_first_failure` | Time from installation to first failure | (none) |
| `uteamup_rca_list` / `uteamup_rca_get` | Existing RCAs | `status` / `rcaGuid` |
| `uteamup_rca_create` | Start an RCA (Draft) | `model` |
| `uteamup_asset_rca_draft` | AI 5 Whys draft from the asset's history (AI credits) | `assetGuid`, `monthsBack`, `focus` |
| `uteamup_asset_rca_create_from_draft` | Save the reviewed draft as an RCA | `assetGuid`, `request` |
| `uteamup_rca_add_step` | Add a "why" question/answer | `rcaGuid`, `question`, `answer`, `evidenceNotes` |
| `uteamup_rca_add_action` | Corrective, Preventive or Detective action | `rcaGuid`, `actionType`, `description`, `assignedToUserGuid`, `dueDate` |
| `uteamup_rca_link_assets` | Link affected assets | `rcaGuid`, `assetGuids` |
| `uteamup_rca_complete` | Complete with the confirmed root cause | `rcaGuid`, `rootCause` |
| `uteamup_reliability_action_recurrence_review` | Did failures drop after the action? | `rcaGuid`, `actionGuid`, `assetGuid`, `baselineStartUtc`, `reviewEndUtc` |
| `uteamup_reliability_forecast_get` / `uteamup_reliability_forecast_list` | Deterministic failure forecast | `assetGuid`, `horizonDays` |
| `uteamup_reliability_strategy_propose` | Review-only FMEA/RCM strategy proposal | `assetGuid`, `objectiveKey`, `fromUtc`, `toUtc` |
| `uteamup_reliability_assessments_list` | Failure-mode assessments for an asset | `assetGuid`, `includeHistory` |
| `uteamup_user_search` | Action owners | `searchFilter` |

## Workflow

1. **Check the company.** If a tool reports no tenant or wrong tenant, call
   `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect.
2. **Identify the asset.** `uteamup_asset_search` with `searchFilter`; if several match, ask.
   Confirm with `uteamup_asset_get_by_guid`.
3. **Check for an existing RCA.** `uteamup_rca_list` (optionally `status` `Draft` or
   `InProgress`) and look for the asset or problem. Continue an existing one rather than start a
   duplicate.
4. **Gather facts** (read only, summarise):
   - `uteamup_assetfailure_get_by_asset` and `uteamup_assetfailure_get_statistics`: how often,
     how severe, recurring or not.
   - For a specific event: `uteamup_asset_failure_evidence_pack` with `failureGuid`
     (`hoursBefore` 24, `hoursAfter` 6 by default).
   - `uteamup_workorder_list` with `assetGuid` and `pageSize` 20; for a key job,
     `uteamup_workorder_similar_jobs`.
   - `uteamup_failure_code_search` with symptom words to name the failure mode.
   - Fleet or portfolio questions ("what fails most"): `uteamup_reliability_risk_get` with
     `limit` 10, or `uteamup_failure_code_get_most_common`.
5. **Record the failure if it is missing.** Draft `assetGuid`, `failureDate`, `status` (`Open`,
   `InProgress`, `Resolved`, `Recurring`, `Deferred`), `severity` (`Critical`, `High`,
   `Medium`, `Low`), `failureDescription`, `symptoms`; after a yes call
   `uteamup_assetfailure_create`. Classify with `uteamup_assetfailure_classify`
   (`Degradation`, `Breakdown`, `Hidden`, `Intermittent`, `Systematic`, `Random`).
6. **Start the RCA** (after a clear yes), one of:
   - Manual: `uteamup_rca_create` with `model` `{ "title", "problemStatement" (what, where,
     when, how often, impact), "severity" (`Low`/`Medium`/`High`/`Critical`),
     "linkedEntityType": "Asset", "linkedEntityGuid": "<asset>" }`.
   - AI draft: tell the user it charges AI credits and ask first. `uteamup_asset_rca_draft`
     with `assetGuid`, `monthsBack` and optional `focus`. Show the whys, suggested root cause,
     actions, confidence and warnings. Let the user edit, then
     `uteamup_asset_rca_create_from_draft` with `assetGuid` and `request` `{ "draft": <the
     reviewed draft>, "workorderGuids": [ evidence work orders ] }`. The RCA stays in Draft.
7. **Investigate.** For each why, `uteamup_rca_add_step` with `question`, `answer` and
   `evidenceNotes` (cite the failure, work order or evidence pack you used). Stop when the
   answer is a cause the organisation can control (procedure, design, spec, training, PM gap),
   usually 3-5 whys. Link other affected assets with `uteamup_rca_link_assets`.
8. **Actions.** For each agreed action: `uteamup_rca_add_action` with `actionType`
   (`Corrective` fixes this cause, `Preventive` stops recurrence elsewhere, `Detective` catches
   it earlier), `description`, `assignedToUserGuid` (via `uteamup_user_search`) and `dueDate`.
   If the fix needs a governed CAPA (quality-relevant or systemic), hand over to the
   `uteamup-quality-ncr-capa` skill.
9. **Complete.** When the user confirms the root cause: `uteamup_rca_complete` with `rcaGuid`
   and `rootCause`. Update the failure with `uteamup_assetfailure_resolve` `model`
   `{ "failureGuid", "rootCause", "resolution", "repairCost", "partsReplaced", "notes",
   "requiresFollowUp", "followUpDate" }` if it is not yet resolved.
10. **Check effectiveness later.** `uteamup_reliability_action_recurrence_review` with `rcaGuid`,
    the action's GUID from `uteamup_rca_get`, `assetGuid`, a `baselineStartUtc` before the
    action was done and a `reviewEndUtc` after it (`minimumReviewDays` default 30). Report
    whether failures dropped; if not, reopen the investigation with the user.
11. **Look ahead (optional).** `uteamup_reliability_forecast_get` for the asset, or
    `uteamup_reliability_strategy_propose` for a review-only FMEA/RCM proposal and PM interval.
    These do not change anything; present them as input to the maintenance plan.

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids: `uteamup_failure_code_get`, `uteamup_failure_code_update`,
  `uteamup_failure_code_get_by_category` and `uteamup_knowledge_article_get_by_failure_code`
  take legacy integer ids, so use failure codes only through search and most-common results.
- Before any create, update, classify, resolve, step, action or complete, show exactly what will
  be written and get a clear yes. Batch related steps into one confirmation when practical.
- Never delete. Do not call `uteamup_assetfailure_delete` or `uteamup_failure_code_delete`;
  correct a wrong failure with `uteamup_assetfailure_update` (send the full model).
- Do not invent causes. Separate facts (from tools) from hypotheses (yours). Record a root
  cause only when the user confirms it.
- `uteamup_asset_rca_draft` and other AI tools charge AI credits; ask first and report the
  credit outcome. `uteamup_reliability_strategy_prepare_run` and
  `uteamup_reliability_forecast_schedule_confirm` create durable runs or work orders; use them
  only on explicit request.
- Respect permission and feature errors: report them, do not retry around them.
- Dates are UTC ISO 8601. Keep output short: at most about 10 rows per list; no raw JSON.

## Examples

**"Pump 3 keeps overheating, find out why."**
1. `uteamup_asset_search` `{ "searchFilter": "pump 3" }` → `uteamup_rca_list` `{ "status": "InProgress" }` → none.
2. `uteamup_assetfailure_get_by_asset`, `uteamup_assetfailure_get_statistics`, `uteamup_workorder_list` `{ "assetGuid": "<p3>", "pageSize": 20 }`.
3. Summarise: 3 overheating trips in 6 weeks, each after filter change. Confirm, then `uteamup_rca_create` `{ "model": { "title": "Pump 3 overheating", "problemStatement": "...", "severity": "High", "linkedEntityType": "Asset", "linkedEntityGuid": "<p3>" } }`.
4. `uteamup_rca_add_step` per why as the user answers.

**"Root cause was the wrong coupling grade. Close it and have Jon change the spec by Friday."**
1. `uteamup_user_search` `{ "searchFilter": "Jon" }`.
2. Confirm, then `uteamup_rca_add_action` `{ "rcaGuid": "<r>", "actionType": "Preventive", "description": "Update coupling spec in BOM and PM", "assignedToUserGuid": "<jon>", "dueDate": "2027-02-12T16:00:00Z" }`
3. `uteamup_rca_complete` `{ "rcaGuid": "<r>", "rootCause": "Coupling grade below duty rating" }`

**"Which assets fail the most this year?"**
1. `uteamup_reliability_risk_get` `{ "fromUtc": "2027-01-01T00:00:00Z", "limit": 10 }`
2. `uteamup_failure_code_get_most_common` `{ "count": 10 }` → table of bad actors and top failure modes.
