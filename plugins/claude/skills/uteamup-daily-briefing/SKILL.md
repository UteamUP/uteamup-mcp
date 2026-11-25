---
name: uteamup-daily-briefing
description: Builds a short morning overview for a maintenance supervisor from UteamUP read tools - the shift running now, today's scheduled work and unassigned jobs, overdue preventive work, open critical and emergency work orders, unresolved equipment failures, stock alerts, open safety incidents, handovers waiting for review and other overdue checks. Use when the user says things like "give me my morning briefing", "what do I need to know today", "start of shift summary", "what is overdue", "what's critical right now", "anything I should worry about before the 7 o'clock meeting" or "brief me on the site".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: read
---

# UteamUP daily briefing

A supervisor's first five minutes: what is running, what is late, what is critical and what
needs a decision today. The skill composes the briefing from read-only tools, keeps each
list short and ends with at most five suggested actions. It never changes anything; acting
on an item is a separate step the user starts.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Section of the briefing | Key arguments |
|------|-------------------------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm the company | – |
| `uteamup_briefing_daily_read` | Today's prepared role briefing, if the company uses it | `briefingGuid` (omit for today) |
| `uteamup_shift_get_current` | Shift running now | `locationGuid` |
| `uteamup_location_list` | Find a site's GUID | `search`, `page`, `pageSize` |
| `uteamup_team_list` | Find the supervisor's team GUID | `page`, `pageSize` |
| `uteamup_schedule_get_team_schedule` | Today's booked work per person | `teamGuid`, `startDate`, `endDate` (YYYY-MM-DD) |
| `uteamup_schedule_assignment_get_week_by_guid` | Week view with unassigned work orders | `weekStart` (UTC), `teamGuid` |
| `uteamup_workforce_planning_grid` | Shift staffing for the day | `dateFrom`, `dateTo`, `locationGuid` |
| `uteamup_workorder_list` | Open work orders (priority 5 = critical) | `openOnly`, `search`, `page`, `pageSize` |
| `uteamup_workorder_list_by_type` | Preventive work due up to today | `maintenanceTypeCategory`, `dateFrom`, `dateTo`, `page`, `pageSize` |
| `uteamup_assetfailure_get_open` | Unresolved equipment failures | – |
| `uteamup_stock_get_tenant_alert_summary` | Stock alert totals | – |
| `uteamup_stock_get_tenant_alerts` | Stock alert details | `severity`, `alertType`, `page`, `pageSize` |
| `uteamup_safetyincident_list` | Open safety incidents | `status`, `take` |
| `uteamup_shift_handover_search` | Handovers waiting for review | `searchModel` (`status`, `fromDate`, `toDate`, `page`, `pageSize`) |
| `uteamup_shift_handover_get_operational_baton` | Action-first view of one handover | `handoverGuid` |
| `uteamup_inspection_schedule_get_overdue` | Overdue inspection routes | – |
| `uteamup_meterschedule_get_overdue` | Overdue meter readings | – |
| `uteamup_assetcalibration_get_overdue` | Overdue calibrations | – |
| `uteamup_workorder_daily_brief` | AI "My Day" brief for the signed-in worker (costs AI credits) | `date`, `regenerate` |

## Workflow

1. Confirm the company, the site (if the user has several) and the team. Ask once; reuse
   the answer for the rest of the conversation.
2. Try `uteamup_briefing_daily_read` first. If a briefing exists, use it as the opening
   paragraph and still run the checks below for live numbers. A "not found" or permission
   error just means the company does not use prepared briefings; continue.
