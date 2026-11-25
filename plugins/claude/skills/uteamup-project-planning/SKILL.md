---
name: uteamup-project-planning
description: Plans and maintains UteamUP projects through the UteamUP MCP server. Creates a project (from scratch or from a project template), sets up stages and gate criteria, adds work-breakdown tasks as work orders, members, risks and bill-of-materials lines, schedules stage and work order dates, records cost lines and change requests, and archives finished projects, with every change confirmed by the user first. Use when the user says things like "set up a project for the boiler replacement", "create the shutdown project from our template", "add a commissioning stage with gate criteria", "break this project into tasks", "add a risk for late delivery of the pump", "put 4 bearings on the project BOM", "move the stage due date to next Friday", "add Anna to the project as planner", "raise a change request for extra scope", or "archive the finished project".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP project planning

Build and maintain a project plan in UteamUP: the project record, its stages (gates and
milestones) with gate criteria, the work orders that are its tasks, the team, the risk register,
the bill of materials (BOM), dates, cost lines and formal change requests. Every write is shown
to the user first and only sent after a clear yes.

This skill needs the full UteamUP connection (`/mcp`). The read-only connection exposes no
project tools; explain that planning needs the full connection and the user's `Project.*`
permissions. For read-only status reports use the `uteamup-project-status` skill.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_project_portfolio` | Find projects by name/code (paged) | `search`, `status`, `page`, `pageSize` |
| `uteamup_project_get` | Read one project before changing it | `projectGuid` |
| `uteamup_project_template_list` | Available project templates | (none) |
| `uteamup_project_create_by_guid` | Create a project | `name`, `startDateUtc`, `ownerGuid`, `description`, `projectCode`, `endDateUtc`, `priority`, `budget`, `currencyGuid`, `locationGuid`, `projectProfile` |
| `uteamup_project_create_from_template` | Create a project from a template | `templateGuid`, `name`, `startDateUtc`, `ownerGuid`, plus the same optional fields |
| `uteamup_project_update` | Change project fields (full model) | `projectGuid`, `model` |
| `uteamup_project_archive` / `uteamup_project_restore` | Archive or restore a project | `projectGuid` |
| `uteamup_project_stage_list` / `uteamup_project_stage_get` | Stages and their status | `projectGuid`, `stageGuid` |
| `uteamup_project_stage_create` | Add a stage | `projectGuid`, `model` (`name`, `order`, `description`, `startDate`, `dueDate`) |
| `uteamup_project_stage_update` | Change a stage (full model) | `projectGuid`, `stageGuid`, `model` |
| `uteamup_project_stage_set_status` | Set one stage status | `projectGuid`, `stageGuid`, `status` |
| `uteamup_project_stage_advance` | Complete the stage and move to the next | `projectGuid`, `stageGuid` |
| `uteamup_project_stage_criteria_list` | Gate criteria of a stage | `projectGuid`, `stageGuid` |
| `uteamup_project_stage_criterion_create` / `_update` | Add or change a gate criterion | `projectGuid`, `stageGuid`, (`criterionGuid`), `label`, `order`, `isMet`, `workorderGuid` |
| `uteamup_project_stage_assign_workorder` | Put an existing work order in a stage | `projectGuid`, `stageGuid`, `workorderGuid` |
| `uteamup_project_suggest_wbs` / `uteamup_project_apply_wbs` | AI-suggested stages + tasks, then create the reviewed ones | `projectGuid`, `stages` |
| `uteamup_project_members_list` / `uteamup_project_members_add` | Project team | `projectGuid`, `model` (`userGuid`, `role`, `allocationPercent`, `startDate`, `endDate`) |
| `uteamup_project_dependencies_add` | Finish-to-start etc. between two work orders | `projectGuid`, `model` |
| `uteamup_project_risk_list` / `uteamup_project_risk_create` / `uteamup_project_risk_update` | Risk register | `projectGuid`, `riskGuid`, `model` |
| `uteamup_project_risk_set_status` | Open, Mitigating, Accepted, Closed | `projectGuid`, `riskGuid`, `status` |
| `uteamup_project_risk_link_workorder` | Link a mitigation work order | `projectGuid`, `riskGuid`, `workorderGuid` |
| `uteamup_project_bom_list` / `uteamup_project_bom_create` / `uteamup_project_bom_update` | Bill of materials lines | `projectGuid`, `itemGuid`, `model` |
| `uteamup_project_budget_get` | Budget, actual cost, variance | `projectGuid` |
| `uteamup_project_cost_record_create` | Record a manual cost line | `projectGuid`, `model` |
| `uteamup_project_timeline_stage_schedule` | Move stage dates only | `projectGuid`, `stageGuid`, `model` (`startDate`, `dueDate`, `expectedUpdatedAt`) |
| `uteamup_project_timeline_workorder_schedule` | Move a project work order's planned dates only | `projectGuid`, `workorderGuid`, `model` |
| `uteamup_project_baselines_capture` | Freeze a baseline before changes | `projectGuid`, `model` (`label`) |
| `uteamup_project_change_requests_create` / `_submit` | Formal scope/date/budget change | `projectGuid`, `model`, `requestGuid` |
| `uteamup_project_comments_add` | Decision or note on the project | `projectGuid`, `model` (`text`, `isDecision`) |
| `uteamup_user_search` | Owner, members, assignees | `searchFilter` |
| `uteamup_workorder_search` / `uteamup_workorder_get` | Existing work orders to link | `searchFilter`, `workorderGuid` |
| `uteamup_part_search` | BOM part lookup | `searchTerm`, `maxResults` |
| `uteamup_location_list` | Project site | `search` |
| `uteamup_tenant_get_my_tenants` | Check the active company | (none) |

## Workflow

1. **Check the company.** If the user names another company, or a tool reports no tenant or
   wrong tenant, call `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect to
   the right one. No MCP tool switches company mid-session.
