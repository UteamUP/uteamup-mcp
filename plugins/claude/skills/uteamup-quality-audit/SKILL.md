---
name: uteamup-quality-audit
description: Plans and runs quality audits in UteamUP Quality Management through the UteamUP MCP server. Creates audit programmes and individual internal, supplier, process, product or system audits with frozen checklist criteria and an audit team, records competence, independence and acceptance for each auditor, evaluates checklist items during fieldwork, raises findings, links findings to NCRs and CAPAs, and moves programmes, audits and findings through their governed lifecycle with a server preview before every step. Use when the user says things like "plan the 2027 internal audit programme", "schedule a supplier audit of Acme", "set up an ISO 9001 clause 8 audit with Anna as lead auditor", "mark checklist item 4 as non-conforming", "raise a minor nonconformance finding", "link the finding to the NCR", "what audit findings are still open", "issue the audit report", or "close the finding".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP quality audit

Run the audit cycle in UteamUP: an audit programme for the period, individual audits with fixed
criteria and a competent, independent team, checklist results gathered as objective evidence,
findings with owners and due dates, and follow-up through NCRs and CAPAs. All records are
governed: every change carries an idempotency key and a concurrency token, every lifecycle step
is previewed before it is applied, and nothing is deleted.

Needs the full UteamUP connection (`/mcp`), the Quality Management feature and the user's
`Quality.View` plus audit permissions within their Quality site scope.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_quality_audit_program_search` / `_get` | Find or read a programme | `query`, `status`, `projectGuid`, `ownerUserGuid` / `programmeGuid` |
| `uteamup_quality_audit_program_create` | Create a draft programme | `request`, `idempotencyKey` |
| `uteamup_quality_audit_program_update` | Edit programme fields | `programmeGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_quality_audit_program_transition` | Submit, approve, activate, complete, cancel | `programmeGuid`, `actionKey`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_quality_audit_search` / `uteamup_quality_audit_get` | Find or read an audit (team, checklist, evidence, token) | `query`, `status`, `type`, `qualityAuditProgramGuid`, `vendorGuid`, `leadAuditorUserGuid`, `siteLocationGuid` / `auditGuid` |
| `uteamup_quality_audit_create` | Create a planned audit | `request`, `idempotencyKey` |
| `uteamup_quality_audit_update` | Edit audit fields | `auditGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_quality_audit_transition` | Approve plan, schedule, open, close fieldwork, issue report... | `auditGuid`, `actionKey`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_quality_audit_assignment_competence_verify` | Verify an auditor's competence | `auditGuid`, `assignmentGuid`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_quality_audit_assignment_independence_review` | Record independence or a conflict | same + `request.result` |
| `uteamup_quality_audit_assignment_accept` | Assignee accepts the assignment | same |
| `uteamup_quality_audit_checklist_evaluate` | Record a checklist result | `auditGuid`, `checklistItemGuid`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_quality_audit_evidence_add` | Attach an existing document version to the audit | `auditGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_quality_audit_finding_search` / `_get` | Find or read findings | `qualityAuditGuid`, `status`, `classification`, `ownerUserGuid`, `query` / `findingGuid` |
| `uteamup_quality_audit_finding_create` | Raise a draft finding | `request`, `idempotencyKey` |
| `uteamup_quality_audit_finding_update` | Edit a finding | `findingGuid`, `request`, `idempotencyKey`, `ifMatch` |
| `uteamup_quality_audit_finding_transition` | Issue, request response, verify, close... | `findingGuid`, `actionKey`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `ifMatch` |
| `uteamup_quality_audit_finding_evidence_add` | Attach evidence to a finding | `findingGuid`, `request`, `idempotencyKey`, `ifMatch` |
| `uteamup_quality_audit_finding_non_conformance_add` | Link the finding to an NCR | `findingGuid`, `nonConformanceGuid`, `request`, `idempotencyKey`, `ifMatch` |
| `uteamup_quality_audit_finding_capa_add` | Link the finding to a CAPA | `findingGuid`, `capaGuid`, `request`, `idempotencyKey`, `ifMatch` |
| `uteamup_non_conformance_search` / `uteamup_corrective_preventive_action_search` | Find the NCR or CAPA to link | `query` |
| `uteamup_checklist_list` | Source checklist for audit criteria (use its `externalGuid`) | `nameFilter`, `pageSize` |
| `uteamup_document_list` / `uteamup_document_list_versions_by_guid` | Exact document version for evidence | `page`, `pageSize` / `documentGuid` |
| `uteamup_user_search`, `uteamup_vendor_search`, `uteamup_location_list` | Team, audited supplier, site | `searchFilter` / `nameFilter` / `search` |

Lifecycle action keys, what each needs, and enum values are in `references/lifecycle.md`. Read it
before any transition.

## Workflow

1. **Check the company.** If a tool reports no tenant or wrong tenant, call
   `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect to the right company.
