---
name: uteamup-vendor-and-contracts
description: Manages suppliers and agreements in UteamUP through the UteamUP MCP server - vendors, contacts, contracts, service agreements with response and resolution targets, SLA milestones on work orders, and vendor ratings - finding records first, using GUIDs only and confirming every change before writing. Use when the user says things like "add a new supplier", "who is our contact at Acme", "create a maintenance contract with this vendor", "which contracts cover this pump", "what contracts expire soon", "set a 4 hour response SLA for this customer", "is this work order breaching its SLA", "rate the vendor for this job", or "archive this old supplier".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP vendors and contracts

Keep a company's supplier register and agreements correct: vendors and their contacts, contracts
(service, maintenance, purchase and others), the service agreement terms on a contract (response
and resolution minutes, business hours, coverage) and the SLA milestones those terms create on
work orders. The skill searches first, reads the record, proposes the change, and only writes
after a clear yes.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_vendor_search` | Find vendors by name | `nameFilter` |
| `uteamup_vendor_list` | Page vendors | `page`, `pageSize` (max 100) |
| `uteamup_vendor_get` | One vendor with contacts | `vendorGuid` |
| `uteamup_vendor_create` | Add a supplier | `model` (`name`, `email`, `phoneNumber`, `webSite`, `street`, `city`, `postalCode`, `country`, `contactGuids`) |
| `uteamup_vendor_archive` / `uteamup_vendor_restore` | Mark a vendor inactive / active again | `vendorGuid` |
| `uteamup_vendor_get_catalog` | Parts a vendor supplies with cost and lead time | `vendorGuid` |
| `uteamup_vendor_rating_submit` | Rate a vendor, usually for a work order | `model` (`vendorGuid`, `workOrderGuid`, `ratingType` (`WorkOrderCompletion` or `General`), `overallRating` 1-5, optional sub-scores, `comment`) |
| `uteamup_vendor_rating_list` / `uteamup_vendor_rating_aggregate` | Ratings and averages for a vendor | `vendorGuid`, `page`, `pageSize` |
| `uteamup_vendor_scorecard_get` | Vendor scorecard | `vendorGuid` |
| `uteamup_contact_list` | Page contacts | `page`, `pageSize` |
| `uteamup_contacttype_list` | Contact types and their GUIDs | none |
| `uteamup_contact_create` | Add a person | `model` (`firstName`, `lastName`, `email`, `phone`, `company`, `jobTitle`, `vendorGuids`, `customerGuids`, `locationGuids`, `contactTypeGuids`, `idempotencyKey`, `mutationOutcomeVersion` 1) |
| `uteamup_contact_update` | Change a person | `contactGuid`, `model` (full data + `idempotencyKey`, `expectedUpdatedAt`, `mutationOutcomeVersion` 1) |
| `uteamup_global_search` | Find contacts, vendors or customers by text | `query` (3+ chars), `entityTypes` (`contact`, `vendor`, `customer`), `maxResults` |
| `uteamup_customer_search` | Find a customer by name | `nameFilter` |
| `uteamup_contract_list` | Page contracts | `page`, `pageSize` |
| `uteamup_contract_get_by_guid` | One contract with people, price and linked items | `contractGuid` |
| `uteamup_contract_list_for_entity` | Contracts covering an asset, tool, part or chemical | `entityType`, `entityGuid` |
| `uteamup_contract_create` | New contract | `model` (`title`, `type`, `status`, `priority`, `startDate`, `endDate`, `totalValue`, `currency`, `vendorGuid`, `contactGuid`, `locationGuid`, `responsibleUserGuid`, `assetGuids`, `partGuids`, `isAutoRenewal`, `noticePeriodDays`, `notes`) |
| `uteamup_contract_update_by_guid` | Replace a contract's data | `contractGuid`, `model` (complete data) |
| `uteamup_contract_archive` / `uteamup_contract_restore` | Retire / restore a contract | `contractGuid` |
| `uteamup_service_agreement_list` | Service terms per contract | `activeOnly` |
| `uteamup_service_agreement_get` | One agreement | `agreementGuid` |
| `uteamup_service_agreement_create` | Add response/resolution terms to a contract | `model` (`idempotencyKey`, `contractGuid`, `customerGuid`, `effectiveFrom`, `defaultResponseMinutes`, `defaultResolutionMinutes`, `businessHoursStart`, `businessHoursEnd`, `businessDaysMask`, `pauseSlaOutsideBusinessHours`, `defaultWarningPercentage`, `coverage`) |
| `uteamup_service_agreement_update` | Change terms (clears approval) | `agreementGuid`, `model` (same fields + `expectedUpdatedAt`) |
| `uteamup_service_agreement_approve` | Approve the reviewed version | `agreementGuid`, `model` (`idempotencyKey`, `expectedUpdatedAt`, `acknowledgeOverlap`) |
| `uteamup_service_sla_milestone_list` | SLA clocks on work orders | `workorderGuid`, `agreementGuid`, `status`, `search`, `page`, `pageSize` |
| `uteamup_service_sla_milestone_get` | One SLA clock with time left | `milestoneGuid`, `asOf` |
| `uteamup_service_sla_milestone_initialize` | Start the SLA clock on a covered work order | `workorderGuid`, `model` (`idempotencyKey`, `startedAt`, `reason`) |
| `uteamup_service_sla_milestone_pause`, `uteamup_service_sla_milestone_resume`, `uteamup_service_sla_milestone_complete`, `uteamup_service_sla_milestone_cancel` | Move an SLA clock | `milestoneGuid`, `model` (`idempotencyKey`, `expectedUpdatedAt`, `occurredAt`, `reason`) |
| `archive_record` / `restore_record` | Archive or restore a contact | `recordType` `contact`, `recordGuid` |

## Workflow

1. **Confirm the company.** If a tool reports no tenant or access denied, call
   `uteamup_tenant_get_my_tenants`, show it, and ask the user which company they mean.
2. **Find the record.** Vendor: `uteamup_vendor_search`. Contact or customer:
   `uteamup_global_search` with `entityTypes` `contact` or `customer`, or
   `uteamup_customer_search`. Contract: `uteamup_contract_list` (page) or
   `uteamup_contract_list_for_entity` when the asset or part is known. If several match, show a
   short numbered list and ask.
3. **Check for duplicates** before creating a vendor or contact (same name, email or phone).
4. **Read the full record** (`uteamup_vendor_get`, `uteamup_contract_get_by_guid`,
   `uteamup_service_agreement_get`) and show the fields the user cares about.
5. **Propose the change** as a before/after list and ask for a clear yes.
6. **Write after the yes.**
   - Vendor: `uteamup_vendor_create`. To link existing contacts pass `contactGuids`.
   - Contact: `uteamup_contact_create` with a new `idempotencyKey` and `mutationOutcomeVersion`
     1. For an update, send every field again, change only what was asked, and set
     `expectedUpdatedAt` to the contact's `updatedAt` (UTC).
   - Contract: `uteamup_contract_create`, or for a change read it with
     `uteamup_contract_get_by_guid`, edit the copy and send the whole model to
     `uteamup_contract_update_by_guid`.
   - Service agreement: create it on an existing contract (`contractGuid`) for one customer.
     Minutes are whole minutes (4 hours = 240). `businessDaysMask` adds Sun=1, Mon=2, Tue=4,
     Wed=8, Thu=16, Fri=32, Sat=64 (Mon-Fri = 62). Then, if the user wants it live and has
     ServiceAgreement.Approve, call `uteamup_service_agreement_approve` with the agreement's
     current `updatedAt` as `expectedUpdatedAt`. Any later update clears approval.
7. **SLA follow-up.** `uteamup_service_sla_milestone_list` with `status` `Warning` or
   `Breached` shows clocks at risk. Pause, resume, complete or cancel only on the user's request,
   with a `reason` and the milestone's `updatedAt`.
8. **Ratings.** After a vendor job, `uteamup_vendor_rating_submit` with `vendorGuid`,
   `workOrderGuid` and `overallRating` 1-5. Read results with `uteamup_vendor_rating_aggregate`
   or `uteamup_vendor_scorecard_get`.
9. **Retire.** Vendor: `uteamup_vendor_archive`. Contract: `uteamup_contract_archive`. Contact:
   `archive_record` with `recordType` `contact`. All keep their history and can be restored.
10. **Report** the result in a few lines and offer the next step (for example "add the service
    agreement now?").

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never invent one and
  never use integer ids. Do not use the integer tools `uteamup_vendor_update`,
  `uteamup_vendor_delete`, `uteamup_contact_get`, `uteamup_contract_get`,
  `uteamup_contract_update`, `uteamup_contract_delete`.
- Editing an existing vendor's details is not available through MCP with GUIDs; ask the user to
  edit the vendor in the web app.
- Make sure the right company is active before writing.
- Before any create, update, approval, SLA transition or archive, show what will change and get a
  clear yes.
- Records are archived, never deleted. Never call `uteamup_contract_delete_by_guid` (permanent) or
  `uteamup_contacttype_delete`; archive instead.
- Updates replace the whole record: always start from the record you just read so no field is
  blanked by accident.
- On an `expectedUpdatedAt` conflict, re-read, show what changed, and ask again.
- Keep the same `idempotencyKey` when retrying a write after a timeout.
- Respect permission errors (Vendor, Contact, Contract, ServiceAgreement, ContractCost):
  report them; do not route around them with other tools.
- Prices and seat costs may be hidden without ContractCost.View; do not guess them.
- Keep results short: page with `pageSize` 10-25 and summarise.
- If write tools are missing, the connection is read-only; explain that changes need the full
  UteamUP connection.
- Partner tools (such as `uteamup_partner_list`) are for UteamUP channel partners and global admins, not
  suppliers. Do not use them for vendor questions.

## Examples

**"Add Nordic Pumps as a supplier with Anna Jónsdóttir as our contact."**
1. `uteamup_vendor_search` `{ "nameFilter": "Nordic Pumps" }` and `uteamup_global_search`
   `{ "query": "Anna Jónsdóttir", "entityTypes": "contact" }` → none found.
2. Propose vendor and contact; user says yes.
3. `uteamup_vendor_create` `{ "model": { "name": "Nordic Pumps", "email": "...", "phoneNumber": "..." } }`
4. `uteamup_contact_create` `{ "model": { "firstName": "Anna", "lastName": "Jónsdóttir", "email": "...", "vendorGuids": ["<vendor GUID>"], "idempotencyKey": "<new GUID>", "mutationOutcomeVersion": 1 } }`

**"Which contracts cover compressor C-2, and do any end this year?"**
1. `uteamup_asset_search` `{ "searchFilter": "C-2" }` → asset GUID.
2. `uteamup_contract_list_for_entity` `{ "entityType": "asset", "entityGuid": "<asset GUID>" }`
3. Summarise title, vendor, status and `endDate`; flag the ones ending this year.

**"Give Hotel Saga a 2 hour response, 8 hour fix SLA on weekdays 08-17."**
1. Find the contract (`uteamup_contract_list`) and customer (`uteamup_customer_search`).
2. Confirm terms, then `uteamup_service_agreement_create` with `contractGuid`, `customerGuid`,
   `effectiveFrom` (today, UTC), `defaultResponseMinutes` 120,
   `defaultResolutionMinutes` 480, `businessHoursStart` "08:00", `businessHoursEnd` "17:00",
   `businessDaysMask` 62, `pauseSlaOutsideBusinessHours` true, a new `idempotencyKey`.
3. Offer `uteamup_service_agreement_approve` if the user can approve.
