# NCR and CAPA lifecycle actions

The server decides which actions are available. Always read the record first and use only an
`actionKey` that the record offers (`transitionAvailability.options` with `isAvailable` true on an
NCR). This table explains what each key does and what the request usually needs.

Needs: **R** = `request.reason`, **E** = `request.evidenceGuids` (retained evidence-link GUIDs
already on the record), **D** = a recorded decision (`request.attestationText` stating who
decided what), **I** = an independent person (not the reporter/owner/implementer; the server
checks this and refuses otherwise).

## NCR (`uteamup_non_conformance_transition`)

| From | actionKey | To | Needs | Typical request fields |
|------|-----------|----|-------|------------------------|
| Draft | `ncr.submit` | Submitted | - | |
| Draft | `ncr.cancel` | Cancelled | R | `reason` |
| Submitted | `ncr.accept-triage` | Triage | D | `attestationText` |
| Submitted | `ncr.return-for-correction` | Returned | R D | `reason` |
| Submitted | `ncr.withdraw` | Withdrawn | R D | `reason` |
| Returned | `ncr.revise` | Draft | - | |
| Triage | `ncr.assign-containment` | Containment | - | |
| Triage | `ncr.approve-not-substantiated` | NotSubstantiated | R D | `reason` |
| Triage | `ncr.link-canonical-duplicate` | DuplicateLinked | R | `reason`, `canonicalNonConformanceGuid` |
| Triage | `ncr.cancel` | Cancelled | R D | `reason` |
| Containment | `ncr.complete-containment` | Investigation | E | `containmentSummary` |
| Investigation | `ncr.approve-analysis` | Disposition | E D | `investigationSummary` |
| Disposition | `ncr.approve-disposition` | ActionInProgress | E D | `dispositionKind`, `dispositionSummary` |
| ActionInProgress | `ncr.complete-work` | Verification | E | |
| Verification | `ncr.verify-close` | Closed | E D I | `verificationResultSummary`, `closureReason` |
| Verification | `ncr.fail-verification` | ActionInProgress | R E D | `reason` |
| Closed / NotSubstantiated | `ncr.reopen` | Reopened | R D | `reason` |
| DuplicateLinked | `ncr.unlink-reopen` | Reopened | R D | `reason` |
| Reopened | `ncr.resume-triage` | Triage | - | |

`dispositionKind`: `Rework`, `Repair`, `UseAsIs`, `Deviation`, `Quarantine`,
`ReturnToSupplier`, `Scrap`, `Reject`, `Other`. High-risk use-as-is, deviation, release, scrap and
closure need the policy's independent approver.

## CAPA (`uteamup_corrective_preventive_action_transition`)

| From | actionKey | To | Needs | Typical request fields |
|------|-----------|----|-------|------------------------|
| Draft | `capa.submit` | Assessment | - | |
| Assessment | `capa.require-rca` | RcaRequired | D | `attestationText` |
| RcaRequired | `capa.complete-rca` | Assessment | E | |
| Assessment | `capa.complete-plan` | PlanApproval | E | |
| PlanApproval | `capa.approve-plan` | Implementation | D | `attestationText` |
| PlanApproval | `capa.return-plan` | Draft | R D | `reason` |
| Implementation | `capa.complete-actions` | EffectivenessWaiting | E | |
| EffectivenessWaiting | `capa.reach-effectiveness-window` | EffectivenessReview | - | |
| EffectivenessReview | `capa.approve-effective` | Closed | E D I | `effectivenessResult` `Effective`, `effectivenessSummary`, `residualRiskLevel`, `closureReason` |
| EffectivenessReview | `capa.mark-ineffective` | Replan | R E D | `effectivenessResult` `PartiallyEffective` or `Ineffective`, `reason` |
| Replan | `capa.resubmit-plan` | PlanApproval | E | |
| Closed | `capa.reopen` | Reopened | R D | `reason` |
| Reopened | `capa.resume-assessment` | Assessment | R D | `reason` |

## CAPA implementation operations (`uteamup_capa_implementation_execute`)

`request.operation` is one of `project.approve`, `project.start`, `project.complete`,
`project.reopen`, `action.create`, `action.update`, `action.complete`.

- `action.create` / `action.update`: `description`, `assignedUserGuid`, `dueDate` (UTC) are
  required; `action.update` also needs `actionGuid`.
- `action.complete`: `actionGuid` and `completionNotes`.
- `project.reopen`: `completionNotes` with the reason.

## Enum values

- NCR `subjectKind`: `Product`, `Work`, `Supplier`, `Process`, `Other`.
- NCR `severity`: `Minor`, `Major`, `Critical`. NCR `riskLevel`: `Low`, `Medium`, `High`,
  `Critical`.
- NCR link `purpose`: `Source`, `Affected`, `Containment`, `Investigation`, `Disposition`,
  `CorrectiveAction`, `Verification`.
- NCR `linkKind` (for `uteamup_non_conformance_link_add`): `workorder`, `project`, `asset`,
  `location`, `part`, `stock-item`, `vendor`, `vehicle-inspection`, `root-cause-analysis`,
  `operational-route-execution`, `customer-quality-case`.
- CAPA `type`: `Corrective`, `Preventive`, `CorrectiveAndPreventive`. CAPA risk levels:
  `Low`, `Medium`, `High`, `Critical`.
- Evidence `purpose`: `SourceRecord`, `Requirement`, `Containment`, `Investigation`,
  `RootCause`, `Disposition`, `ActionCompletion`, `DecisionSupport`, `Verification`,
  `Effectiveness`, `CustomerCommunication`. `captureSource` for an existing document:
  `ExistingDocument`. `confidentialityClassification`: `Internal`, `Restricted`,
  `SupplierRestricted`, `CustomerRestricted`, `PrivilegedLegal`.
