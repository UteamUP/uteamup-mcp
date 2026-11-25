---
name: uteamup-shift-handover
description: Prepares, reviews and accepts UteamUP shift handovers between an outgoing and an incoming operator, including sections, carry-over items, links to open work orders, incidents and assets, critical-item acknowledgement and the submit-review-accept-complete lifecycle. Use when the user says things like "prepare my shift handover", "write the handover for night shift", "what is still open for the next shift", "add the pump leak as a carry-over", "show me the handover I need to accept", "review and accept the handover", "reject the handover, the safety section is empty" or "turn this carry-over into a work order".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP shift handover

A shift handover passes responsibility from the **outgoing** operator to a named
**incoming** operator. It has an overall assessment, a summary, typed **sections**
(safety briefing, equipment status, ongoing work, incidents and so on), **carry-overs**
(unfinished items with a priority, P0 most urgent) and **links** from sections or
carry-overs to work orders, assets, locations, permits, incidents, journals, projects or
documents. Linking never changes the linked record. The lifecycle is:

`draft` → (outgoing submits) `submitted` → (incoming starts review) `reviewed` →
(incoming accepts) `accepted` → (incoming completes) `completed`.
From `submitted` or `reviewed` the handover can be `rejected` with a reason; a rejected
handover can be edited and submitted again. The incoming operator can also decline a
reviewed handover. Every change is versioned and audited.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_shift_get_current` | Shift running now | `locationGuid` (optional) |
| `uteamup_shift_get_active` | Active shift definitions | – |
| `uteamup_location_list` | Find a location GUID | `search`, `page`, `pageSize` |
| `uteamup_shift_handover_get_create_options` | Pick a shift or an incoming worker by name | `kind` (`shift` or `incomingOperator`), `search`, `page`, `pageSize` |
| `uteamup_shift_handover_get_previous` | Last handover for a shift (open carry-overs) | `shiftGuid` |
| `uteamup_shift_handover_search` | Find handovers | `searchModel` (`status`, `shiftGuid`, `locationGuid`, `operatorGuid`, `fromDate`, `toDate`, `searchTerm`, `page`, `pageSize`) |
| `uteamup_shift_handover_get` | Full handover with sections, carry-overs and `concurrencyToken` | `handoverGuid` |
| `uteamup_shift_handover_get_operational_baton` | Action-first view: safety, blockers, active work, unacknowledged critical items | `handoverGuid` |
| `uteamup_shift_handover_create` | Create a draft | `model` (`shiftGuid`, `shiftDate`, `locationGuid`, `shiftInstanceGuid`, `incomingOperatorGuid`, `overallAssessment`, `summary`, `sections`) |
| `uteamup_shift_handover_update` | Change assessment, summary or incoming operator of a draft | `handoverGuid`, `concurrencyToken`, `idempotencyKey`, `overallAssessment`, `summary`, `incomingOperatorGuid` |
| `uteamup_shift_handover_create_section` | Add a section | `handoverGuid`, `model` (`sectionType`, `title`, `content`, `isRequired`, `isCritical`, `concurrencyToken`) |
| `uteamup_shift_handover_update_section` | Edit or complete a section | `handoverGuid`, `sectionGuid`, `model` (`title`, `content`, `isCompleted`, `isCritical`, `concurrencyToken`) |
| `uteamup_shift_handover_create_section_link` | Link a record to a section | `handoverGuid`, `sectionGuid`, `model` (`linkedEntityType`, `linkedEntityGuid`, `concurrencyToken`) |
| `uteamup_shift_handover_create_carry_over` | Add an unfinished item | `handoverGuid`, `model` (`description`, `priority` 0–5, `originalShiftHandoverGuid`, `concurrencyToken`) |
| `uteamup_shift_handover_update_carry_over` | Change status, priority or text | `handoverGuid`, `carryOverGuid`, `model` (`description`, `status`, `priority`, `concurrencyToken`) |
| `uteamup_shift_handover_create_carry_over_link` | Link a record to a carry-over | `handoverGuid`, `carryOverGuid`, `model` (`linkedEntityType`, `linkedEntityGuid`, `concurrencyToken`) |
| `uteamup_shift_handover_convert_carry_over_to_work_order` | Make a work order from a carry-over | `handoverGuid`, `carryOverGuid`, `concurrencyToken`, `idempotencyKey` |
| `uteamup_shift_handover_generate_summary` | AI draft of the summary (costs AI credits) | `handoverGuid`, `language`, `summaryType` (`brief`, `detailed`, `technical`) |
| `uteamup_shift_handover_submit` | Outgoing: submit draft for review | `handoverGuid`, `concurrencyToken`, `idempotencyKey` |
| `uteamup_shift_handover_start_review` | Incoming: open review | `handoverGuid`, `concurrencyToken`, `idempotencyKey` |
| `uteamup_shift_handover_acknowledge_critical_section` | Incoming: acknowledge a critical section | `handoverGuid`, `sectionGuid`, `model` (`notes`, `concurrencyToken`) |
| `uteamup_shift_handover_acknowledge_critical_carry_over` | Incoming: acknowledge a P0/P1 carry-over (stays open) | `handoverGuid`, `carryOverGuid`, `model` (`notes`, `concurrencyToken`) |
| `uteamup_shift_handover_accept` | Incoming: accept | `handoverGuid`, `concurrencyToken`, `idempotencyKey`, `notes` |
| `uteamup_shift_handover_complete` | Incoming: complete an accepted handover | `handoverGuid`, `concurrencyToken`, `idempotencyKey` |
| `uteamup_shift_handover_decline_acceptance` | Incoming: decline a reviewed handover | `handoverGuid`, `concurrencyToken`, `idempotencyKey`, `notes` |
| `uteamup_shift_handover_reject` | Send back with a reason | `handoverGuid`, `concurrencyToken`, `idempotencyKey`, `reason` |
| `uteamup_handover_attestation_issue` | Outgoing: issue an in-person transfer code | `handoverGuid` |
| `uteamup_handover_attestation_redeem_code` | Incoming: redeem the eight-digit code and open review | `code` |
| `uteamup_workorder_list` | Open work orders | `openOnly`, `search`, `assetGuid`, `page`, `pageSize` |
| `uteamup_workorder_get` | One work order | `workorderGuid` |
| `uteamup_assetfailure_get_open` | Unresolved asset failures | – |
| `uteamup_safetyincident_list` | Safety incidents | `skip`, `take`, `status` |

## Workflow

Enum values are sent as camelCase names, for example `sectionType: "safetyBriefing"`,
`linkedEntityType: "workOrder"`, `overallAssessment: "minorIssues"`, `status: "resolved"`.

**Concurrency and retries.** Every write needs the latest `concurrencyToken` (returned as
`concurrencyToken` on the handover, or `handoverConcurrencyToken` on sections, carry-overs,
links and acknowledgements). Always use the token from the most recent response. For tools
with `idempotencyKey`, create a new GUID for each intended action and reuse the same GUID
only when retrying that exact call after an uncertain result. If a call fails because the
token is stale, re-read with `uteamup_shift_handover_get` and show the user what changed.

### A. Prepare a handover (outgoing operator)
1. Find the shift: `uteamup_shift_get_current` (with `locationGuid` if the user named a
   site), or `uteamup_shift_handover_get_create_options` with `kind: "shift"`.
2. Find the incoming worker: `uteamup_shift_handover_get_create_options` with
   `kind: "incomingOperator"` and `search` = the name. Ask if several match. The incoming
   operator must be a different person from the outgoing one.
3. Check the previous handover with `uteamup_shift_handover_get_previous` (`shiftGuid`) and
   note carry-overs that are still `active` or `escalated`.
4. Gather what is open, keeping each list short (`pageSize` 10–25):
   - `uteamup_workorder_list` with `openOnly: true` (optionally `search` or `assetGuid`);
   - `uteamup_assetfailure_get_open` for unresolved equipment failures;
   - `uteamup_safetyincident_list` for recent incidents.
   Summarise counts and the few items that matter for the next shift.
5. Draft the content for the user: overall assessment, a short summary, sections (at least
   a safety briefing and ongoing work) and carry-overs with priorities. Mark sections that
   must be read as `isCritical`. Ask the user to confirm or edit.
6. Create the draft with `uteamup_shift_handover_create` (`shiftGuid`, `shiftDate`,
   `incomingOperatorGuid`, `overallAssessment`, `summary`, `sections`). Leave
   `useAIGeneration` false unless the user agreed to spend AI credits.
7. Add carry-overs with `uteamup_shift_handover_create_carry_over`, then link records with
   `uteamup_shift_handover_create_section_link` or
   `uteamup_shift_handover_create_carry_over_link` (for example `workOrder`, `asset`,
   `incident`). Use the GUIDs returned by the read tools in step 4.
8. Mark each finished section complete with `uteamup_shift_handover_update_section`
   (`isCompleted: true`). Required sections need content before they can be completed.
9. Optional: `uteamup_shift_handover_generate_summary` only after the user agrees to the
   AI credit cost. The draft it writes stays editable and is not submitted.
10. Show the final handover (`uteamup_shift_handover_get_operational_baton` is a compact
    view), get a clear yes, then call `uteamup_shift_handover_submit`.

### B. Review and accept (incoming operator)
1. Find handovers waiting for the user: `uteamup_shift_handover_search` with
   `status: "submitted"` (or `"reviewed"`) and the user's `operatorGuid` if known.
2. Read `uteamup_shift_handover_get_operational_baton` first and present safety items,
   blockers, critical items not yet acknowledged and carry-overs; then details from
   `uteamup_shift_handover_get` if the user asks.
3. Start review with `uteamup_shift_handover_start_review`. When both operators are
   together, the outgoing operator can instead call `uteamup_handover_attestation_issue`
   and the incoming operator redeems the shown code with
   `uteamup_handover_attestation_redeem_code`; this also opens review.
4. For each critical section and each P0/P1 carry-over, show it and, after the user
   confirms they have read it, acknowledge it with
   `uteamup_shift_handover_acknowledge_critical_section` or
   `uteamup_shift_handover_acknowledge_critical_carry_over`. Acceptance is refused while
   any remain.
5. Ask the user to choose: accept (`uteamup_shift_handover_accept`, optional `notes`),
   decline (`uteamup_shift_handover_decline_acceptance` with notes) or reject
   (`uteamup_shift_handover_reject` with a clear `reason`).
6. When the incoming operator has taken over, call `uteamup_shift_handover_complete`.

### C. Follow up carry-overs
- Resolve or escalate with `uteamup_shift_handover_update_carry_over` (`status`).
- To create a work order from a carry-over, confirm the description and priority, then call
  `uteamup_shift_handover_convert_carry_over_to_work_order`.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- Before any create, update, submit, accept, reject, complete, acknowledge or convert, show
  the user what will change and get a clear yes. Records are archived, never deleted.
- Only the designated incoming operator can review, acknowledge, accept, decline or
  complete. Never acknowledge a critical item or accept on the user's behalf without the
  user stating they have read it.
- Write only what the user or the source records say. Do not invent readings, statuses or
  safety facts; mark unknowns as unknown.
- AI summary generation costs AI credits. State the cost and ask first.
- Respect permission errors (`ShiftHandover.Create`, `.Update`, `.Acknowledge`, `.Reject`,
  `.Attest`). Report them; do not retry with other tools to get around them.
- Keep results short: use paging and filters; summarise, don't dump.
- If a write tool is unavailable (read-only connection), explain that writing requires the
  full UteamUP connection.

## Not available through MCP

- `uteamup_shift_handover_auto_populate`, `uteamup_shift_handover_get_comments` and
  `uteamup_shift_handover_create_comment` take a numeric handover id that the handover
  responses do not expose. Gather open work with the read tools above instead, and put
  remarks in a section, a carry-over or the reject/accept notes.
- Emergency acceptance without the incoming operator: ask the user to use the web app.

## Examples

**"Prepare my handover for the night shift, Anna takes over."**
`uteamup_shift_get_current` → `uteamup_shift_handover_get_create_options(kind: "incomingOperator", search: "Anna")`
→ `uteamup_shift_handover_get_previous(shiftGuid)` → `uteamup_workorder_list(openOnly: true, pageSize: 25)`
→ `uteamup_assetfailure_get_open` → draft shown to user → `uteamup_shift_handover_create`
→ `uteamup_shift_handover_create_carry_over` / `..._create_section_link` → user confirms
→ `uteamup_shift_handover_submit`.

**"Show me the handover I need to accept."**
`uteamup_shift_handover_search(searchModel: {status: "submitted"})` →
`uteamup_shift_handover_get_operational_baton` → `uteamup_shift_handover_start_review` →
acknowledge critical items one by one → `uteamup_shift_handover_accept`.

**"Reject it, the safety section has no content."**
`uteamup_shift_handover_get` (latest token) → confirm reason →
`uteamup_shift_handover_reject(reason: "Safety briefing section is empty.")`.
