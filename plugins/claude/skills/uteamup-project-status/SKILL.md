---
name: uteamup-project-status
description: Reports the status of UteamUP projects through the UteamUP MCP server without changing anything. Summarises the portfolio by schedule risk, and for one project reads the stored health snapshot, stage and gate progress, budget and cost position, variance against the baseline, top risks, open obligations, scheduling conflicts, pending change requests and recent activity, then writes a short status report. Use when the user asks things like "how are our projects doing", "which projects are late", "give me a status report on the boiler project", "what is the budget position on project X", "what are the top risks", "which stage are we in", "is the commissioning gate met", "what changed on the project this week", or "prepare the project status for Monday's meeting".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP project status

Answer "where do we stand?" for one project or the whole portfolio. The skill only reads: it
finds the project, gathers health, stages, cost, risks and recent activity, and writes a short,
factual status report. It never creates, updates or recalculates anything.

The project tools are only on the full UteamUP connection (`/mcp`). The read-only connection
(`/mcp/read-only`) exposes asset and work order reads only; if the project tools below are not
listed, say that project status needs the full connection or the UteamUP web app.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_project_portfolio` | All projects ranked by schedule risk, with filters | `search`, `status`, `ownerGuid`, `priority`, `overdueOnly`, `sortBy`, `page`, `pageSize` |
| `uteamup_project_my_projects` | Projects the signed-in user works on | (none) |
| `uteamup_project_get` | Project detail: dates, status, budget, completion | `projectGuid` |
| `uteamup_project_get_health` | Latest stored health snapshot (schedule risk, task counts, budget burn) | `projectGuid` |
| `uteamup_project_stage_list` | Stages with status, dates and work order tally | `projectGuid` |
| `uteamup_project_stage_criteria_list` | Gate criteria of a stage and whether each is met | `projectGuid`, `stageGuid` |
| `uteamup_project_gate_decision_list` | Recorded gate decisions | `projectGuid`, `stageGuid` |
| `uteamup_project_budget_get` | Budget, actual cost, variance, utilisation | `projectGuid` |
| `uteamup_project_cost_summary` | Sales value, cost budget, actual, commitments, forecast | `projectGuid`, `deliverableGuid` |
| `uteamup_project_baselines_list` | Captured baselines | `projectGuid` |
| `uteamup_project_variance_get` | Dates/cost against a baseline | `projectGuid`, `baselineGuid` |
| `uteamup_project_risk_list` | Risks sorted by score | `projectGuid`, `status` |
| `uteamup_project_risk_list_workorders` | Mitigation work orders for a risk | `projectGuid`, `riskGuid` |
| `uteamup_project_obligation_list` | Snags, warranty and other open obligations | `projectGuid`, `status`, `deliverableGuid` |
| `uteamup_project_conflicts` | Clashes with preventive maintenance outside the project | `projectGuid` |
| `uteamup_project_schedule_get` | Schedule, dependencies and calendar | `projectGuid` |
| `uteamup_project_change_requests_list` | Change requests and their state | `projectGuid` |
| `uteamup_project_activity_list` | Recent activity | `projectGuid`, `limit` |
| `uteamup_project_comments_list` | Comments and recorded decisions | `projectGuid` |
| `uteamup_project_members_list` | Project team and allocation | `projectGuid` |
| `uteamup_project_bom_list` | Planned vs actual materials | `projectGuid` |
| `uteamup_project_output_item_list` | Deliverables and delivery state | `projectGuid` |
| `uteamup_workorder_get` | Detail of one project work order | `workorderGuid` |
| `uteamup_tenant_get_my_tenants` | Check the active company | (none) |

## Workflow

1. **Check the company.** If the user names another company, or a tool reports no tenant or
   wrong tenant, call `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect.