2. **Programme (optional).** `uteamup_quality_audit_program_search` first. To create, draft
   `title`, `objectives`, `riskBasis`, `auditUniverse`, `periodStartUtc`, `periodEndUtc`,
   `ownerUserGuid`, optional `projectGuid`; after a yes call
   `uteamup_quality_audit_program_create` with a new `idempotencyKey`. Submit and approve with
   `uteamup_quality_audit_program_transition` (preview pattern, step 7).
3. **Plan an audit.** Draft and show:
   - `title`, `type`, `scope`, `criteria` (standard and clauses), `objective`, optional
     `samplingPlan`, `auditeeName` / `auditeeUserGuid`, `scheduledStartAtUtc`,
     `scheduledEndAtUtc`, optional `qualityAuditProgramGuid`, `siteLocationGuid`.
   - Supplier audits need exactly one `vendorGuid` (via `uteamup_vendor_search`); other types
     must not have one.
   - Criteria: either `sourceCheckListGuid` (an `externalGuid` from `uteamup_checklist_list`)
     or `checklistItems` `[{ "sequence": 1, "criterionKey": "8.4.1", "question": "...",
     "requirementReference": "ISO 9001:2015 8.4.1", "evidenceRequest": "...", "isRequired":
     true }]` with unique `sequence` and `criterionKey`; `checklistRevision` starts at 1.
   - Team: `assignments` `[{ "assignedUserGuid", "role", "competenceEvidenceSummary",
     "conflictDeclaration" }]`, one `LeadAuditor`.
   After a yes, `uteamup_quality_audit_create` with a new `idempotencyKey`.
4. **Prepare the team.** For each assignment (GUIDs from `uteamup_quality_audit_get`):
   `uteamup_quality_audit_assignment_competence_verify` and
   `uteamup_quality_audit_assignment_independence_review` (`request.result` `Independent` or
   `ConflictDetected`, plus `conflictDeclaration`) are done by the reviewer;
   `uteamup_quality_audit_assignment_accept` must be done by the assigned person themselves.
   Each request carries `attestationText` and optional `evidenceGuids`. Then transition the
   audit: `quality-audit.approve-plan`, `quality-audit.schedule`,
   `quality-audit.accept-assignments`, `quality-audit.open`.
5. **Fieldwork.** For each checklist item: `uteamup_quality_audit_checklist_evaluate` with
   `checklistItemGuid` and `request` `{ "result", "evidenceSummary", "evidenceGuids" }`. Attach
   documents first with `uteamup_quality_audit_evidence_add` (`request` `{ "evidence": {
   "documentGuid", "documentVersionGuid", "purpose", "captureSource": "ExistingDocument",
   "confidentialityClassification": "Internal" }, "reason" }`); take the returned evidence link
   GUIDs for `evidenceGuids`.
6. **Findings.** For each nonconforming or notable item, draft `title`, `classification`,
   `objectiveEvidence`, `requirementReference`, `ownerUserGuid`, `dueAtUtc`,
   `qualityAuditGuid`, optional `qualityAuditChecklistItemGuid`; after a yes call
   `uteamup_quality_audit_finding_create`. Issue it (`quality-audit-finding.issue`) and request a
   response. For a nonconformance that needs disposition, find or raise the NCR (see
   `uteamup-quality-ncr-capa`) and link it with
   `uteamup_quality_audit_finding_non_conformance_add` (`request` `{ "reason" }`); link a CAPA
   with `uteamup_quality_audit_finding_capa_add`.