2. **Find or create the project.**
   - Existing: `uteamup_project_portfolio` with `search`, pick the GUID, read it with
     `uteamup_project_get`.
   - New: ask for name, start date, owner and (optional) end date, budget, code, location.
     Find the owner with `uteamup_user_search`. Check `uteamup_project_template_list`; if a
     template fits, offer `uteamup_project_create_from_template`, otherwise
     `uteamup_project_create_by_guid`. `projectProfile` is `Simple` (work orders, photos,
     budget), `Staged` (adds stage gates, dependencies, timeline) or `Delivery` (adds
     deliverables, process governance, BOM/stock, commercial tracking). `priority` is 0-5.
     Show the draft, get a yes, create once, keep the returned GUID.
3. **Stages and gates.** List with `uteamup_project_stage_list`. Add stages with
   `uteamup_project_stage_create` (`order` starts at 1; `dueDate` alone makes a milestone).
   Add gate criteria with `uteamup_project_stage_criterion_create` (`label`, optional
   `workorderGuid` when a work order proves the criterion). A criterion tied to a work order
   cannot be marked met by hand; finish the work order instead.
4. **Tasks.** Project tasks are work orders.
   - Suggest: `uteamup_project_suggest_wbs` returns stages and tasks (charges AI credits; say
     so and ask first). Let the user edit the list, then `uteamup_project_apply_wbs` with the
     reviewed `stages` only.
   - Link existing work: `uteamup_workorder_search`, then
     `uteamup_project_stage_assign_workorder`.
   - Order tasks: `uteamup_project_dependencies_add` with `model`
     `{ predecessorWorkorderGuid, successorWorkorderGuid, dependencyType, lagMinutes }`;
     `dependencyType` is `FinishToStart`, `StartToStart`, `FinishToFinish` or `StartToFinish`.
5. **Team.** `uteamup_user_search`, then `uteamup_project_members_add` with `role` (`Manager`,
   `Planner`, `Contributor`, `Reviewer`, `Viewer`), `allocationPercent` 0-100 and `startDate`.
6. **Risks.** `uteamup_project_risk_create` with `model` `{ title, description, category,
   probability (1-5), impact (1-5), mitigationPlan, ownerGuid, reviewDate }`; `category` is
   `Technical`, `Schedule`, `Cost`, `Resource`, `Safety`, `External` or `Other`. Change status
   with `uteamup_project_risk_set_status`; link mitigation work with
   `uteamup_project_risk_link_workorder`.
7. **BOM.** Find the item first (for example `uteamup_part_search` with `searchTerm`), then
   `uteamup_project_bom_create` with `model` `{ itemType, itemGuid, quantityRequired,
   projectStageGuid, neededDate }`; `itemType` is `StockItem`, `Chemical`, `Part`, `Tool` or
   `Asset`. Change quantities with `uteamup_project_bom_update`.
8. **Dates.** Read the current `updatedAt` (stage via `uteamup_project_stage_get`, work order
   via `uteamup_workorder_get`) and pass it as `expectedUpdatedAt` to
   `uteamup_project_timeline_stage_schedule` or `uteamup_project_timeline_workorder_schedule`.
   A stale value is rejected; re-read and show the user the new state before retrying.
