---
name: uteamup-quality-ncr-capa
description: Manages nonconformance reports (NCRs) and corrective and preventive actions (CAPAs) in UteamUP Quality Management through the UteamUP MCP server. Searches existing NCRs and CAPAs, raises a draft NCR linked to the affected asset, work order, part, vendor or project, attaches existing documents as evidence, moves records through their governed lifecycle with a server preview before every transition, opens a CAPA from one or more NCRs, and runs the CAPA's implementation actions. Use when the user says things like "raise an NCR for the wrong torque on line 2", "log a nonconformance against supplier X", "what NCRs are open", "submit the NCR", "move the NCR to containment", "record the disposition as rework", "open a CAPA for these NCRs", "add an action to the CAPA for Anna", "close the CAPA as effective", or "link the NCR to the pump work order".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP NCR and CAPA

Record what did not meet a requirement (NCR), contain it, decide what to do with it, and when the
cause is systemic, fix it for good with a CAPA. Both records are governed: the server owns status,
reporter and audit trail, every change carries an idempotency key and a concurrency token, and
every lifecycle step is previewed before it is applied. Records are never deleted.

Needs the full UteamUP connection (`/mcp`), the Quality Management feature, and the user's
`Quality.View` plus `NonConformance.*` / `CAPA.*` permissions within their Quality site scope.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_non_conformance_search` | Find NCRs | `query`, `status`, `severity`, `riskLevel`, `owningSiteLocationGuid`, `page`, `pageSize` |
| `uteamup_non_conformance_get` | NCR detail, evidence, `transitionAvailability`, `concurrencyToken` | `nonConformanceGuid` |
| `uteamup_non_conformance_create` | Create a draft NCR | `request`, `idempotencyKey` |
| `uteamup_non_conformance_update` | Edit NCR fields | `nonConformanceGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_non_conformance_transition` | Preview, then apply one lifecycle action | `nonConformanceGuid`, `actionKey`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_non_conformance_evidence_add` | Attach an existing document version | `nonConformanceGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_non_conformance_link_add` | Link an asset, work order, part, vendor, RCA... | `nonConformanceGuid`, `linkKind`, `targetGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_corrective_preventive_action_search` | Find CAPAs | `query`, `status`, `type`, `initialRiskLevel`, `ownerUserGuid`, `page`, `pageSize` |
| `uteamup_corrective_preventive_action_get` | CAPA detail and `concurrencyToken` | `correctivePreventiveActionGuid` |
| `uteamup_corrective_preventive_action_create` | Create a draft CAPA | `request`, `idempotencyKey` |
| `uteamup_corrective_preventive_action_update` | Edit CAPA plan fields | `correctivePreventiveActionGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_corrective_preventive_action_transition` | Preview, then apply one CAPA action | `correctivePreventiveActionGuid`, `actionKey`, `request`, `idempotencyKey`, `confirmed`, `previewToken`, `concurrencyToken` |
| `uteamup_corrective_preventive_action_evidence_add` | Attach evidence to a CAPA | `correctivePreventiveActionGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_corrective_preventive_action_source_non_conformance_add` | Add a source NCR to a CAPA | `correctivePreventiveActionGuid`, `nonConformanceGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_capa_project_references` | Find the improvement project a CAPA belongs to | `query`, `limit` |
| `uteamup_capa_project_from_rca` | Create an improvement project from a completed RCA | `rcaGuid`, `requestGuid`, `title` |
| `uteamup_capa_implementation_get` | CAPA implementation project and actions | `correctivePreventiveActionGuid` |
| `uteamup_capa_implementation_execute` | Create/update/complete actions, start/complete project | `correctivePreventiveActionGuid`, `request`, `idempotencyKey`, `concurrencyToken` |
| `uteamup_document_list` / `uteamup_document_list_versions_by_guid` | Find a document and its exact version for evidence | `page`, `pageSize` / `documentGuid` |
| `uteamup_asset_search`, `uteamup_workorder_search`, `uteamup_part_search`, `uteamup_vendor_search`, `uteamup_location_list`, `uteamup_user_search` | Find link targets, sites and owners | `searchFilter` / `searchTerm` / `nameFilter` / `search` |

Action keys, required fields and enum values are in `references/lifecycle.md`. Read it before
any transition.

## Workflow

