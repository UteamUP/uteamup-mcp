---
name: uteamup-it-cloud-cost
description: Reads UteamUP IT Management and cloud cost data - the IT dashboard (Azure connection health, open alerts, server health, patching, Defender posture, unmapped resources), IT alerts including budget and cost-anomaly alerts, cloud spend this month and the month-end forecast for Azure, AWS and Google Cloud, cost breakdown by service, account, resource, tag, region or resource group, daily cost trend, budgets, savings recommendations and software licence use. Use when the user says things like "how much have we spent on cloud this month", "will we go over budget", "what is driving the Azure bill", "cost by resource group last month", "show the cloud cost trend", "what savings can we make", "any critical IT alerts", "how healthy are our servers" or "how many unused licences do we pay for".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP IT and cloud cost

UteamUP IT Management connects to the company's cloud accounts and monitoring. It shows
connection health, IT alerts (Azure activity, Defender, server heartbeat, network flows,
webhooks, cloud budgets and cost anomalies), discovered resources and their asset
mapping. Cloud cost covers Azure, AWS and Google Cloud: spend, forecast, breakdowns,
budgets and savings recommendations, plus software licence use. Amounts are shown in the
company currency as an indicative conversion unless a native billing `currency` is
requested. This skill only reads; UteamUP never changes the cloud itself.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_it_management_dashboard` | Overview: connections, open alerts by severity and source, servers, patching, Defender, unmapped resources | – |
| `uteamup_it_management_dashboard_trends` | Dashboard history (≤ 30 days) | `from`, `to`, `interval` (`hour` or `day`), `connectionGuid` |
| `uteamup_it_management_alerts_list` | IT alerts with filters | `state` (`open`, `acknowledged`, `resolved`), `minimumSeverity` (`info`, `warning`, `error`, `critical`), `source`, `assetGuid`, `from`, `to`, `search`, `page`, `pageSize` |
| `uteamup_it_management_alert_get` | One alert with lifecycle, linked asset and work order | `alertGuid` |
| `uteamup_it_management_connections_list` | Connection health, last sync, secret expiry date | – |
| `uteamup_it_management_resources_list` | Discovered resources and asset mapping | `unmappedOnly`, `assetGuid`, `page`, `pageSize` |
| `uteamup_it_management_service_map_summary` | Service map: nodes, edges, nodes with open alerts | `windowHours` (1–168) |
| `uteamup_it_management_activity_log` | Azure activity log, newest first | `fromUtc`, `toUtc`, `failedOnly`, `textContains`, `resourceGroup`, `limit` |
| `uteamup_it_management_cost_summary` | Spent this month, month-end forecast, last month, budget used, savings available | `month` (yyyy-MM), `accountGuid`, `currency` |
| `uteamup_it_management_cost_breakdown` | Top cost items for one grouping | `groupBy` (`service`, `account`, `resource`, `tag`, `businessService`, `region`, `resourceGroup`), `from`, `to` or `month`, `tagKey`, `top` (1–50), `amortized`, `accountGuid`, `currency` |
| `uteamup_it_management_cost_trend` | Daily actual and forecast cost, monthly totals | `from`, `to` (≤ 400 days) or `month`, `amortized`, `accountGuid`, `currency` |
| `uteamup_it_management_cost_budgets_list` | Budgets: amount, period, scope, spent, forecast, thresholds | – |
| `uteamup_it_management_cost_recommendations_list` | Savings from Azure Advisor, AWS and Google, largest first | `status` (`open`, `planned`, `inProgress`, `implemented`, `dismissed`, `expired`), `take` (1–200) |
| `uteamup_it_management_licences_list` | Licence seats bought and used, unused cost, renewals in 90 days | – |

## Workflow

Dates for cost tools are calendar days `YYYY-MM-DD` (inclusive), or a whole month as
`month: "2026-03"`. Dashboard and alert times are ISO 8601 UTC.

### A. Cloud spend question
1. `uteamup_it_management_cost_summary` (current month unless the user names one). Give:
   spent so far, forecast by month end, last month, budget used and savings available.
2. "What drives it": `uteamup_it_management_cost_breakdown` with `groupBy: "service"`
   (or the grouping the user asked for) and `top: 10`. For tags, ask for the tag key and
   pass `groupBy: "tag"`, `tagKey`.
3. "How is it trending": `uteamup_it_management_cost_trend` for the requested range; describe
   the direction, the largest day and any jump between months.
4. "Will we go over budget": `uteamup_it_management_cost_budgets_list`; compare forecast to
   amount for each budget. Then `uteamup_it_management_alerts_list` with
   `source: "costBudget"` or `source: "costAnomaly"` and `state: "open"`.
5. Say whether figures are converted (indicative) or in native `currency`, and whether
   `amortized` was used. Do not add currencies together unless the tool already converted.

### B. Savings
1. `uteamup_it_management_cost_recommendations_list` (default open and planned, `take` 20).
2. Show the top items with estimated monthly saving, resource and effort. Savings are
   estimates until 30 days after the related work order is done.
3. If the user wants a work order to carry one out, that is a write action outside this
   skill (it needs `CloudCost.Recommendation.Manage` and `WorkOrder.Create`); ask them to
   confirm the specific recommendation and use the full UteamUP connection.

### C. IT health and alerts
1. `uteamup_it_management_dashboard` for the overview.
2. `uteamup_it_management_alerts_list` with `state: "open"`, `minimumSeverity: "error"`,
   `pageSize` 20; open details with `uteamup_it_management_alert_get`.
3. Connection problems (failed sync, secret expiring): `uteamup_it_management_connections_list`.
4. On request: `uteamup_it_management_resources_list` (`unmappedOnly: true`) for resources
   not yet tracked as assets, `uteamup_it_management_activity_log` (`failedOnly: true`) for
   recent failed operations, `uteamup_it_management_dashboard_trends` for history.

### D. Licences
`uteamup_it_management_licences_list`: report unused seats and their cost, cost per seat and
renewals due within 90 days, largest waste first.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- This skill only reads. Acknowledging or resolving alerts and creating work orders from
  savings are write actions: show exactly what would change and get a clear yes in a write
  workflow first. Records are archived, never deleted.
- No tool in this skill spends AI credits. If you use another UteamUP tool whose
  description says it costs AI credits, state the cost and ask first.
- Report numbers exactly as returned. Forecasts and savings are estimates; say so. Missing
  data stays missing; never interpolate gaps in trends.
- Never ask for, show or store cloud credentials, secrets or keys; the tools never return
  them.
- Respect permission and feature errors (`CloudCost.View`, `ContractCost.View`,
  `ITManagement.View`, or the IT Cost Management feature not enabled). Report them; do not
  retry with other tools to get around them.
- Keep results short: use `top`, `take`, `pageSize` and date ranges; summarise, don't dump.

## Not available through MCP

- Connecting a new cloud account or Entra directory, changing budgets or alert rules, and
  changing cloud resources: ask the user to use the web app (UteamUP never changes the
  cloud itself).

## Examples

**"How much have we spent on cloud this month and what is driving it?"**
`uteamup_it_management_cost_summary` →
`uteamup_it_management_cost_breakdown(groupBy: "service", top: 5)` → short table.

**"Are we going to blow the Azure budget?"**
`uteamup_it_management_cost_budgets_list` →
`uteamup_it_management_alerts_list(source: "costBudget", state: "open")` → forecast vs budget.

**"Any critical IT problems right now?"**
`uteamup_it_management_dashboard` →
`uteamup_it_management_alerts_list(state: "open", minimumSeverity: "critical", pageSize: 20)` →
`uteamup_it_management_alert_get` for the top item.