3. Gather, keeping each call small (`pageSize` 10–25, `take` 25):
   1. **Now**: `uteamup_shift_get_current` (`locationGuid` if a site was named).
   2. **Today's work**: `uteamup_schedule_get_team_schedule` with today as `startDate`
      and `endDate`; unassigned jobs from `uteamup_schedule_assignment_get_week_by_guid`
      (`unassignedWorkorders`, keep those due today or earlier). If the user plans by
      shift, use `uteamup_workforce_planning_grid` for today instead.
   3. **Critical and late work**: `uteamup_workorder_list` with `openOnly: true`; keep
      items with `priority` 5 or 4, and items whose `dueDate` is before now.
   4. **Overdue preventive work**: `uteamup_workorder_list_by_type` with
      `maintenanceTypeCategory: "preventive"`, `dateTo` = today; keep items without
      `completedAt` whose `dueDate` is before today.
   5. **Equipment**: `uteamup_assetfailure_get_open`; highlight critical severity.
   6. **Stock**: `uteamup_stock_get_tenant_alert_summary`; if anything is out of stock,
      list the top items with `uteamup_stock_get_tenant_alerts`.
   7. **Safety**: `uteamup_safetyincident_list` with `status: "draft"`, then
      `"submitted"` and `"underInvestigation"`; report counts and the newest few.
   8. **Handover**: `uteamup_shift_handover_search` with `status: "submitted"` (and
      today's dates); for the most recent, `uteamup_shift_handover_get_operational_baton`
      to surface safety items, blockers and unacknowledged critical items.
   9. **Other overdue checks** (only if the user wants a full briefing):
      `uteamup_inspection_schedule_get_overdue`, `uteamup_meterschedule_get_overdue`,
      `uteamup_assetcalibration_get_overdue`.
4. Write the briefing in this order, each section 1–5 lines with counts first:
   Now · Safety · Critical work · Overdue PM · Equipment · Stock · Handover · Today's plan.
   Leave out empty sections and say "nothing open" in one line at the end.
5. Finish with up to five suggested actions (for example "assign the two unassigned
   critical jobs", "review Anna's handover"), and ask which one to start. Starting one
   moves to the matching write workflow, which asks for its own confirmation.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- This skill only reads. Before any follow-up create, update, assignment or archive, show
  what will change and get a clear yes in that workflow. Records are archived, never
  deleted.
- `uteamup_workorder_daily_brief` costs AI credits (the cached brief for the same day is
  free, `regenerate: true` charges again). Use it only when the user asks for the AI brief
  and has accepted the cost. All other tools here are free.
- Report only what the tools return. If a section fails or is hidden by permissions, say
  "not available (no access)" and continue with the others; do not retry with other tools
  to get around the error.
- Keep it short: counts plus the few items that matter. Never paste raw lists. Name people
  only where it helps action; keep injury details out of the briefing.
- If the connection is read-only, the briefing still works; acting on it requires the full
  UteamUP connection.

## Not available through MCP

- A single "overdue work orders" filter: overdue is worked out from `dueDate` and status
  in the list results, as described above.
- Pushing the briefing to people by e-mail, SMS or chat: ask the user to share it
  themselves.

## Examples

**"Morning briefing for the north plant."**
`uteamup_location_list(search: "north")` → `uteamup_briefing_daily_read` →
`uteamup_shift_get_current(locationGuid)` → `uteamup_workorder_list(openOnly: true, pageSize: 25)`
→ `uteamup_workorder_list_by_type(maintenanceTypeCategory: "preventive", dateTo: today)` →
`uteamup_assetfailure_get_open` → `uteamup_stock_get_tenant_alert_summary` →
`uteamup_safetyincident_list(status: "submitted")` →
`uteamup_shift_handover_search(searchModel: {status: "submitted"})` → briefing.

**"What's critical right now?"**
`uteamup_workorder_list(openOnly: true)` (keep priority 5) → `uteamup_assetfailure_get_open`
→ `uteamup_safetyincident_list(status: "underInvestigation")` → three-line answer.

**"Who is working today and what is unassigned?"**
`uteamup_team_list` → `uteamup_schedule_get_team_schedule(teamGuid, startDate, endDate)` →
`uteamup_schedule_assignment_get_week_by_guid(weekStart, teamGuid)` → list unassigned due today.
