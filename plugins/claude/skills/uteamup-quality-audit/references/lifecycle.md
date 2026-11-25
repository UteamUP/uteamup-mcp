# Audit programme, audit and finding lifecycles

Use only action keys valid for the record's current status. The preview (`confirmed` false)
is the authority: if it reports the action as blocked, explain the reason and stop.

Needs: **R** = `request.reason`, **E** = `request.evidenceGuids` (retained evidence-link GUIDs
already on the record), **D** = a recorded decision (`request.attestationText`), **I** = an
independent person (the server refuses the same person who planned, audited or responded).

## Audit programme (`uteamup_quality_audit_program_transition`)

| From | actionKey | To | Needs |
|------|-----------|----|-------|
| Draft | `quality-audit-program.submit` | InReview | - |
| InReview | `quality-audit-program.return` | Draft | R D |
| InReview | `quality-audit-program.approve` | Approved | D |
| Approved | `quality-audit-program.activate` | Active | - |
| Active | `quality-audit-program.complete` | Completed | E D (`completionSummary`) |
| Draft / InReview / Approved / Active | `quality-audit-program.cancel` | Cancelled | R (+D, +E when Active) |

## Audit (`uteamup_quality_audit_transition`)

| From | actionKey | To | Needs |
|------|-----------|----|-------|
| Planned | `quality-audit.approve-plan` | PlanApproved | D |
| PlanApproved | `quality-audit.schedule` | Scheduled | - |
| Scheduled | `quality-audit.accept-assignments` | Preparation | - (every assignment accepted, competence verified, independence reviewed) |
| Preparation | `quality-audit.open` | InProgress | - (`openingMeetingAtUtc`) |
| InProgress | `quality-audit.close-fieldwork` | Reporting | E (`closingMeetingAtUtc`) |
| Reporting | `quality-audit.issue-report` | FindingFollowUp | E D I (`reportSummary`) |
| Reporting | `quality-audit.issue-report-no-follow-up` | Closed | E D I (`reportSummary`, `closureReason`) |
| FindingFollowUp | `quality-audit.verify-follow-up` | Closed | E D I (`closureReason`) |
| Planned / Scheduled / Preparation | `quality-audit.cancel` | Cancelled | R D |
| InProgress | `quality-audit.abort` | Aborted | R E D |
| Aborted | `quality-audit.document-partial-evidence` | Reporting | E |
| Closed | `quality-audit.reopen` | Reopened | R D |
| Reopened | `quality-audit.resume-follow-up` | FindingFollowUp | R D |

## Finding (`uteamup_quality_audit_finding_transition`)

| From | actionKey | To | Needs |
|------|-----------|----|-------|
| Draft | `quality-audit-finding.issue` | Open | D |
| Open | `quality-audit-finding.request-response` | ResponseDue | - |
| Open | `quality-audit-finding.close-without-response` | Closed | E D I (`closureReason`) |
| ResponseDue | `quality-audit-finding.submit-response` | Verification | E (`responseSummary`) |
| Verification | `quality-audit-finding.verify-close` | Closed | E D I (`verificationSummary`, `closureReason`) |
| Verification | `quality-audit-finding.return-response` | ResponseDue | R E D |
| Closed | `quality-audit-finding.reopen` | Reopened | R D |
| Reopened | `quality-audit-finding.resume-response` | ResponseDue | R D |
| Draft / Open / ResponseDue | `quality-audit-finding.cancel` | Cancelled | R (+D after Draft) |

## Enum values

- Audit `type`: `Internal`, `Supplier`, `Process`, `Product`, `System`.
- Assignment `role`: `LeadAuditor`, `Auditor`, `TechnicalExpert`, `Observer`,
  `AuditeeRepresentative`.
- Independence `result`: `Pending`, `Independent`, `ConflictDetected`.
- Checklist `result`: `NotEvaluated`, `Conforming`, `NonConforming`, `NotApplicable`,
  `NotObserved`.
- Finding `classification`: `Conformity`, `Observation`, `OpportunityForImprovement`,
  `MinorNonConformance`, `MajorNonConformance`.
- Statuses - programme: `Draft`, `InReview`, `Approved`, `Active`, `Completed`, `Cancelled`;
  audit: `Planned`, `PlanApproved`, `Scheduled`, `Preparation`, `InProgress`, `Reporting`,
  `FindingFollowUp`, `Closed`, `Cancelled`, `Aborted`, `Reopened`; finding: `Draft`, `Open`,
  `ResponseDue`, `Verification`, `Closed`, `Reopened`, `Cancelled`.
- Evidence `purpose`: `SourceRecord`, `Requirement`, `Investigation`, `DecisionSupport`,
  `Verification`, `Effectiveness` (and others); `captureSource` `ExistingDocument`;
  `confidentialityClassification` `Internal`, `Restricted`, `SupplierRestricted`,
  `CustomerRestricted`, `PrivilegedLegal`.
