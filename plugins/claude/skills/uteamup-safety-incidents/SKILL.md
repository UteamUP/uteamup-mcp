---
name: uteamup-safety-incidents
description: Records and follows up workplace safety incidents in UteamUP - drafts an incident with location, time and per-person work impact, adds injured people, links legal, insurer, witness or physician contacts, records the human recordability decision, prepares OSHA ITA export files, starts a root cause analysis with corrective actions, and checks equipment-safety snapshots and biosecurity clearance on a work order. Use when the user says things like "report an injury at the warehouse", "log a near miss from this morning", "add the second injured worker", "attach the insurer to incident 42", "is this case recordable", "prepare the OSHA 300A file for last year", "start a root cause analysis for the forklift incident", "show the safety notes for this work order" or "am I cleared to enter the biosecure site for this job".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP safety incidents

A **safety incident** is a workplace injury or illness case at an establishment
(location). It starts as a **draft**; recordability (OSHA 1904) stays unset until a person
with the right permission **classifies** it. One event with several injured people is a
group of cases that share an event GUID. Incidents can carry contacts (legal, insurer,
witness, physician, other), legal review reports and per-person work impact (days away,
restricted duty, return dates). UteamUP prepares records and export files; the employer
files them. Separately, work orders carry **equipment-safety snapshots** per asset that a
named worker confirms they have read, and a **biosecurity status** that says whether the
worker may enter the work order's site.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_location_list` | Find the establishment location GUID | `search`, `page`, `pageSize` |
| `uteamup_user_search` | Find an employee's user GUID | `searchFilter` |
| `uteamup_contact_list` | Find a contact GUID | `page`, `pageSize` |
| `uteamup_safetyincident_list` | List incidents | `skip`, `take`, `status` (`draft`, `submitted`, `underInvestigation`, `classified`, `closed`) |
| `uteamup_safetyincident_get` | One incident in full | `incidentGuid` |
| `uteamup_safetyincident_group_get` | All person cases for one event | `eventGroupGuid` |
| `uteamup_safetyincident_create` | Create a draft incident | `incidentAt` (UTC), `locationGuid`, `whatHappened`, `workImpacts` |
| `uteamup_safetyincident_group_create` | One event with 2–50 injured people | `model.cases` (list of case models) |
| `uteamup_safetyincident_person_add` | Add an injured person to an event | `incidentGuid`, `model` |
| `uteamup_safetyincident_classify` | Human recordability decision | `incidentGuid`, `isRecordable`, `reason` |
| `uteamup_safetyincident_contacts_list` / `uteamup_safetyincident_contacts_link` / `uteamup_safetyincident_contacts_unlink` | Contacts on an incident | `incidentGuid`, `contactGuid`, `role`, `note` / `linkGuid` |
| `uteamup_safetyincident_legalreport_list` / `uteamup_safetyincident_legalreport_create` | Legal review reports | `incidentGuid`, `title`, `bodyHtml`, `wasAiDrafted` |
| `uteamup_safetyincident_legalreport_draft` | UPMate draft of a legal review (saves nothing, costs AI credits) | `incidentGuid` |
| `uteamup_osha_ita_export` | Prepare OSHA ITA 300A (and 300/301) CSV | `yearFilingFor`, `einNumber`, `einAttested`, `includeCases` |
| `uteamup_emergencycontact_list_for_user` | A worker's emergency contacts (read is logged and shown to them) | `userGuid`, `reason` |
| `uteamup_rca_create` / `uteamup_rca_get` / `uteamup_rca_list` | Root cause analysis | `model` (`title`, `problemStatement`, `description`, `severity`, `linkedEntityType`, `linkedEntityGuid`) / `rcaGuid` / `status` |
| `uteamup_rca_add_step` / `uteamup_rca_add_action` / `uteamup_rca_complete` | 5 Whys steps, corrective actions, close-out | `rcaGuid`, `question`, `answer` / `actionType`, `description`, `assignedToUserGuid`, `dueDate` / `rootCause` |
| `uteamup_workorder_search` / `uteamup_workorder_get` | Find the related work order | `searchFilter` / `workorderGuid` |
| `uteamup_workorder_create` | Work order for a corrective task | `title`, `description`, `startUtc`, `dueUtc`, `idempotencyKey`, `priority` 1–5, `assetGuid`, `primaryAssigneeGuid` |
| `uteamup_workorder_asset_safety_get` | Equipment-safety snapshots on a work order | `workorderGuid` |
| `uteamup_workorder_asset_safety_capture` | Capture missing snapshots on a new generated work order | `workorderGuid` |
| `uteamup_workorder_asset_safety_acknowledge` / `uteamup_workorder_asset_safety_acknowledge_batch` | Record that the person read exact snapshots | `workorderGuid`, `assetGuid`, `snapshotGuid` / `items` (list of `{assetGuid, snapshotGuid}`) |
| `uteamup_biosecurity_status` | Is the user cleared for the work order's site | `workorderGuid` |

## Workflow

### A. Record a new incident
1. Collect the facts from the user: when (convert to UTC and say so), where (find the
   `locationGuid` with `uteamup_location_list`), what happened, who was hurt and how
   their work is affected. Do not fill gaps with guesses; leave unknown fields empty.
2. For employees, find each user GUID with `uteamup_user_search`. For non-employees
   (visitors, contractors) use the name only.