1. **Check the company.** If a tool reports no tenant or wrong tenant, call
   `uteamup_tenant_get_my_tenants`, show it, and ask the user to reconnect to the right company.
2. **Look before creating.** `uteamup_non_conformance_search` with `query` (two or three key
   words) and, if known, `status`. If an open NCR already covers the issue, offer to add
   evidence or a link to it instead of creating a duplicate.
3. **Draft the NCR.** Collect and show:
   - `title`, `description` (what was found), `requirementStatement` (what should have been
     true) and optional `requirementReference` (spec, drawing, procedure).
   - `subjectKind`, `severity`, `riskLevel`, `detectedAtUtc`, optional `occurredAtUtc`,
     `affectedQuantity` + `affectedUnit`, `ownerUserGuid` (via `uteamup_user_search`).
   - `owningSiteLocationGuid` (via `uteamup_location_list`) when the user works in a site scope.
   - Initial links: `assetLinks`, `workorderLinks`, `partLinks`, `vendorLinks`,
     `projectLinks`, `locationLinks`, `stockItemLinks` - each item `{ "<x>Guid": "...",
     "purpose": "Source" | "Affected" | ..., "note": "..." }`. Find each GUID with the matching
     search tool first.
   Ask for anything missing; do not invent the requirement.
4. **Create once.** After a clear yes, generate one new GUID as `idempotencyKey` and call
   `uteamup_non_conformance_create` with `request` and `idempotencyKey`. Reuse the same key and
   identical request only to retry this exact call. Keep the returned `guid`, `displayNumber`
   and `concurrencyToken`.
5. **Add evidence and links later.** Evidence must be an existing document version:
   `uteamup_document_list` → pick the document → `uteamup_document_list_versions_by_guid` → use
   the exact version. Call `uteamup_non_conformance_evidence_add` with `request`
   `{ "evidence": { "documentGuid", "documentVersionGuid", "purpose", "captureSource":
   "ExistingDocument", "confidentialityClassification": "Internal" }, "reason": "..." }`. New
   files must be uploaded in the web or mobile app first. Links use
   `uteamup_non_conformance_link_add` with `linkKind`, `targetGuid` and `request`
   `{ "purpose", "note" }`. Each call needs a fresh `idempotencyKey` and the latest
   `concurrencyToken` from the previous response.
6. **Move the NCR through its lifecycle** (two calls per step):
   a. `uteamup_non_conformance_get`; pick an option from `transitionAvailability.options` with
      `isAvailable` true. If `blockedReason` is set, explain it and stop.
   b. Preview: `uteamup_non_conformance_transition` with `actionKey`, `request` (fields from
      `references/lifecycle.md`), a new `idempotencyKey`, `confirmed` false.
   c. Show the user `consequencePreview.summary` and any blocked reason. Wait for a clear yes.
   d. Apply: same call with the same `idempotencyKey` and `request`, `confirmed` true, and the
      `previewToken` and `concurrencyToken` from the preview. If it fails because the state
      changed or the preview expired, start again at step a.
7. **Open a CAPA** when the cause is systemic or repeats.
   - Find the improvement project: `uteamup_capa_project_references` with `query`. If there is
     a completed RCA and no project, `uteamup_capa_project_from_rca` with `rcaGuid`, a new
     `requestGuid` and `title` (after confirmation).
   - Draft and show: `title`, `type`, `problemStatement`, `systemicImpactStatement`,
     `initialRiskLevel`, `ownerUserGuid`, `improvementProjectGuid`, optional
     `rootCauseAnalysisGuid`, `planSummary`, `planDueAtUtc`, `implementationDueAtUtc`,
     `effectivenessCriteria`, effectiveness window (`effectivenessWindowStartAtUtc` and
     `effectivenessWindowEndAtUtc` together), `effectivenessReviewerUserGuid`, and
     `sourceNonConformanceLinks` `[{ "nonConformanceGuid", "sourceReason" }]`.
   - Create with `uteamup_corrective_preventive_action_create` (`request`, new
     `idempotencyKey`).
