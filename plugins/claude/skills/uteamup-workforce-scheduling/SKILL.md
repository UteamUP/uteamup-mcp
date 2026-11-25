---
name: uteamup-workforce-scheduling
description: Plans and changes who works when in UteamUP - finds qualified and available technicians for a work order, books, moves and cancels schedule assignments, builds and publishes weekly schedule drafts, generates shift instances and assigns people to shifts, records absence, and manages workforce groups and the user's own skills. Use when the user says things like "who can take this work order on Thursday", "assign Anna to the pump repair", "move the booking to tomorrow morning", "show next week's schedule for the mechanical team", "build and publish the schedule for week 12", "put Jon on the night shift", "Maria is sick today", "who is available tomorrow with welding skills" or "add Lars to the electrical group".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP workforce scheduling

UteamUP plans people in three connected layers. **Schedule assignments** (bookings) put
one technician on one work order for a time window. **Shifts** are shift definitions
(for example "Night"); **shift instances** are the dated occurrences, and **shift user
assignments** put a person on an instance inside a **workforce group** (a crew such as
"Electrical"). **Schedule drafts** collect shift and work-order entries for one ISO week;
they are validated and then **published** as immutable versions that can be diffed,
recalled or rolled back. Availability comes from shifts, bookings and approved absence.
Every booking and publish is rechecked on the server for tenant membership, qualification,
availability and conflicts.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_user_search` | Find a person and their user GUID | `searchFilter` |
| `uteamup_team_list` / `uteamup_team_members` | Teams and their members | `page`, `pageSize` / `teamGuid` |
| `uteamup_workorder_search` / `uteamup_workorder_get` | Find the work order | `searchFilter` / `workorderGuid` |
| `uteamup_schedule_assignment_get_week_by_guid` | Week view: technicians, bookings, unassigned work orders | `weekStart` (UTC), `teamGuid` |
| `uteamup_schedule_get_team_schedule` / `uteamup_schedule_get_my_schedule` | Team or own schedule for a range | `teamGuid`, `startDate`, `endDate` (YYYY-MM-DD) |
| `uteamup_schedule_assignment_get_workorder_options` | Ranked qualified, available technicians for a window | `workorderGuid`, `plannedStartUtc`, `plannedEndUtc` |
| `uteamup_workforce_rank_technicians_for_work_order` / `uteamup_workforce_suggest_assignment` | Ranking or single suggestion for a work order | `workorderGuid` |
| `uteamup_workforce_get_available_technicians` | Who is free on a date, optionally with skills | `date`, `requiredSkillGuids`, `requiredCertificateGuids`, `teamGuid` |
| `uteamup_workforce_check_technician_availability` | One person's availability on a date | `technicianUserGuid`, `dateStr` |
| `uteamup_workforce_availability_check` | Every blocking or advisory interval for a worker | `workerGuid`, `fromUtc`, `toUtc` |
| `uteamup_workforce_get_capacity` | Available vs scheduled hours for a team | `teamGuid`, `startDate`, `endDate` |
| `uteamup_workforce_suggest_week_plan` | Proposed plan for a team week (no writes) | `teamGuid`, `weekStartDate` |
| `uteamup_workforce_explain_assignment` | Why a booking was made | `assignmentGuid` |
| `uteamup_schedule_assignment_create_by_guid` | Book a technician on a work order | `workorderGuid`, `technicianGuid`, `plannedStartUtc`, `plannedEndUtc` |
| `uteamup_schedule_assignment_move_by_guid` | Move or reassign a booking | `assignmentGuid`, `newScheduledStart`, `newScheduledEnd`, `newTechnicianGuid` |
| `uteamup_schedule_assignment_update_status_by_guid` | Change booking status | `assignmentGuid`, `status` |
| `uteamup_schedule_assignment_cancel_by_guid` | Cancel a booking (audit kept) | `assignmentGuid` |
| `uteamup_workforce_assign_work_order` | Set the work order's assignee (no time booking) | `workOrderGuid`, `assigneeUserGuid` |
| `uteamup_schedule_emergency_insertion_preview` | Least-disruptive slot for urgent work (no writes) | `idempotencyKey`, `workorderGuid`, `desiredStartUtc`, `teamGuid`, `technicianGuids` |
| `uteamup_schedule_draft_list` / `uteamup_schedule_draft_get` | Weekly drafts and their entries | `weekStart` / `draftGuid` |
| `uteamup_schedule_draft_create` | New draft for a week, optionally from a publication | `weekStart`, `basePublicationGuid` |
| `uteamup_schedule_draft_entry_add` / `uteamup_schedule_draft_entry_update` / `uteamup_schedule_draft_entry_delete` | Edit draft entries | `draftGuid`, `entryGuid`, `expectedRowVersion`, `kind`, `startUtc`, `endUtc`, `workers`, `shiftGuid`, `workorderGuid`, `workforceGroupGuid`, `locationGuid` |
| `uteamup_schedule_draft_validate` | Check a draft before publishing | `draftGuid` |
| `uteamup_schedule_draft_publish` | Publish a validated draft | `draftGuid`, `expectedRowVersion`, `acknowledgedWarningCodes`, `overrideReason` |
| `uteamup_schedule_publication_history` / `uteamup_schedule_publication_get` / `uteamup_schedule_publication_diff` | Published versions and differences | `weekStart` / `publicationGuid` / `fromPublicationGuid`, `toPublicationGuid` |
| `uteamup_schedule_publication_recall` / `uteamup_schedule_publication_rollback` | Recall future work or restore an older version | `publicationGuid`, `reason` |
| `uteamup_shift_list` / `uteamup_shift_get_calendar` | Shift definitions and calendar | – / `fromDate`, `toDate`, `locationGuid` |
| `uteamup_shift_instance_get_by_range` / `uteamup_shift_instance_get` | Dated shift instances with assignments | `dateFrom`, `dateTo`, `shiftGuid` / `instanceGuid` |
| `uteamup_shift_instance_generate` | Create instances of a shift for a date range | `shiftGuid`, `dateFrom`, `dateTo`, `publishImmediately`, `skipExisting` |
| `uteamup_shift_instance_set_status` | Draft, Published, InProgress, Completed, Cancelled | `instanceGuid`, `status` |
| `uteamup_shift_user_assignment_get_by_instance` | Who is on a shift instance | `instanceGuid` |
| `uteamup_shift_user_assignment_create` / `uteamup_shift_user_assignment_update` | Put a person on a shift instance | `model` (`shiftInstanceGuid`, `userGuid`, `workforceGroupGuid`, `status`, `isOptional`, `notes`) / `assignmentGuid`, `model` |
| `uteamup_shift_user_assignment_mark_unavailable` | Person cannot work an assigned shift (suggests replacement) | `assignmentGuid`, `reason` |
| `uteamup_shift_user_assignment_mine` / `uteamup_shift_user_assignment_confirm_mine` / `uteamup_shift_user_assignment_decline_mine` | The user's own shifts | `dateFrom`, `dateTo` / `assignmentGuid`, `reason` |
| `uteamup_workforce_absence_report` | Absence over a date range | `query` (`from`, `to`, `userGuid`, `groupGuid`, `locationGuid`, `category`, `page`, `pageSize`) |
| `uteamup_workforce_absence_create` | Request absence (never auto-approved) | `model` (`userGuid`, `startDate`, `endDate` exclusive, `overrideType`, `minutesPerDay`, `reason`) |
| `uteamup_workforce_absence_decide` | Approve or reject a whole absence | `overrideGuid`, `approved`, `expectedUpdatedAt` |
| `uteamup_workforce_group_list` / `uteamup_workforce_group_get` / `uteamup_workforce_group_get_members` | Workforce groups and members | `groupGuid` |
| `uteamup_workforce_group_create` / `uteamup_workforce_group_update` | Create or change a group | `model` (`name`, `description`, `defaultLocationGuid`, `defaultCustomerGuid`, `isActive`) |
| `uteamup_workforce_group_add_member` / `uteamup_workforce_group_remove_member` | Add a user or team; remove a membership | `model` (`workforceGroupGuid`, `userGuid` or `teamGuid`, `role`) / `memberGuid` |
| `uteamup_workforce_group_delete` | Archive (mark inactive) a group | `groupGuid` |
| `uteamup_skill_list` | Skill catalog (use `externalGuid`) | `searchTerm`, `category`, `page`, `pageSize` |
| `uteamup_my_skill_add` / `uteamup_my_skill_update` | Add or update the signed-in user's own skill | `model` (`skillGuid`, `proficiencyLevel` 1–5, `yearsOfExperience`, `notes`) / `userSkillGuid`, `model` |

## Workflow

Dates: tools typed as a date string take `YYYY-MM-DD`; tools typed as a time take ISO 8601
UTC (for example `2026-03-12T07:00:00Z`). Convert the user's local time and say which
time zone you assumed. Enum values are camelCase names (`status: "onHold"`,
`kind: "workorder"`, `overrideType: "sick"`, `role: "lead"`).

### A. Assign a technician to a work order
1. Find the work order (`uteamup_workorder_search`, then `uteamup_workorder_get`) and
   agree the time window with the user.
2. Get candidates with `uteamup_schedule_assignment_get_workorder_options`
   (`workorderGuid`, `plannedStartUtc`, `plannedEndUtc`). Show the top three with their
   qualification, availability and workload evidence. If the user named a person, find
   them with `uteamup_user_search` and check them with
   `uteamup_workforce_availability_check`.
3. After a clear yes, book with `uteamup_schedule_assignment_create_by_guid`. If the user
   only wants to set the responsible person without a time slot, use
   `uteamup_workforce_assign_work_order` instead.
4. If the server reports a conflict or missing qualification, show the reason; do not
   retry with another tool to force the booking.

### B. Change or cancel a booking
1. Read the week with `uteamup_schedule_assignment_get_week_by_guid` (or the team
   schedule) to find the `assignmentGuid`.
2. Show the current and new time or technician, get a yes, then call
   `uteamup_schedule_assignment_move_by_guid`, `..._update_status_by_guid` or
   `..._cancel_by_guid`. Use `uteamup_workforce_explain_assignment` when the user asks why
   a booking exists.
3. For urgent work, run `uteamup_schedule_emergency_insertion_preview` (new GUID as
   `idempotencyKey`), show which bookings would be displaced, and only then book or move.

### C. Build and publish a weekly schedule
1. `uteamup_schedule_draft_list` (`weekStart`) to reuse an open draft; otherwise
   `uteamup_schedule_draft_create`, optionally from the latest publication found with
   `uteamup_schedule_publication_history`.
2. Optional: `uteamup_workforce_suggest_week_plan` and `uteamup_workforce_get_capacity`
   to propose entries. Present the proposal; nothing is written by these tools.
3. Add entries with `uteamup_schedule_draft_entry_add` (`kind` `shift` or `workorder`,
   `workers` as a list of `{workerGuid, allocationPercent}`). Edits and removals need the
   entry's current `expectedRowVersion` from `uteamup_schedule_draft_get`.
4. `uteamup_schedule_draft_validate`. Show blocking errors and warnings in plain words.
5. After the user confirms, `uteamup_schedule_draft_publish` with the draft's
   `expectedRowVersion`. Pass `acknowledgedWarningCodes` only for warnings the user
   explicitly accepted, and an `overrideReason` when one is required.
6. To compare or undo: `uteamup_schedule_publication_diff`, then
   `uteamup_schedule_publication_recall` or `..._rollback` with a reason, after a yes.

### D. Shifts and shift staffing
1. `uteamup_shift_list` for the `shiftGuid`; `uteamup_shift_instance_get_by_range` for the
   dated instances. If none exist, offer `uteamup_shift_instance_generate`.
2. `uteamup_workforce_group_list` for the `workforceGroupGuid`, then
   `uteamup_shift_user_assignment_create`. Check the person first with
   `uteamup_workforce_check_technician_availability`.
3. When someone cannot work, `uteamup_shift_user_assignment_mark_unavailable` with the
   reason and present the replacement suggestion it returns.
4. A worker managing their own shifts uses `uteamup_shift_user_assignment_mine`,
   `..._confirm_mine` and `..._decline_mine`.

### E. Absence
1. `uteamup_workforce_absence_report` for the period to see existing absence.
2. `uteamup_workforce_absence_create`: `endDate` is exclusive (a one-day absence on 12
   March is `startDate` 2026-03-12, `endDate` 2026-03-13). It creates a request only.
3. A manager approves or rejects the whole absence with `uteamup_workforce_absence_decide`
   using the `updatedAt` value from the latest read as `expectedUpdatedAt`.

### F. Groups and skills
- Create or change groups and members with the `uteamup_workforce_group_*` tools after a
  yes. A member is exactly one user or one team. Removing a group archives it.
- Find skill GUIDs with `uteamup_skill_list` (`externalGuid`) and use them as
  `requiredSkillGuids` when looking for available technicians.
- `uteamup_my_skill_add` and `uteamup_my_skill_update` only change the signed-in user's
  own profile.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- Before any booking, move, cancel, publish, recall, rollback, shift assignment, absence
  decision or group change, show the user exactly what will change and get a clear yes.
  Records are archived or cancelled with audit, never deleted.
- Never acknowledge publish warnings, override qualification checks or approve absence on
  the user's behalf. Pass only what the user stated.
- Health and absence reasons are personal data: show them only to users who asked and
  have access, and do not repeat them in summaries for others.
- Suggestion, ranking, capacity and preview tools are deterministic and do not write or
  spend AI credits; still present them as proposals, not decisions.
- Respect permission errors (for example `Schedule.Manage`, `Schedule.View.Team`,
  `ShiftUserAssignment.Create`, `AvailabilityOverride.Approve`). Report them; do not retry
  with other tools to get around them.
- Keep results short: use date ranges, team filters and paging; summarise, don't dump.
- If a write tool is unavailable (read-only connection), explain that writing requires the
  full UteamUP connection.

## Not available through MCP

- Assigning catalog skills to other people and finding people by skill use integer ids in
  the current MCP tools (`uteamup_user_skill_add`, `uteamup_users_by_skill_get`); do not
  use them. Ask the user to do this in the web app, or filter candidates with
  `requiredSkillGuids` instead.
- The older integer-keyed scheduling tools (`uteamup_schedule_assignment_create`,
  `uteamup_schedule_assignment_auto_assign`, `uteamup_schedule_assignment_get_week_schedule`,
  `uteamup_schedule_assignment_get_unassigned_work_orders`) are superseded by the GUID tools
  above; do not use them.

## Examples

**"Who can do the conveyor repair on Thursday morning? Book the best one."**
`uteamup_workorder_search(searchFilter: "conveyor")` →
`uteamup_schedule_assignment_get_workorder_options(workorderGuid, plannedStartUtc, plannedEndUtc)`
→ show top three → user picks → `uteamup_schedule_assignment_create_by_guid`.

**"Maria is sick today, take her off the day shift."**
`uteamup_user_search(searchFilter: "Maria")` → `uteamup_shift_instance_get_by_range` →
`uteamup_shift_user_assignment_get_by_instance` → confirm →
`uteamup_shift_user_assignment_mark_unavailable(reason: "Sick")` →
`uteamup_workforce_absence_create(model: {userGuid, startDate, endDate, overrideType: "sick"})`.

**"Publish next week's schedule for the mechanical team."**
`uteamup_schedule_draft_list(weekStart)` → `uteamup_schedule_draft_get` →
`uteamup_schedule_draft_validate` → show issues → user confirms →
`uteamup_schedule_draft_publish(draftGuid, expectedRowVersion)`.
