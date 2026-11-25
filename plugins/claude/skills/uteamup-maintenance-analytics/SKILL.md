---
name: uteamup-maintenance-analytics
description: Reads maintenance KPIs from UteamUP and explains them - PM schedule compliance, backlog weeks, emergency work percentage, maintenance type mix, asset failure statistics with MTBF and downtime, mean time to first failure, reliability risk ranking, stock-out rate, maintenance cost by project, user and vendor, cost trends, PM cost forecast versus actual, asset total cost of ownership and what stock and assets are worth. Use when the user says things like "how is our PM compliance this month", "how many weeks of backlog do we have", "what share of work was emergency", "MTBF for pump 3", "which assets are the riskiest", "what did maintenance cost last quarter", "cost trend this year", "how much is our stock worth" or "give me a KPI summary for the board".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP maintenance analytics

This skill answers maintenance performance questions with UteamUP's own figures. The
analytics tools are evidence-based: when the underlying data is incomplete they return
`null` for a percentage or KPI together with coverage counts, rather than an estimate.
Report that honestly ("not enough data: 12 of 40 work orders have no estimate") instead of
filling the gap. All tools in this skill only read; none of them spend AI credits.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | What it measures | Key arguments |
|------|------------------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_analytics_pm_schedule_compliance` | Preventive work completed inside published schedule windows | `timeframe` (`7d`, `30d`, `90d`, `ytd`) |
| `uteamup_analytics_maintenance_backlog_weeks` | Open estimated work divided by next ISO week's capacity | – |
| `uteamup_analytics_emergency_work_percentage` | Share of completed work orders flagged emergency | `startUtc`, `endUtc` (≤ 366 days, end exclusive; default 30 days) |
| `uteamup_analytics_maintenance_type_distribution` | Work split by EN 13306 type (preventive, corrective, …) | `dateFrom`, `dateTo`, `assetGuid`, `locationGuid` |
| `uteamup_analytics_mean_time_to_first_failure` | Calendar time from installation to first failure (MTTF, not MTBF) | – |
| `uteamup_analytics_stockout_time_rate` | Share of item-hours with zero stock on hand | `startUtc`, `endUtc` |
| `uteamup_analytics_value_overview` | Current value of stock and assets | – |
| `uteamup_assetfailure_get_statistics` | One asset: failures, repair cost, downtime minutes, MTBF | `assetGuid` |
| `uteamup_assetfailure_get_open` / `uteamup_assetfailure_get_by_severity` | Unresolved failures; failures of one severity | – / `severity` |
| `uteamup_reliability_risk_get` | Ranked reliability risks with reasons | `assetGuid`, `fromUtc`, `toUtc`, `limit` |
| `uteamup_reliability_forecast_list` | Elevated-risk failure forecasts | `horizonDays` |
| `uteamup_asset_search` / `uteamup_asset_list` | Find an asset GUID | `searchFilter` / `page`, `pageSize` |
| `uteamup_asset_tco` | One asset's purchase cost, book value and running cost | `assetGuid`, `months` |
| `uteamup_cost_overview_summary` | Maintenance cost totals, change, categories, top items | `timeframe` (`7d`, `30d`, `90d`, `ytd`, `all`) |
| `uteamup_cost_trends` | Cost time series | `timeframe` |
| `uteamup_cost_by_project` / `uteamup_cost_by_user` / `uteamup_cost_by_vendor` | Cost per project, labour per person, vendor spend | `timeframe` |
| `uteamup_cost_by_workorder` | Estimated vs actual cost of one work order | `workorderGuid` |
| `uteamup_forecast_latest` / `uteamup_forecast_vs_actual` | Saved PM cost forecast; forecast vs actual | – / `startDate`, `endDate` |
| `uteamup_report_analytics` | Report counts, cost trends, top assets, completion | `startDate`, `endDate` (YYYY-MM-DD, ≤ 366 days), `groupBy` (`day`, `week`, `month`, `quarter`, `year`) |
| `uteamup_meterschedule_compliance_summary` | Meter-reading compliance | `assetGuid` |
| `uteamup_workorder_list_by_type` | Work orders behind a type figure | `maintenanceTypeCategory`, `dateFrom`, `dateTo`, `page`, `pageSize` |

## Workflow

1. Confirm the company and the period. If the user gives no period, use the last 30 days
   and say so. Convert local dates to UTC for `*Utc` arguments.
2. Pick the smallest set of tools that answers the question (see the table). For a
   general "KPI summary", call in this order and stop after what the user needs:
   - `uteamup_analytics_pm_schedule_compliance` (`timeframe`),
   - `uteamup_analytics_maintenance_backlog_weeks`,
   - `uteamup_analytics_emergency_work_percentage`,
   - `uteamup_analytics_maintenance_type_distribution`,
   - `uteamup_cost_overview_summary` (`timeframe`),
   - `uteamup_reliability_risk_get` (`limit` 5).
3. For one asset: find it with `uteamup_asset_search`, then
   `uteamup_assetfailure_get_statistics`, `uteamup_asset_tco` and optionally
   `uteamup_reliability_risk_get` with `assetGuid`.
4. Present a short table: KPI, value, period, data coverage. Put `null` results in a
   separate "Not enough data" line with the reason the tool gives (for example missing
   estimates, no published schedule window, unclassified emergency flag) and what would
   fix it.
5. Offer one drill-down, for example `uteamup_workorder_list_by_type` with
   `maintenanceTypeCategory: "corrective"` for the work orders behind a figure, or
   `uteamup_cost_by_workorder` for a single expensive job.

### KPI definitions to state when reporting

- **PM compliance**: preventive work completed inside its published schedule window,
  only for weeks that have a published schedule.
- **Backlog weeks**: open estimated hours divided by known capacity next week.
- **Emergency %**: emergency completions among all completions in the window.
- **MTBF** (per asset, from `uteamup_assetfailure_get_statistics`): mean time between
  recorded failures. **MTTF** (`uteamup_analytics_mean_time_to_first_failure`) is calendar
  lifetime to the first failure; never call it MTBF.
- **MTTR** has no dedicated tool. If asked, you may show total downtime minutes divided by
  resolved failures for one asset and label it "approximate repair time per resolved
  failure, from recorded downtime".

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- This skill only reads. It does not create, update or archive anything. If the user wants
  to act on a figure (schedule work, reorder stock), hand over to the matching workflow and
  get a clear yes there.
- Never invent, interpolate or round away missing data. A `null` KPI is reported as "not
  enough data", with coverage counts.
- Keep currencies separate unless the tool says the value is converted (`isApproximate`).
- No tool in this skill spends AI credits. If you ever use another UteamUP tool whose
  description says it costs AI credits, state the cost and ask first.
- Respect permission errors (for example `Analytics.View`, `Schedule.View`,
  `AssetFailure.View`, `AssetCost.View`, `InventoryCost.View`). Report which figure is
  hidden; do not retry with other tools to get around them.
- Keep results short: summarise in a table; don't paste raw responses.

## Not available through MCP

- Company-wide MTTR and OEE as stored KPIs: not available; use the labelled approximation
  above or ask the user to use the web app dashboards.
- Cost filters by project or team in `uteamup_cost_*` use integer ids; do not pass them.
  Use `timeframe` only, and `uteamup_cost_by_project` for per-project figures.
- Generating a new PM cost forecast (`uteamup_forecast_generate`) saves a forecast and is
  outside this read-only skill; read the latest saved one with `uteamup_forecast_latest`.

## Examples

**"How are we doing on preventive maintenance this quarter?"**
`uteamup_analytics_pm_schedule_compliance(timeframe: "90d")` →
`uteamup_analytics_maintenance_type_distribution(dateFrom, dateTo)` → table with coverage.

**"What is the MTBF and running cost of compressor C-2?"**
`uteamup_asset_search(searchFilter: "C-2")` → `uteamup_assetfailure_get_statistics(assetGuid)`
→ `uteamup_asset_tco(assetGuid, months: 12)`.

**"Give me a one-page KPI summary for last month."**
`uteamup_analytics_pm_schedule_compliance(timeframe: "30d")` →
`uteamup_analytics_maintenance_backlog_weeks` → `uteamup_analytics_emergency_work_percentage`
→ `uteamup_cost_overview_summary(timeframe: "30d")` → `uteamup_reliability_risk_get(limit: 5)`.
