---
name: uteamup-work-permit
description: "Runs the UteamUP permit-to-work lifecycle through MCP: lists and reads permits and templates, creates and edits draft permits, links them to work orders, assets, chemicals and projects, sets prerequisite permits, names approvers and resends approval links, suggests hazards with UPMate, submits a draft for approval, checks biosecurity clearance and shares a permit read-only. Use when the user says things like: create a hot-work permit for this job, which permits are waiting for approval, show the permit for work order X, change the permit dates, link this permit to the job, who approves this permit, assign the supervisor step, resend the approval email, this permit must wait for the isolation permit, submit the permit, can I start work in this zone, share the permit with the contractor."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.1.0"
  access: write
---

# UteamUP work permits

A work permit authorises hazardous work. It moves Draft → Submitted → (SupervisorApproved →
SafetyApproved →) Active → Completed, or is Revoked, or Expired by the tenant's automatic expiry.
The approval chain has two, three or four steps (supervisor, safety officer, site manager),
fixed by the permit's template. Rejection at any step returns the permit to Draft. Through MCP
this skill finds, reads, creates, edits and submits draft permits, and handles links,
prerequisites, named approvers, AI hazard suggestions, biosecurity status, sharing and the expiry
setting. Approving, rejecting, signing, completing and revoking stay human decisions in the
UteamUP web or mobile app.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_work_permit_list` | List permits, newest first, optional status filter | `status`, `page`, `pageSize` (max 100) |
| `uteamup_work_permit_get` | One permit with hazards, approvals, prerequisites, chain, approvers, expiry | `workPermitGuid` |
| `uteamup_work_permit_template_list` | Permit templates with approval chain and default expiry | `includeInactive` |
| `uteamup_work_permit_template_get` | One template: chain, required JSA categories and sections, rescue plan template | `templateGuid` |
| `uteamup_work_permit_create` | Create a permit in Draft | `title`, `description`, `templateGuid`, `locationGuid`, `locationFloorGuid`, `location`, `startDate`, `endDate`, `rescuePlanJson`, address fields |
| `uteamup_work_permit_update` | Edit a Draft permit; omitted fields stay | `workPermitGuid` plus fields to change |
| `uteamup_work_permit_submit` | Submit a Draft for approval (no signature) | `workPermitGuid` |
| `uteamup_global_search` | Find a permit, work order or asset by name or number | `query`, `entityTypes` (for example `workpermit`), `maxResults` |
| `uteamup_workorder_search` / `uteamup_workorder_get` | Find or read a work order | `searchFilter` / `workorderGuid` |
| `uteamup_location_list` | Find a location GUID | `search`, `pageSize` |
| `uteamup_work_permits_linked_to` | Permits linked to one record, open first (max 100) | `linkType`, `targetGuid` |
| `uteamup_work_permit_links_list` | Records linked to one permit | `workPermitGuid` |
| `uteamup_work_permit_link_add` / `uteamup_work_permit_link_remove` | Link or unlink a record | `workPermitGuid`, `linkType`, `targetGuid` / `linkGuid` |
| `uteamup_work_permit_prerequisite_add` / `uteamup_work_permit_prerequisite_remove` | Permit that must be Active first | `workPermitGuid`, `prerequisiteGuid` |
| `uteamup_work_permit_approvers_list` | Named approver per step | `workPermitGuid` |
| `uteamup_work_permit_approver_assign` | Name a user or contact for one step | `workPermitGuid`, `step`, `kind`, `userGuid` or `contactGuid` |
| `uteamup_work_permit_approver_clear` | Remove the named approver of a step | `workPermitGuid`, `step` |
| `uteamup_work_permit_approver_resend` | Email the assigned contact a fresh approval link | `workPermitGuid`, `step` |
| `uteamup_user_search` / `uteamup_contact_list` | Find the approver's user or contact GUID | `searchFilter` / `page`, `pageSize` |
| `uteamup_permit_ai_prefill` | Review-only hazard, PPE, isolation and rescue suggestions (spends AI credits) | `workPermitGuid`, `workorderGuid`, `assetGuid`, `context` |
| `uteamup_biosecurity_status` | Current user's zone-entry clearance for a work order | `workorderGuid` |
| `uteamup_share_create` / `uteamup_share_list_by_target` / `uteamup_share_revoke` | Share a permit outside the company, list or revoke shares | `entityType: "workpermit"`, `model` / `targetGuid` / `shareGuid` |
| `uteamup_work_permit_settings_get` / `uteamup_work_permit_settings_update` | Automatic expiry setting (tenant admin) | `previewDays` / `autoExpireEnabled`, `autoExpireAfterDays` |

`status` values: `Draft`, `Submitted`, `SupervisorApproved`, `SafetyApproved`, `Active`, `Expired`,
`Revoked`, `Completed`. `linkType` values: `workorder`, `asset`, `chemical`, `knowledgearticle`,
`tool`, `certificate`, `project`. `step` values: `supervisor`, `safetyofficer`, `sitemanager`.
`kind`: `user` or `contact`.

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use. Permit tools
   also need the company's Work Permits feature; if it is off, say so and stop.
2. **Find permits.** For an overview ("what is waiting for approval", "which permits are
   active") call `uteamup_work_permit_list` with `status` and a small `pageSize`. From a job:
   `uteamup_workorder_search` → `uteamup_work_permits_linked_to` (`linkType: "workorder"`,
   `targetGuid`); from an asset use `linkType: "asset"`. By name or number:
   `uteamup_global_search` with `entityTypes: "workpermit"`. Read one permit with
   `uteamup_work_permit_get` to see its hazards, approval chain, the step it waits on, named
   approvers and expiry date.
3. **Create a draft.** Check open permits on the work order first (step 2) to avoid a duplicate.
   Call `uteamup_work_permit_template_list` and suggest the template that fits the job (hot work,
   confined space, working at height and so on); `uteamup_work_permit_template_get` shows its
   approval chain, required JSA categories and sections. Find the site with `uteamup_location_list`
   (or use the work order's location). Show the user the title, template, location, start and end
   (ISO 8601) and description, get a yes, then call `uteamup_work_permit_create`. Use
   `locationGuid` (and optional `locationFloorGuid` on that location) for a known site, or the
   free-text `location` and address fields for an ad-hoc site. The permit is created as Draft;
   then link the work order and assets (step 5).
4. **Edit a draft.** Read it with `uteamup_work_permit_get`; only Draft permits can be edited.
   Confirm the change, then call `uteamup_work_permit_update` with `workPermitGuid` and only the
   fields that change. The location and floor are reassigned on every update, so send
   `locationGuid` (and `locationFloorGuid`) again to keep them. Any address field replaces the
   whole custom address. A permit that has left Draft is evidence and refuses edits.
5. **Link records.** `uteamup_work_permit_links_list` first. To add, show the permit and the record,
   get a yes, then `uteamup_work_permit_link_add` (`workPermitGuid`, `linkType`, `targetGuid`).
   Linking twice returns the existing link. Expired, revoked and completed permits cannot change.
   To remove, use the `linkGuid` from the list with `uteamup_work_permit_link_remove`; the linked
   record itself is not touched.
6. **Prerequisites.** When one permit must be Active before another (for example isolation before
   hot work), confirm and call `uteamup_work_permit_prerequisite_add`. The final approval of the
   dependent permit is refused while any prerequisite is not Active. A permit cannot require
   itself, a finished permit or one that depends on it; prerequisites freeze once Active.
7. **Name approvers.** `uteamup_work_permit_approvers_list` shows each step. To name a person,
   find their GUID (`uteamup_user_search` for staff, `uteamup_contact_list` for an external
   contact with an email), confirm, then `uteamup_work_permit_approver_assign` with `step`,
   `kind` and `userGuid` or `contactGuid`. Only steps in the permit's chain are accepted. A named
   user step can be decided only by that user; a contact step only through the emailed link. One
   person approves at most one step per cycle. If a contact lost the email, confirm and call
   `uteamup_work_permit_approver_resend` (the old link stops working).
   `uteamup_work_permit_approver_clear` lets anyone with `WorkPermit.Update` decide the step again.
8. **Hazard suggestions (optional).** Only if the user asks: tell them it spends AI credits, get a
   yes, then call `uteamup_permit_ai_prefill` with `workPermitGuid` and optional `workorderGuid`,
   `assetGuid`, `context`. Present the rows as suggestions. They are not saved and hazard (JSA)
   lines cannot be added through MCP; the issuer adds the accepted ones in the app. An `error`
   field in a 200 response means the suggestion failed (credits are refunded).
9. **Submit.** Read the permit with `uteamup_work_permit_get` and check that the title, dates,
   location, hazards and named approvers are complete. Tell the user that after submit the permit
   can no longer be edited and goes to its first approver, get a yes, then call
   `uteamup_work_permit_submit`. MCP submits without a signature. A permit that needs a signed
   biosecurity entry declaration is refused here; the user submits it in the app.
10. **Biosecurity.** For "can I start this job in the zone", call `uteamup_biosecurity_status` with
    the `workorderGuid`. It reports the zone policy (none, warn, block), the user's clearing
    permit and its validity. Signing a zone-entry declaration is done in the app.
11. **Share.** To give a contractor or inspector a read-only view, confirm recipient, expiry and
    sections, then `uteamup_share_create` with `entityType: "workpermit"` and `model`
    (`targetGuid`, optional `email`, `expiresInDays`, `note`). The link is returned once; pass it
    to the user. Revoke with `uteamup_share_revoke`.
12. **Close-out check.** List `Active` permits (`uteamup_work_permit_list`, `status: "Active"`)
    or the open permits on a work order, and tell the user which need Complete or Revoke in the
    app. Automatic expiry is off by default; `uteamup_work_permit_settings_get` shows whether it
    is on and how many permits would expire now (`wouldExpireNow`).

## Web app only

Tell the user to do these in the UteamUP web or mobile app (Work orders → Work permits):

- Approve or reject a step, sign a permit, complete or revoke it.
- Submit with a signature, or submit a permit that needs a signed biosecurity entry declaration.
- Add, verify or remove hazard (JSA) lines; attach or detach documents; download the PDF; sign a
  biosecurity zone-entry declaration.

Never try to reach these through another tool.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess one or use
  an integer id.
- Make sure the right company is active.
- Before any create, update, submit, link, unlink, prerequisite, approver, resend, share, AI or
  settings change, show what will change and get a clear yes. Records are archived, never
  deleted; this skill never removes a permit or a linked record.
- Do not approve, decide or sign on anyone's behalf, and never suggest a workaround that would let
  someone skip an approval step. The approver role is set by the permit's status, not chosen.
- Do not submit a permit the user has not reviewed; submitting freezes it as evidence.
- Permit signatures are acknowledgment-level, not qualified e-signatures; do not claim legal or
  regulatory conformance.
- Unassigned steps can be decided by anyone with `WorkPermit.Update`. When separation of duties
  matters, recommend naming a different approver for each step.
- Respect permission errors (`WorkPermit.Read`, `WorkPermit.Create`, `WorkPermit.Update`, view
  permission of the linked record, `Contact.View`, `Tenant.Update` for settings). Report them; do
  not retry with other tools.
- Keep results short: summarise permits as title, status, validity and awaiting step; page lists.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.

## Examples

**"Create a hot-work permit for work order 'Boiler 2 burner change' tomorrow 08:00–16:00."**
`uteamup_workorder_search` → `uteamup_work_permits_linked_to` (`linkType: "workorder"`, none open)
→ `uteamup_work_permit_template_list` → confirm title, template, location and times →
`uteamup_work_permit_create` → `uteamup_work_permit_link_add` (`linkType: "workorder"`).

**"Which permits are waiting for approval, and submit the scaffold permit."**
`uteamup_work_permit_list` (`status: "Submitted"`) → summarise → `uteamup_work_permit_list`
(`status: "Draft"`) to find the scaffold permit → `uteamup_work_permit_get` → confirm →
`uteamup_work_permit_submit`.

**"Make Anna the supervisor approver; the hot-work permit must wait for the isolation permit."**
`uteamup_user_search` (`searchFilter: "anna"`) → confirm →
`uteamup_work_permit_approver_assign` (`step: "supervisor"`, `kind: "user"`, `userGuid`) →
`uteamup_global_search` (`entityTypes: "workpermit"`) for the isolation permit → confirm →
`uteamup_work_permit_prerequisite_add`.
