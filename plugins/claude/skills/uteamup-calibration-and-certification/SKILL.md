---
name: uteamup-calibration-and-certification
description: "Manages calibration and certification records for assets and tools in UteamUP: lists what is overdue, due soon, expired or expiring, sets up a recurring calibration or certification with its due date and optional automatic work orders, records a calibration or inspection result with the certificate attached, moves the next due date, and generates work orders for overdue calibrations. Use when the user says things like: which calibrations are overdue, what certificates expire next month, set up yearly calibration for this gauge, the pressure vessel passed its inspection today, attach the calibration certificate, the lifting certificate was renewed, create work orders for overdue calibrations, revoke this certificate."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.1.0"
  access: write
---

# UteamUP calibration and certification

Keeps compliance dates honest. A **calibration** is a recurring measurement check (gauges,
sensors, torque tools) with a result of Pass, Fail or Conditional. A **certification** is a
recurring approval by a certifying body (pressure vessels, lifting gear, electrical safety) with
a certificate number and expiry. Each record belongs to exactly one asset or one tool. Reading is
free; every create or update is shown to the user first and needs a clear yes.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_asset_search` | Find the asset | `searchFilter` |
| `uteamup_tool_list` | Find a tool (hand tool, instrument) | `nameFilter`, `pageNumber`, `pageSize` |
| `uteamup_assetcalibration_get_overdue` / `uteamup_assetcalibration_get_due_soon` | Calibrations overdue / due within N days | none / `days` (default 30) |
| `uteamup_assetcalibration_get_by_asset` / `uteamup_assetcalibration_get_by_tool_guid` | Calibrations of one asset / tool | `assetGuid` / `toolGuid` |
| `uteamup_assetcalibration_get` | One calibration in full | `calibrationGuid` |
| `uteamup_assetcalibration_create` | New calibration record | `model` |
| `uteamup_assetcalibration_update` | Replace a calibration record (send every field) | `calibrationGuid`, `model` |
| `uteamup_assetcalibration_generate_workorders` | Work orders for all overdue calibrations with auto-generate on | none |
| `uteamup_assetcertification_get_expired` / `uteamup_assetcertification_get_expiring_soon` | Certifications expired / expiring within N days | none / `days` (default 30) |
| `uteamup_assetcertification_get_by_asset_guid` / `uteamup_assetcertification_get_by_tool_guid` | Certifications of one asset / tool | `assetGuid` / `toolGuid` |
| `uteamup_assetcertification_get_by_guid` | One certification in full | `certificationGuid` |
| `uteamup_assetcertification_create` | New certification record | `model` |
| `uteamup_assetcertification_update_by_guid` | Replace a certification record (send every field) | `certificationGuid`, `model` |
| `uteamup_document_find_by_hash` | Reuse a certificate file already stored | `sha256` |
| `uteamup_document_upload_with_content` | Upload a certificate as base64 | `fileName`, `fileContentBase64`, `contentType`, `description` |
| `uteamup_user_search` | Who calibrated / default assignee | `searchFilter` |
| `uteamup_contact_list` | Certifier contact | `page`, `pageSize` |
| `uteamup_workorder_template_list` | Template for generated calibration work orders | `nameFilter` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use.
2. **What is due.** For "what is overdue / coming up": `uteamup_assetcalibration_get_overdue`,
   `uteamup_assetcalibration_get_due_soon` (`days`), `uteamup_assetcertification_get_expired`,
   `uteamup_assetcertification_get_expiring_soon` (`days`). Group by asset or tool, show name, due
   date, days late or left, and status. Stop here if the user only asked to see.
3. **Subject.** Asset: `uteamup_asset_search`. Tool: `uteamup_tool_list` with `nameFilter`. Then
   read existing records (`uteamup_assetcalibration_get_by_asset` / `_get_by_tool_guid`,
   `uteamup_assetcertification_get_by_asset_guid` / `_get_by_tool_guid`) so you update the right
   record instead of creating a duplicate.
4. **Certificate file (optional).** Compute the SHA-256 when you can and call
   `uteamup_document_find_by_hash`; otherwise `uteamup_document_upload_with_content` (`fileName`
   with extension, `fileContentBase64`, `contentType` such as `application/pdf`, short
   `description`). Keep the document GUID for `certificateDocumentGuid`. Only upload a file you can
   read; for large files use `uteamup_document_create_upload_ticket` if you can make HTTP
   requests, otherwise suggest the web app.
5. **New calibration.** Confirm a summary, then `uteamup_assetcalibration_create` with `model`:
   - Exactly one of `assetGuid` or `toolGuid`; `name` (required, e.g. "Annual pressure gauge
     calibration"); `description`.
   - `frequencyType` (`Daily`, `Weekly`, `Monthly`, `Yearly`, `Hours`, `Cycles`) and
     `frequencyValue` (1-100000; `Monthly` + 6 = every six months).
   - `lastCalibrationDate`, `nextCalibrationDueDate`. If the next date is omitted it is computed
     from the last date (or today) and the frequency; for `Hours` and `Cycles` always set it
     yourself.
   - Optional `toleranceRange`, `calibrationStandard`, `equipmentUsed`, `certificateNumber`,
     `certificateExpiryDate`, `certificateDocumentGuid`.
   - Automatic work orders: `autoGenerateWorkorder: true`, `workorderTemplateGuid` (from
     `uteamup_workorder_template_list`), `daysBeforeDueToGenerate`, `defaultAssigneeGuid` (from
     `uteamup_user_search`).
6. **New certification.** Confirm, then `uteamup_assetcertification_create` with `model`: one of
   `assetGuid`/`toolGuid`; `certificationType` (required: Safety, Compliance, Inspection,
   Environmental, Quality, …) and `name` (required); `frequencyType` (`Daily`, `Weekly`,
   `Monthly`, `Yearly`) and `frequencyValue`; `lastCertificationDate` and
   `nextCertificationDueDate` (always set it; it is not computed on create); `status` (`Active`,
   `Pending`, `Expired`, `Overdue`, `Revoked`); `certifyingBody`, `certifierContactGuid`,
   `certificationStandard`, `certificateNumber`, `certificateDocumentGuid`, `notes`; optional
   `autoGenerateWorkorder`, `daysBeforeDueToGenerate`, `retainUntil`.
7. **Record a result or renewal.** Updates replace the whole record, so:
   1. Read it (`uteamup_assetcalibration_get` or `uteamup_assetcertification_get_by_guid`).
   2. Copy every field from the read into `model`, then change only what the user reported.
   3. Calibration result: `status` `Passed` or `Failed`, `calibrationResult` `Pass`, `Fail` or
      `Conditional`, `lastCalibrationDate` (the date it was done), `nextCalibrationDueDate`
      (last date plus the frequency; the update does not move it for you), `calibrationNotes`,
      `calibratedByGuid`, `equipmentUsed`, `certificateNumber`, `certificateDocumentGuid`.
   4. Certification renewal: `status: "Active"`, new `lastCertificationDate`,
      `nextCertificationDueDate`, `certificateNumber`, `certificateDocumentGuid`.
   5. Show old vs new values, get a yes, then call `uteamup_assetcalibration_update`
      (`calibrationGuid`, `model`) or `uteamup_assetcertification_update_by_guid`
      (`certificationGuid`, `model`). Read it back and report.
   A failed calibration usually needs repair or a hold on the equipment; offer the
   `uteamup-workorder-triage` skill (if available) rather than doing it here.
8. **Work orders for overdue calibrations.** `uteamup_assetcalibration_generate_workorders` acts on
   every overdue calibration with auto-generate on, company-wide. Show the overdue list first and
   get a yes; then report generated, skipped and failed counts and any errors.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids (do not use `uteamup_assetcertification_get`, `_get_by_asset`, `_update` or
  `_delete`, which take integer ids).
- Before any create, update, upload or work-order generation, show the user what will change and
  get a clear yes.
- Never invent a result, date, certificate number or certifying body. Record only what the user
  or the certificate states.
- Records are archived, never deleted. Do not call `uteamup_assetcalibration_delete`,
  `uteamup_assetcertification_delete` or `uteamup_assetcertification_delete_by_guid` (they delete
  permanently). To retire a record, set calibration `status: "Skipped"` or certification
  `status: "Revoked"` with a note, after the user agrees.
- An update without every field resets the missing ones; always start from a fresh read.
- Respect permission errors (AssetCalibration.*, AssetCertification.*, Tool.View,
  Documents.Upload): report them and stop; do not try another tool to get around them.
- Keep results short: summarise lists by urgency; use `days` windows rather than full dumps.
- If a write tool is unavailable (read-only connection), explain that recording results needs the
  full UteamUP connection.

## Examples

**"What calibrations are overdue and what certificates expire in the next 60 days?"**
`uteamup_assetcalibration_get_overdue` → `uteamup_assetcertification_get_expiring_soon`
(`days: 60`) → grouped summary.

**"Gauge PG-14 was calibrated today and passed; here is the certificate."**
`uteamup_asset_search` → `uteamup_assetcalibration_get_by_asset` → `uteamup_assetcalibration_get`
→ `uteamup_document_find_by_hash` → `uteamup_document_upload_with_content` → confirm →
`uteamup_assetcalibration_update` (full model; `status: "Passed"`, `calibrationResult: "Pass"`,
dates, `certificateDocumentGuid`).

**"Set up a yearly lifting-gear inspection for hoist H-2, next due 1 March, by LiftCert."**
`uteamup_asset_search` → `uteamup_assetcertification_get_by_asset_guid` (no duplicate) → confirm
→ `uteamup_assetcertification_create` (`certificationType: "Safety"`, `frequencyType: "Yearly"`,
`frequencyValue: 1`, `nextCertificationDueDate`, `certifyingBody: "LiftCert"`,
`status: "Active"`).
