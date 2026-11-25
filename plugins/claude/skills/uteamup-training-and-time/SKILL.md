---
name: uteamup-training-and-time
description: "Handles training and working-time topics in UteamUP through MCP: lists training events and the user's own training plan, requests enrollment, schedules and reschedules training sessions, shows enrollments and completions, reads and maintains working-time rule sets and their assignments, reads travel expense claims and checks a technician's shift schedule or current shift. Use when the user says things like: what training do I have, which certificates expire soon, sign me up for the forklift course, schedule a first-aid course next month, move the safety training to Friday, who attended the course, which working-hour rules apply, set up working-time rules for Iceland, show my travel expenses, is Anna on shift now, what is Jon's roster next week."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP training and working time

Covers the people side of maintenance work: training sessions and the caller's training plan,
working-time compliance rule sets, travel expense claims and technician shift availability.
Training events and rule sets can be created and changed after confirmation; travel expenses and
availability are read-only here. Every identifier is a public GUID.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm the active company | none |
| `uteamup_training_event_list` | All training events with dates, instructor, status, counts | none |
| `uteamup_training_event_mine` | Caller's own plan: recommended, enrolled, completed, certificate expiry | none |
| `uteamup_training_event_get` | One training event | `eventGuid` |
| `uteamup_training_event_request_enrollment` | Ask to join a session (caller only; a manager reviews) | `eventGuid` |
| `uteamup_training_event_enrollment_list` | Who is registered, waitlisted, attended, no-show | `eventGuid` |
| `uteamup_training_event_completion_list` | Completions with score and awarded certificates and skills | `eventGuid` |
| `uteamup_training_event_create` | Schedule a training event | `topic`, `startDate`, `description`, `endDate`, `instructorUserGuid`, `instructorExternalName`, `locationGuid`, `maxParticipants`, `status`, `requiredCertificateGuid`, `awardedSkillGuids`, `awardedCertificateGuids`, `categoryGuid` |
| `uteamup_training_event_update` | Reschedule or change a training event | `eventGuid` plus fields to change; `clearEndDate`, `clearInstructor`, `clearLocation`, `clearMaxParticipants`, `clearRequiredCertificate`, `clearCategory` |
| `uteamup_working_time_rule_set_list` / `uteamup_working_time_rule_set_get` | Rule sets (rest periods, max hours, overtime) | none / `ruleSetGuid` |
| `uteamup_working_time_rule_set_create` | New rule set; a country code seeds statutory rules | `name`, `countryCode` |
| `uteamup_working_time_rule_set_update` | Rename, change country, activate or deactivate | `ruleSetGuid`, `name`, `countryCode`, `isActive` |
| `uteamup_working_time_policy_assignment_list` | Which rule set applies to tenant, groups or workers | none |
| `uteamup_travel_expense_list` / `uteamup_travel_expense_get` | Expense claims and reimbursement status | `page`, `pageSize` (max 100) / `expenseGuid` |
| `uteamup_technician_availability_schedule` | A technician's shifts between two dates (max 366 days) | `userGuid`, `startDate`, `endDate` |
| `uteamup_technician_availability_current` | The shift a technician is on now, or null | `userGuid` |
| `uteamup_user_search` | Find a user GUID (instructor, technician) | `searchFilter` |
| `uteamup_location_list` | Find a training location GUID | `search`, `pageSize` |
| `uteamup_certificate_list` | Find a certificate GUID | `searchTerm`, `page`, `pageSize` |
| `uteamup_skill_list` | Find a skill GUID | `searchTerm`, `page`, `pageSize` |

Training event `status`: Scheduled (default), InProgress, Completed, Cancelled.

## Workflow

1. **Company.** Call `uteamup_tenant_get_my_tenants` if unsure. If a tool reports no tenant or the
   wrong one, list the companies and ask which to use.
2. **My training.** For "what training do I have" or "which certificates expire", call
   `uteamup_training_event_mine` and summarise enrolled, recommended and completed items and any
   certificate expiring soon. It always returns the caller's own records.