3. Show the draft back to the user. After a clear yes:
   - one person: `uteamup_safetyincident_create` (`incidentAt`, `locationGuid`,
     `whatHappened`, `workImpacts` as a list of `{personUserGuid or personName, status,
     firstDayAway, expectedReturnDate, timeAwayAmount, timeAwayUnit}`); `status` is
     `unknown`, `noTimeAway`, `awayFromWork`, `workingRestrictedDuties` or
     `returnedToFullDuties`;
   - two or more people: `uteamup_safetyincident_group_create` with one case per person
     (`incidentAt`, `locationGuid`, `whatHappened`, `injuredUserGuid` or
     `injuredPersonName`, `injuryOrIllness`, `assetGuid`, `workorderGuid`,
     `workPermitGuid` as known).
4. Report the incident number and GUID. Recordability stays unset.

### B. Follow up an incident
1. Find it: `uteamup_safetyincident_list` (`status`, `take` 25), then
   `uteamup_safetyincident_get`. For grouped events use
   `uteamup_safetyincident_group_get`.
2. Another injured person: `uteamup_safetyincident_person_add` after a yes.
3. Contacts: find the contact GUID with `uteamup_contact_list`, then
   `uteamup_safetyincident_contacts_link` (`role`: `legal`, `insurer`, `witness`,
   `physician` or `other`). Unlink uses the `linkGuid` from
   `uteamup_safetyincident_contacts_list`, not the contact GUID.
4. Recordability: present the facts the user needs (treatment, days away, restricted
   duty) and let the user decide. Call `uteamup_safetyincident_classify` only with the
   user's explicit decision and their reason.
5. Legal review: `uteamup_safetyincident_legalreport_draft` costs AI credits and saves
   nothing; state the cost and ask first. Save the text the user approves with
   `uteamup_safetyincident_legalreport_create` (`wasAiDrafted: true` if it started as a
   draft).
6. Root cause and corrective actions: `uteamup_rca_create` (`linkedEntityType`
   `"WorkOrder"` or `"Asset"` with the matching GUID when the incident involves one), add
   5 Whys steps with `uteamup_rca_add_step`, corrective or preventive actions with
   `uteamup_rca_add_action` (`actionType` `Corrective`, `Preventive` or `Detective`), and
   close with `uteamup_rca_complete`. When a physical fix is needed, offer
   `uteamup_workorder_create` (new GUID as `idempotencyKey`, `priority` 1 low to 5
   critical).
7. Year-end filing: `uteamup_osha_ita_export` (`yearFilingFor`). Only pass `einNumber`
   with `einAttested: true` when the user states the EIN and attests it. Remind the user
   that they file; UteamUP does not.

### C. Equipment safety and biosecurity on a work order
1. `uteamup_workorder_asset_safety_get` (`workorderGuid`) and present each asset's
   safety snapshot in full.
2. If a newly generated work order has missing snapshots, offer
   `uteamup_workorder_asset_safety_capture` after a yes.
3. Only after the signed-in person says they have read specific snapshots, record it with
   `uteamup_workorder_asset_safety_acknowledge` (one) or
   `uteamup_workorder_asset_safety_acknowledge_batch` (up to 100). A stale snapshot
   rejects the whole batch: re-read and show the new text.
4. `uteamup_biosecurity_status` tells whether the site is a biosecurity zone (none, warn,
   block) and whether the user holds a valid entry declaration. If not cleared, tell the
   user to complete the entry declaration before going on site.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- Before any create, add, link, unlink, classify, report, RCA change, capture or
  acknowledgement, show the user what will change and get a clear yes. Records are
  archived, never deleted.
- Never decide recordability, never acknowledge a safety snapshot and never attest an EIN
  for the user. These are human decisions recorded with the user's own words.
- Record only facts the user or source records give. Do not invent injuries, causes,
  witnesses or return dates; mark unknowns as unknown.
- Injury details, emergency contacts and privacy cases are sensitive. Read emergency
  contacts only for a stated reason (the read is logged and shown to the worker), keep
  names out of summaries for people without a need to know, and never paste them into
  other records.
- AI drafting (`uteamup_safetyincident_legalreport_draft`) costs AI credits. State the cost
  and ask first.
- Respect permission errors (`SafetyIncident.Create`, `.Update`, `.Classify`,
  `.LegalReview`, `.Export`, `WorkOrder.Update`). Report them; do not retry with other
  tools to get around them.
- Keep results short: use `take` and status filters; summarise, don't dump. An unknown
  `status` value is ignored and returns all incidents, so use the values listed above.
- If a write tool is unavailable (read-only connection), explain that writing requires the
  full UteamUP connection.

## Not available through MCP

- Editing an incident's narrative, changing its status (submit, investigate, close) and
  attaching photos or documents to it: ask the user to do this in the web app.
- Linking an existing root cause analysis to an incident after creation: the single
  incident tool does not accept it. Reference the incident number in the RCA title or
  problem statement instead.

## Examples

**"Log an injury: Jon cut his hand on the bandsaw in the workshop at 09:40 today."**
`uteamup_location_list(search: "workshop")` → `uteamup_user_search(searchFilter: "Jon")` →
draft shown → `uteamup_safetyincident_create(incidentAt, locationGuid, whatHappened,
workImpacts: [{personUserGuid, status: "unknown"}])`.

**"The doctor says it is not recordable, first aid only."**
`uteamup_safetyincident_list(status: "draft")` → `uteamup_safetyincident_get` → confirm →
`uteamup_safetyincident_classify(isRecordable: false, reason: "First aid only per physician.")`.

**"Show me the safety notes for this pump job and mark them read."**
`uteamup_workorder_search` → `uteamup_workorder_asset_safety_get` → present snapshots → user
confirms reading → `uteamup_workorder_asset_safety_acknowledge_batch(items)`.