8. **Run the CAPA.** Transitions follow the same preview-then-apply pattern with
   `uteamup_corrective_preventive_action_transition`; the CAPA record does not list available
   actions, so use the table in `references/lifecycle.md` for the current status and let the
   preview confirm it. Implementation actions: `uteamup_capa_implementation_get`, then
   `uteamup_capa_implementation_execute` with `request` `{ "operation": "action.create",
   "description", "assignedUserGuid", "dueDate" }` (or `action.complete` with `actionGuid` and
   `completionNotes`), each after a clear yes. Add more source NCRs with
   `uteamup_corrective_preventive_action_source_non_conformance_add`.
9. **Report back** with display number, GUID, new status and what is still required (evidence,
   independent verifier, due dates).

## Rules

- Identifiers are GUIDs. Search or list first and reuse returned GUIDs. Never guess a GUID and
  never use integer ids.
- Before any create, update, evidence, link or transition, show exactly what will change and get
  a clear yes. Transitions always go preview first (`confirmed` false), then apply.
- Never fabricate `previewToken`, `concurrencyToken` or evidence GUIDs; take them from the latest
  tool response. On a stale-token error, re-read and show the user the current state.
- Use a new `idempotencyKey` for every new operation; reuse it only to retry the identical call.
- Records are never deleted. Use `ncr.cancel`, `ncr.withdraw` or the lifecycle instead. Revoking
  evidence or links (`uteamup_non_conformance_evidence_revoke`,
  `uteamup_non_conformance_link_revoke`,
  `uteamup_corrective_preventive_action_evidence_revoke`,
  `uteamup_capa_source_non_conformance_revoke`) is high impact: only on explicit request, with a
  `reason`, preview first. History and documents stay retained.
- Segregation of duties is enforced by the server. If it refuses because the same person
  reported, implemented or approved, say who must act instead; do not look for another tool.
- Respect permission and site-scope errors: report them, do not retry around them.
- Do not decide disposition, root cause or effectiveness for the user. Propose, label it as a
  suggestion, and record only what the user confirms.
- Keep output short: at most about 10 rows per list; no raw JSON dumps.

## Not covered

- Uploading new files: do it in the web or mobile app, then attach the version here.
- Supplier corrective action requests (SCAR), customer quality cases and audits have their own
  tools; for audits use `uteamup-quality-audit`, for the 5 Whys investigation use
  `uteamup-root-cause-analysis`.

## Examples

**"Raise an NCR: 12 brackets from supplier Acme have the wrong hole spacing."**
1. `uteamup_non_conformance_search` `{ "query": "bracket hole spacing" }` → none open.
2. `uteamup_vendor_search` `{ "nameFilter": "Acme" }`, `uteamup_part_search` `{ "searchTerm": "bracket" }`.
3. Confirm, then `uteamup_non_conformance_create` `{ "idempotencyKey": "<new GUID>", "request": { "title": "Bracket hole spacing out of tolerance", "description": "12 brackets measured 48 mm spacing.", "requirementStatement": "Spacing 50 +/- 0.5 mm", "requirementReference": "DRW-1042 rev C", "subjectKind": "Supplier", "severity": "Major", "riskLevel": "Medium", "detectedAtUtc": "...", "affectedQuantity": 12, "affectedUnit": "pcs", "vendorLinks": [{ "vendorGuid": "<acme>", "purpose": "Source" }], "partLinks": [{ "partGuid": "<part>", "purpose": "Affected" }] } }`

**"Submit NCR-0042."**
1. `uteamup_non_conformance_search` `{ "query": "NCR-0042" }` → `uteamup_non_conformance_get`.
2. `uteamup_non_conformance_transition` `{ "nonConformanceGuid": "<n>", "actionKey": "ncr.submit", "request": {}, "idempotencyKey": "<k>", "confirmed": false }` → show summary.
3. On yes: same call with `"confirmed": true, "previewToken": "<t>", "concurrencyToken": "<c>"`.

**"Add an action to the bracket CAPA: Anna updates the incoming inspection plan by 15 May."**
1. `uteamup_corrective_preventive_action_search` `{ "query": "bracket" }` → `_get` for `concurrencyToken`.
2. `uteamup_user_search` `{ "searchFilter": "Anna" }`.
3. Confirm, then `uteamup_capa_implementation_execute` `{ "correctivePreventiveActionGuid": "<c>", "request": { "operation": "action.create", "description": "Update incoming inspection plan for brackets", "assignedUserGuid": "<anna>", "dueDate": "2027-05-15T16:00:00Z" }, "idempotencyKey": "<k>", "concurrencyToken": "<token>" }`