9. **Budget and cost.** `uteamup_project_budget_get` for the current position. Record a manual
   cost with `uteamup_project_cost_record_create` (negative amounts are recoveries). Change the
   project budget through `uteamup_project_update` (step 11) or a change request (step 10).
10. **Controlled changes.** If the project is baselined or the user wants an approval trail:
    `uteamup_project_baselines_capture` with a `label`, then
    `uteamup_project_change_requests_create` with `model` `{ summary, reason, proposedChanges,
    requestGuid }` (`proposedChanges` holds only the changed `name`, `startDate`, `endDate`,
    `budget`, `status`, `priority` or `scope`), then `uteamup_project_change_requests_submit`. Approval and apply are the
    approver's step; do not approve the user's own request on their behalf.
11. **Project fields.** `uteamup_project_update` applies the whole model: read the project with
    `uteamup_project_get`, copy its current values, change only what the user asked, and send
    the full model. `startDate` cannot be cleared.
12. **Record decisions.** `uteamup_project_comments_add` with `model` `{ "text": "...",
    "isDecision": true }` for agreed decisions.
13. **Close out.** Advance the last stage with `uteamup_project_stage_advance` when its gate is
    met. Archive the project only when the user asks: `uteamup_project_archive`.
14. **Report back** briefly: project name and GUID, what was created or changed, and anything
    not done.

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids (`uteamup_cost_by_project` takes integer ids; do not use it).
- Before any create, update, status change or archive, show exactly what will change and get a
  clear yes. Batch related small changes into one confirmation.
- Projects are archived, never deleted: use `uteamup_project_archive`; never call
  `uteamup_project_delete`. Removing a stage, criterion, risk or BOM line
  (`uteamup_project_stage_delete`, `uteamup_project_stage_criterion_delete`,
  `uteamup_project_risk_delete`, `uteamup_project_bom_delete`) only on explicit request, after
  naming the exact line; prefer closing a risk (`Closed`) or skipping a stage (`Skipped`).
- AI tools (`uteamup_project_suggest_wbs`, `uteamup_project_suggest_risks`,
  `uteamup_project_suggest_bom`, `uteamup_project_estimate`) charge AI credits. Ask first, and
  apply only reviewed output with the matching `uteamup_project_apply_*` tool.
- Respect permission and plan errors (for example `Project.Update`, `ProjectCost.View`,
  Project Timeline feature): report them; do not retry through other tools to get around them.
- Dates are UTC ISO 8601. Convert local times and show both.
- Keep output short: at most about 10 rows per list; no raw JSON dumps.

## Not covered

- Deliverable scope intakes, requirements, process governance, schedule workspace apply,
  cost reconciliation and project sharing have MCP tools but need careful review tokens; do them
  in the UteamUP web app unless the user explicitly asks and understands the review step.
- Creating stand-alone work orders with full triage belongs to `uteamup-workorder-triage`.

## Examples

**"Set up a boiler replacement project starting 1 March, owner Jon, budget 40 000."**
1. `uteamup_user_search` `{ "searchFilter": "Jon" }` → owner GUID.
2. `uteamup_project_template_list` → none fits.
3. Confirm, then `uteamup_project_create_by_guid` `{ "name": "Boiler replacement", "startDateUtc": "2027-03-01T08:00:00Z", "ownerGuid": "<jon>", "budget": 40000, "projectProfile": "Staged" }`
4. `uteamup_project_stage_create` for "Design" (order 1), "Install" (2), "Commission" (3).

**"Add a risk that the burner arrives late, and give it to Anna."**
1. `uteamup_project_portfolio` `{ "search": "boiler" }` → project GUID.
2. `uteamup_user_search` `{ "searchFilter": "Anna" }`.
3. Confirm, then `uteamup_project_risk_create` `{ "projectGuid": "<p>", "model": { "title": "Burner delivered late", "category": "Schedule", "probability": 3, "impact": 4, "mitigationPlan": "Weekly supplier follow-up", "ownerGuid": "<anna>" } }`

**"Move the Commission stage to end on 30 April."**
1. `uteamup_project_stage_list` → stage GUID; `uteamup_project_stage_get` → `updatedAt`.
2. Confirm, then `uteamup_project_timeline_stage_schedule` `{ "projectGuid": "<p>", "stageGuid": "<s>", "model": { "startDate": "<keep>", "dueDate": "2027-04-30T16:00:00Z", "expectedUpdatedAt": "<updatedAt>" } }`
