---
name: uteamup-work-permit
description: "Supports the UteamUP permit-to-work lifecycle through MCP: finds permits, links them to work orders, assets, chemicals and projects, sets prerequisite permits, names the approver of each approval step and resends external approval links, suggests hazards with UPMate, checks biosecurity clearance and shares a permit read-only. Use when the user says things like: which permits cover this work order, link this permit to the job, who approves this permit, assign the supervisor step, resend the approval email, this permit must wait for the isolation permit, suggest hazards for this permit, can I start work in this zone, share the permit with the contractor."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP work permits

A work permit authorises hazardous work. It moves Draft → Submitted → (SupervisorApproved →
SafetyApproved →) Active → Completed, or is Revoked, or Expired by the tenant's automatic expiry.
The approval chain has two, three or four steps (supervisor, safety officer, site manager),
fixed by the permit's template. Rejection at any step returns the permit to Draft. This skill
handles what the MCP server exposes around a permit: finding it, links, prerequisites, named
approvers, AI hazard suggestions, biosecurity status, sharing and the expiry setting. Creating,
editing, submitting, approving, rejecting, completing and revoking a permit happen in the UteamUP
web or mobile app (see "Not available through MCP").

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_global_search` | Find a permit (or work order, asset) by name or number | `query`, `entityTypes` (for example `workpermit`), `maxResults` |
| `uteamup_workorder_search` / `uteamup_workorder_get` | Find or read a work order | `searchFilter` / `workorderGuid` |
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

`linkType` values: `workorder`, `asset`, `chemical`, `knowledgearticle`, `tool`, `certificate`,
`project`. `step` values: `supervisor`, `safetyofficer`, `sitemanager`. `kind`: `user` or `contact`.

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use. Permit tools
   also need the company's Work Permits feature; if it is off, say so and stop.
2. **Find the permit.** From a job: `uteamup_workorder_search` → `uteamup_work_permits_linked_to`
   (`linkType: "workorder"`, `targetGuid`). From an asset: same tool with `linkType: "asset"`.
   By name or number: `uteamup_global_search` with `entityTypes: "workpermit"`. Report each
   permit's status. If no permit exists yet, the user must create it in the app (the app's
   "create from work order" pre-fills the title, location and links).
3. **Link records.** `uteamup_work_permit_links_list` first. To add, show the permit and the record,
   get a yes, then `uteamup_work_permit_link_add` (`workPermitGuid`, `linkType`, `targetGuid`).
   Linking twice returns the existing link. Expired, revoked and completed permits cannot change.
   To remove, use the `linkGuid` from the list with `uteamup_work_permit_link_remove`; the linked
   record itself is not touched.
4. **Prerequisites.** When one permit must be Active before another (for example isolation before
   hot work), confirm and call `uteamup_work_permit_prerequisite_add`. The final approval of the
   dependent permit is refused while any prerequisite is not Active. A permit cannot require
   itself, a finished permit or one that depends on it; prerequisites freeze once Active.
5. **Name approvers.** `uteamup_work_permit_approvers_list` shows each step. To name a person,
   find their GUID (`uteamup_user_search` for staff, `uteamup_contact_list` for an external
   contact with an email), confirm, then `uteamup_work_permit_approver_assign` with `step`,
   `kind` and `userGuid` or `contactGuid`. Only steps in the permit's chain are accepted. A named
   user step can be decided only by that user; a contact step is decided only through the emailed
   link. One person approves at most one step per cycle. If a contact lost the email or the
   permit changed, confirm and call `uteamup_work_permit_approver_resend` (the old link stops
   working). `uteamup_work_permit_approver_clear` lets anyone with `WorkPermit.Update` decide the
   step again.
6. **Hazard suggestions (optional).** Only if the user asks: tell them it spends AI credits, get a
   yes, then call `uteamup_permit_ai_prefill` with `workPermitGuid` and optional `workorderGuid`,
   `assetGuid`, `context`. Present the rows as suggestions. They are not saved; the issuer adds the
   ones they accept in the app. An `error` field in a 200 response means the suggestion failed
   (credits are refunded).
7. **Biosecurity.** For "can I start this job in the zone", call `uteamup_biosecurity_status` with
   the `workorderGuid`. It reports the zone policy (none, warn, block), the user's clearing permit
   and its validity. Signing a zone-entry declaration is done in the app.
8. **Share.** To give a contractor or inspector a read-only view, confirm recipient, expiry and
   sections, then `uteamup_share_create` with `entityType: "workpermit"` and `model`
   (`targetGuid`, optional `email`, `expiresInDays`, `note`). The link is returned once; pass it
   to the user. Revoke with `uteamup_share_revoke`.
9. **Close-out check.** To see what still needs a permit closed, list open permits on the work
   order (step 2) and tell the user which are Active and need Complete or Revoke in the app.
   Automatic expiry is off by default; `uteamup_work_permit_settings_get` shows whether it is on
   and how many permits would expire now (`wouldExpireNow`).

## Not available through MCP

Tell the user to do these in the UteamUP web or mobile app (Work orders → Work permits):

- Create a permit, edit or delete a Draft, choose its template; add, verify or remove hazard (JSA) lines.
- Submit for approval (the submitter's signature is captured on submit), approve, reject,
  complete or revoke a permit.
- Attach or detach documents, download the PDF, sign a biosecurity zone-entry declaration.
- List all permits with status filters (use the search and linked-to tools above instead).

Never try to reach these through another tool.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess one or use
  an integer id.
- Make sure the right company is active.
- Before any link, unlink, prerequisite, approver, resend, share, AI or settings change, show what
  will change and get a clear yes. This skill never deletes or archives a permit or a linked record.
- Do not approve, decide or sign on anyone's behalf, and never suggest a workaround that would let
  someone skip an approval step. The approver role is set by the permit's status, not chosen.
- Permit signatures are acknowledgment-level, not qualified e-signatures; do not claim legal or
  regulatory conformance.
- Unassigned steps can be decided by anyone with `WorkPermit.Update`. When separation of duties
  matters, recommend naming a different approver for each step.
- Respect permission errors (`WorkPermit.Read`, `WorkPermit.Update`, view permission of the linked
  record, `Contact.View`, `Tenant.Update` for settings). Report them; do not retry with other tools.
- Keep results short: summarise permits as title, status, validity and awaiting step.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.

## Examples

**"Which permits cover work order 'Boiler 2 burner change'?"**
`uteamup_workorder_search` → `uteamup_work_permits_linked_to` (`linkType: "workorder"`) →
list title, status and validity.

**"Make Anna the supervisor approver and send the safety step to our contractor's HSE lead."**
`uteamup_user_search` (`searchFilter: "anna"`) and `uteamup_contact_list` → confirm →
`uteamup_work_permit_approver_assign` (`step: "supervisor"`, `kind: "user"`, `userGuid`) →
`uteamup_work_permit_approver_assign` (`step: "safetyofficer"`, `kind: "contact"`, `contactGuid`).

**"The hot-work permit must wait for the isolation permit, and link the pump asset."**
`uteamup_global_search` (`entityTypes: "workpermit"`) for both permits → confirm →
`uteamup_work_permit_prerequisite_add` → `uteamup_asset_search` → confirm →
`uteamup_work_permit_link_add` (`linkType: "asset"`).
