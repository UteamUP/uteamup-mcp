---
name: uteamup-returns-and-repairs
description: Runs returns, repairs and warranty work in UteamUP through the UteamUP MCP server - customer returns and returns to vendor (RMA) from request through approval, shipping, receipt, inspection, credit, replacement or repair work order and closing; warranty records and expiry checks; and warranty claims on serialized stock units - finding records first, using GUIDs only and confirming every step. Use when the user says things like "return these faulty valves to the supplier", "a customer is sending back a pump", "approve RMA 1042", "we received the return, inspect it", "send it for repair", "is this asset still under warranty", "which warranties expire next month", "file a warranty claim for this serial number", or "the vendor approved our claim".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP returns, repairs and warranty

Guide goods that come back or go back: a **return case** follows a fixed lifecycle and every step
is a separate, confirmed transition on the exact current version of the case. **Warranties**
record coverage on assets, parts, tools and stock items. **Warranty claims** ask a vendor to pay
for a failed serialized stock unit. The skill reads first, shows the next step, and writes only
after a clear yes.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_return_case_list` | Page return cases | `page`, `pageSize` (1-200), `status`, `direction`, `customerGuid`, `vendorGuid`, `requestedFromUtc`, `requestedToUtc`, `search` |
| `uteamup_return_case_get` | One case with lines and `updatedAt` | `returnCaseGuid` |
| `uteamup_return_case_create` | Open a return | `model` (`idempotencyKey`, `direction`, `reason`, `customerGuid` or `vendorGuid`, `workorderGuid`, `assetGuid`, `stockPurchaseOrderGuid`, `lines` [`stockItemGuid`, `stockItemUnitGuid`, `quantity`, `condition`, `reason`]) |
| `uteamup_return_case_approve` / `uteamup_return_case_reject` / `uteamup_return_case_cancel` | Decide on a requested return | `returnCaseGuid`, `model` |
| `uteamup_return_case_ship` | Record outbound shipment (vendor returns remove stock once) | `returnCaseGuid`, `model` (+ `carrier`, `trackingNumber`, `shipmentReference`, `evidenceDocumentGuids`) |
| `uteamup_return_case_receive` | Receive a customer return into quarantine | `returnCaseGuid`, `model` |
| `uteamup_return_case_inspect` | Record a disposition for every line | `returnCaseGuid`, `model` (+ `dispositions` [`returnCaseLineGuid`, `disposition`]) |
| `uteamup_return_case_credit` | Issue one credit note or vendor credit memo | `returnCaseGuid`, `model` (+ `creditAmount`, `currency`) |
| `uteamup_return_case_replace` | Create one replacement fulfillment | `returnCaseGuid`, `model` |
| `uteamup_return_case_repair` | Create one repair work order | `returnCaseGuid`, `model` |
| `uteamup_return_case_close` | Close a resolved return | `returnCaseGuid`, `model` |
| `uteamup_stock_search_items` | Stock item GUIDs for return lines | `q`, `itemType`, `stockGuid` |
| `uteamup_stock_list_units` / `uteamup_stock_lookup_unit` | Serialized unit GUIDs | `itemGuid`, `serial` / `serial` |
| `uteamup_vendor_search` / `uteamup_customer_search` | Vendor or customer GUID | `nameFilter` |
| `uteamup_document_upload_with_content` | Upload photos or shipping papers as evidence | `fileName`, `fileContentBase64`, `contentType` |
| `uteamup_warranty_list` | Page warranties, title filter | `page`, `pageSize`, `titleFilter`, `sortBy`, `sortOrder` |
| `uteamup_warranty_list_for_entity` | Warranties on an asset, tool, part or chemical | `entityType`, `entityGuid` |
| `uteamup_warranty_get_expiring` / `uteamup_warranty_get_expired` | Warranties ending soon / ended | `days` (default 90) / none |
| `uteamup_warranty_get_by_warning_level` | Warranties by warning colour | `warningLevel` (0 none, 1 yellow, 2 orange, 3 red) |
| `uteamup_warranty_create` | Record a warranty | `model` (`title`, `warrantyNumber`, `type`, `status`, `priority`, `startDate`, `endDate`, `coverageValue`, `currency`, `vendorGuid`, `contactGuid`, `assetGuids`, `partGuids`, `stockItemGuids`, `contractGuids`, `warrantyTerms`, `claimProcedure`, `documentGuids`) |
| `uteamup_stock_asset_warranty_coverage` | Is an asset covered right now | `assetGuid` |
| `uteamup_stock_list_warranty_claims` | Warranty claims | `status` (Open, Submitted, Approved, Denied, Resolved), `page`, `pageSize` |
| `uteamup_stock_create_warranty_claim` | Claim for a failed serialized unit | `stockItemUnitGuid`, `vendorGuid`, `notes`, `claimedValue`, `currencyCode` |
| `uteamup_stock_transition_warranty_claim` | Move a claim forward | `claimGuid`, `status` (Submitted, Approved, Denied, Resolved), `resolution`, `recoveredValue`, `currencyCode` |
| `archive_record` / `restore_record` | Archive or restore a warranty | `recordType` `warranty`, `recordGuid` |

Every return-case transition `model` carries `idempotencyKey` (new GUID), `expectedUpdatedAt`
(the case's current `updatedAt`, UTC), `reason`, and `evidenceDocumentGuids` (use `[]` when there
is none), plus the step-specific fields above.

## Return lifecycle

`Requested` → `Approved` (or `Rejected` / `Cancelled`) → `Shipped` (return to vendor) or
`Received` (customer return, into quarantine) → `Inspected` → one commercial outcome:
`Credited`, `Replaced` or `Repairing` (repair work order) → `Closed`.
`direction`: 0 = CustomerReturn, 1 = ReturnToVendor. Line `disposition` at inspection:
1 Restock, 2 Scrap, 6 RepairHold, 7 ReturnToVendor (3-5 are refused).

## Workflow

1. **Confirm the company.** If a tool reports no tenant or access denied, call
   `uteamup_tenant_get_my_tenants`, show it and ask which company to use.
2. **Find the case or the goods.** Existing case: `uteamup_return_case_list` with `search` (case,
   shipment or tracking number) or `status`, then `uteamup_return_case_get`. New case: find the
   vendor or customer, then each stock item with `uteamup_stock_search_items` and, for
   serialized goods, the unit with `uteamup_stock_lookup_unit` (by serial).
3. **Open a return.** Show direction, party, reason and each line (item, unit serial, quantity,
   condition). On a yes call `uteamup_return_case_create` with a new `idempotencyKey`.
4. **Each next step.** Read the case, state its status and the one next step, ask for a yes, then
   call the matching transition with `expectedUpdatedAt` from that read:
   - approve, reject or cancel (reject and cancel need a `reason`);
   - ship with carrier and tracking number, or receive for a customer return;
   - inspect with a disposition for **every** line;
   - then exactly one of credit (`creditAmount`, `currency`), replace, or repair (creates a repair
     work order; report its reference to the user);
   - close once resolved.
5. **Evidence.** Upload photos or papers with `uteamup_document_upload_with_content` and pass the
   returned GUIDs in `evidenceDocumentGuids`.
6. **Warranty check.** For an asset use `uteamup_stock_asset_warranty_coverage`; for a part, tool
   or chemical use `uteamup_warranty_list_for_entity`. Report provider, end date and terms.
7. **Expiry review.** `uteamup_warranty_get_expiring` with `days` (for example 30) and summarise
   title, item, provider and end date, soonest first.
8. **New warranty.** Find the item and vendor GUIDs, show the record, then
   `uteamup_warranty_create` (`type` 0 Manufacturer, 1 Extended, 2 Service, 3 Parts; `status`
   1 Active; `priority` 1-4).
9. **Warranty claim** for a failed serialized unit: `uteamup_stock_create_warranty_claim` (vendor
   defaults to the unit's purchase vendor). Move it with
   `uteamup_stock_transition_warranty_claim` as the vendor answers; `recoveredValue` only with
   `Resolved`.
10. **Report** the new status and what the user should do next (for example "ship it and send me
    the tracking number").

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never guess one and
  never use integer ids. Do not use `uteamup_warranty_get`, `uteamup_warranty_update` or
  `uteamup_warranty_delete` (integer ids). Editing an existing warranty is not available through
  MCP with GUIDs; ask the user to edit it in the web app.
- Make sure the right company is active before writing.
- Before every create and every transition, show what will change and get a clear yes. One yes
  covers one step only.
- Never skip lifecycle steps and never retry a transition with a new `idempotencyKey` after a
  timeout: retry with the same request, or re-read the case to see whether it already moved.
- An `expectedUpdatedAt` conflict means the case changed: re-read, show the new status, ask again.
- Shipping a vendor return removes stock; crediting issues a financial document; repair creates a
  work order. Say this plainly before asking for the yes.
- Records are archived, never deleted. Archive a warranty with `archive_record` (`warranty`).
- Respect permission errors (ReturnCase.Create, .Approve, .Ship, .Receive, .Inspect, .Credit,
  .Replace, .Repair, .Close, Warranty): report them and do not route around them.
- Keep answers short: page with `pageSize` 10-25 and summarise.
- If write tools are missing, the connection is read-only; explain that changes need the full
  UteamUP connection.

## Examples

**"Send the 3 leaking valves back to Nordic Valves."**
1. `uteamup_vendor_search` `{ "nameFilter": "Nordic Valves" }`, `uteamup_stock_search_items` `{ "q": "valve" }`.
2. Confirm, then `uteamup_return_case_create` `{ "model": { "idempotencyKey": "<new>", "direction": 1, "reason": "Leaking on delivery", "vendorGuid": "<vendor>", "lines": [ { "stockItemGuid": "<item>", "quantity": 3, "condition": "Leaking" } ] } }`
3. Next step: approve (needs ReturnCase.Approve).

**"We got the pump back from the customer, it is beyond repair."**
1. `uteamup_return_case_list` `{ "search": "<case or tracking no.>" }` → `uteamup_return_case_get`.
2. On yes: `uteamup_return_case_receive`; re-read; then `uteamup_return_case_inspect` with
   `dispositions` `[ { "returnCaseLineGuid": "<line>", "disposition": 2 } ]`.
3. Ask whether to credit or replace, then call that one transition.

**"Which warranties run out in the next 30 days?"**
1. `uteamup_warranty_get_expiring` `{ "days": 30 }`
2. List title, covered item, provider and end date; offer to open a renewal contract.