2. **Portfolio question** ("how are our projects doing", "which are late"):
   `uteamup_project_portfolio` with `pageSize` 10-25, default sort (schedule risk, descending).
   Use `overdueOnly` true for "late", `ownerGuid` for "my team's", `status` for a lifecycle
   filter (0 Planning, 1 Active, 2 On hold, 3 Completed, 4 Cancelled). For "my projects" use
   `uteamup_project_my_projects`. Report a short table: name, status, schedule risk, % complete,
   end date, budget use. Stop here unless the user asks about one project.
3. **Find one project.** `uteamup_project_portfolio` with `search` (name or code). If several
   match, list them and ask. Then `uteamup_project_get`.
4. **Health.** `uteamup_project_get_health`. Note the snapshot time; if it is old or missing,
   say so. Recalculating health stores a new snapshot, which is a write and is not done here.
5. **Progress.** `uteamup_project_stage_list`; find the current stage (InProgress) and any
   Blocked or overdue stage. For the current or next gate, `uteamup_project_stage_criteria_list`
   and list unmet criteria. Use `uteamup_project_gate_decision_list` when the user asks who
   released a gate.
6. **Money.** `uteamup_project_budget_get`. For delivery projects with cost data,
   `uteamup_project_cost_summary` gives actual, commitments and forecast final cost. If a
   baseline exists (`uteamup_project_baselines_list`), `uteamup_project_variance_get` shows
   date and cost drift. Permission errors on cost (for example `ProjectCost.View`) mean the
   user cannot see cost; report that and continue without it.
7. **Risks and issues.** `uteamup_project_risk_list` with `status` `Open` (then `Mitigating`);
   report the top three by score (probability x impact) with owner and mitigation. Add
   `uteamup_project_obligation_list` with `status` `Open` and `uteamup_project_conflicts` when
   relevant.
8. **Changes and activity.** `uteamup_project_change_requests_list` for pending requests;
   `uteamup_project_activity_list` with `limit` 20 for "what changed"; filter to the period the
   user asked about.
9. **Write the report.** Keep it to one screen:
   - Headline: on track / at risk / late, with the reason in one sentence.
   - Schedule: current stage, next gate and unmet criteria, end date vs baseline.
   - Cost: budget, actual, forecast, variance.
   - Top risks and open obligations.
   - Decisions needed and pending change requests.
   - Data gaps (missing snapshot, no baseline, no cost permission).
   State facts from the tools; mark any judgement as your assessment.

## Rules

- Read only. Do not call any create, update, set-status, advance, apply, archive, compute or
  delete tool, even if it is available. If the user wants a change, say what would change and
  suggest the `uteamup-project-planning` skill or the web app.
- Do not call tools that charge AI credits (`uteamup_project_generate_summary`,
  `uteamup_project_lessons_learned`, `uteamup_project_estimate`) unless the user explicitly asks
  and accepts the AI credit cost; they also store their result.
- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids (`uteamup_cost_by_project` takes integer ids; do not use it).
- Respect permission errors: report what could not be read; do not try other tools to get
  around them.
- Do not invent numbers. If a value is missing or null, say "not recorded".
- Keep output short: at most about 10 rows per list; summarise, no raw JSON.

## Examples

**"Which projects are running late?"**
1. `uteamup_project_portfolio` `{ "overdueOnly": true, "pageSize": 10 }`
2. Table of name, owner, end date, days late, % complete.

**"Status report on the boiler replacement for Monday."**
1. `uteamup_project_portfolio` `{ "search": "boiler" }` → `uteamup_project_get`.
2. `uteamup_project_get_health`, `uteamup_project_stage_list`,
   `uteamup_project_stage_criteria_list` for the current stage.
3. `uteamup_project_budget_get`, `uteamup_project_risk_list` `{ "status": "Open" }`,
   `uteamup_project_change_requests_list`, `uteamup_project_activity_list` `{ "limit": 20 }`.
4. One-screen report as in step 9.

**"Is the commissioning gate met?"**
1. Find the project, `uteamup_project_stage_list` → Commission stage GUID.
2. `uteamup_project_stage_criteria_list` → list each criterion with met / not met and the linked
   work order if any.