3. **Join a session.** Find the event in `uteamup_training_event_list` (match topic and date),
   check capacity and date with `uteamup_training_event_get`, confirm, then
   `uteamup_training_event_request_enrollment` (`eventGuid`). It enrols only the caller and
   creates a request a manager reviews; it cannot enrol another person.
4. **Schedule a session.** Collect topic, start and end (UTC ISO 8601), instructor (a user via
   `uteamup_user_search` as `instructorUserGuid`, or an outside trainer as
   `instructorExternalName`), location (`uteamup_location_list`), capacity, and optionally the
   certificate participants must already hold and the skills or certificates awarded on
   completion (`uteamup_certificate_list`, `uteamup_skill_list`). There is no category lookup
   tool; reuse a `categoryGuid` from an existing event read with `uteamup_training_event_get`, or
   leave it out. Check `uteamup_training_event_list` for a duplicate, show the summary, get a
   yes, then `uteamup_training_event_create`.
5. **Change a session.** Read it with `uteamup_training_event_get`, show old and new values, get a
   yes, then `uteamup_training_event_update` with only the fields that change. To remove a value
   use the matching `clear...` flag set to true. `awardedSkillGuids` and
   `awardedCertificateGuids` replace the whole list, so include the ones to keep. To cancel, set
   `status: "Cancelled"` and tell the user enrolled people should be informed.
6. **Attendance.** `uteamup_training_event_enrollment_list` and
   `uteamup_training_event_completion_list` show who registered, attended and passed. Recording
   completions is done in the web app.
7. **Working-time rules.** `uteamup_working_time_rule_set_list` (one set in detail with
   `uteamup_working_time_rule_set_get`) shows rest periods, maximum hours and overtime limits;
   `uteamup_working_time_policy_assignment_list` shows which set applies to whom. To add a set for
   a jurisdiction, confirm name and ISO country code, then `uteamup_working_time_rule_set_create`.
   To rename, change country or deactivate, read it first, then
   `uteamup_working_time_rule_set_update`: `name`, `countryCode` and `isActive` are all
   replaced, so send current values for those you keep. Editing individual rules and assigning a
   set to groups or workers is done in the web app.
8. **Travel expenses.** `uteamup_travel_expense_list` (small `pageSize`) and
   `uteamup_travel_expense_get` show amount, currency, type and reimbursement status. Submitting,
   approving or paying a claim is done in the web app.
9. **Availability.** Find the technician with `uteamup_user_search`, then
   `uteamup_technician_availability_current` (on shift now?) or
   `uteamup_technician_availability_schedule` (`startDate`, `endDate`, at most 366 days). Changing
   shifts is done in the web app.

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never guess one or use
  an integer id.
- Make sure the right company is active.
- Before any create, update or enrollment request, show what will change and get a clear yes.
  Records are archived, never deleted; cancel a training with its status instead.
- Never enrol, approve or record completion on someone else's behalf; enrollment requests are
  always for the caller.
- Dates are UTC ISO 8601. Convert local times the user gives and show both.
- Working-time rules are compliance settings: do not describe them as legal advice, and confirm
  the country code before creating a set.
- Travel expenses contain personal data; show only what the user asked for.
- Respect permission errors (for example `TrainingEvent.Create`, `WorkingTime.ConfigureRules`,
  `TravelExpense.View`, `TechnicianAvailability.View`): report them; do not retry with other tools.
- Keep results short: summarise lists, at most about 10 rows.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.

## Examples

**"Sign me up for the forklift course in June."**
`uteamup_training_event_list` → match topic and date → `uteamup_training_event_get` → confirm →
`uteamup_training_event_request_enrollment` (`eventGuid`).

**"Schedule first-aid training on 12 March 09:00–15:00 in the main office, max 12, Anna teaches."**
`uteamup_user_search` (`searchFilter: "anna"`) → `uteamup_location_list` (`search: "main"`) →
confirm → `uteamup_training_event_create` (`topic`, `startDate`, `endDate`,
`instructorUserGuid`, `locationGuid`, `maxParticipants: 12`).

**"Is Jon on shift now, and what is his roster next week?"**
`uteamup_user_search` (`searchFilter: "jon"`) → `uteamup_technician_availability_current` →
`uteamup_technician_availability_schedule` (`startDate`, `endDate`).