7. **Every transition** (programme, audit, assignment operation, checklist evaluation, finding):
   a. Read the record for its current status and token (`concurrencyToken`; findings call it
      `ifMatch`).
   b. Preview: call the transition tool with `actionKey` (if any), `request`, a new
      `idempotencyKey`, `confirmed` false.
   c. Show the preview summary and any blocked reason; wait for a clear yes.
   d. Apply: same call, same `idempotencyKey` and `request`, `confirmed` true, with the
      `previewToken` and the concurrency token returned by the preview. On a stale or expired
      error, go back to a.
8. **Report and close.** `quality-audit.close-fieldwork`, then `quality-audit.issue-report`
   (or `issue-report-no-follow-up` when there are no findings needing follow-up) with
   `reportSummary`. Close with `quality-audit.verify-follow-up` once all findings are closed.
9. **Report back** with audit display number, status, findings by classification, and what is
   waiting on whom.

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids (`uteamup_checklist_get` uses legacy integer ids; do not use it).
- Before any create, update, evaluation, link or transition, show exactly what will change and
  get a clear yes. Governed steps always go preview first, then apply.
- Never fabricate `previewToken`, concurrency tokens or evidence GUIDs; take them from the latest
  response. Use a new `idempotencyKey` per operation; reuse it only to retry the identical call.
- Independence is enforced by the server: the person who audited cannot verify the follow-up,
  and an assignee accepts their own assignment. If refused, say who must act; do not try other
  tools.
- Records are never deleted; use `cancel` or `abort`. Removing an assignment
  (`uteamup_quality_audit_assignment_remove`) or revoking evidence/links
  (`uteamup_quality_audit_evidence_revoke`, `uteamup_quality_audit_finding_evidence_revoke`,
  `uteamup_quality_audit_finding_non_conformance_revoke`,
  `uteamup_quality_audit_finding_capa_revoke`) only on explicit request, with a `reason`,
  preview first; history stays retained.
- Classify findings from the evidence the user gives. Suggest a classification, label it as a
  suggestion, and record only what the user confirms.
- Respect permission and site-scope errors: report them, do not retry around them.
- Keep output short: at most about 10 rows per list; no raw JSON dumps.

## Not covered

- Uploading new files: do it in the web or mobile app, then attach the version here.
- NCR disposition and CAPA execution: use `uteamup-quality-ncr-capa`.

## Examples

**"What audit findings are still open?"**
1. `uteamup_quality_audit_finding_search` `{ "status": "Open", "pageSize": 25 }` and again with `"ResponseDue"`.
2. Table: number, title, classification, owner, due date, audit.

**"Schedule a supplier audit of Acme for 10-11 March, Anna leads."**
1. `uteamup_vendor_search` `{ "nameFilter": "Acme" }`, `uteamup_user_search` `{ "searchFilter": "Anna" }`, `uteamup_checklist_list` `{ "nameFilter": "supplier audit" }`.
2. Confirm, then `uteamup_quality_audit_create` `{ "idempotencyKey": "<k>", "request": { "title": "Acme supplier audit 2027", "type": "Supplier", "vendorGuid": "<acme>", "scope": "...", "criteria": "ISO 9001:2015 clause 8", "objective": "...", "scheduledStartAtUtc": "2027-03-10T08:00:00Z", "scheduledEndAtUtc": "2027-03-11T16:00:00Z", "sourceCheckListGuid": "<cl>", "checklistRevision": 1, "assignments": [{ "assignedUserGuid": "<anna>", "role": "LeadAuditor", "competenceEvidenceSummary": "Lead auditor certificate 2025" }] } }`

**"Item 4 is non-conforming: no calibration record for torque wrench TW-12."**
1. `uteamup_quality_audit_get` → `checklistItemGuid` and `concurrencyToken`.
2. Preview `uteamup_quality_audit_checklist_evaluate` `{ "auditGuid": "<a>", "checklistItemGuid": "<i>", "request": { "result": "NonConforming", "evidenceSummary": "No calibration record for TW-12" }, "idempotencyKey": "<k>", "confirmed": false }`; on yes apply with `previewToken` and `concurrencyToken`.
3. Offer a `MinorNonConformance` finding via `uteamup_quality_audit_finding_create`.
