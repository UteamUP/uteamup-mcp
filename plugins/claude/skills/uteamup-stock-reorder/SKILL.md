---
name: uteamup-stock-reorder
description: "Checks UteamUP stock levels, finds items at or below their reorder point, reserves or issues parts for a work order, records planned incoming stock, raises part requisitions and turns reorder shortfalls into draft purchase orders. Use when the user says things like: what is running low, which parts are below minimum, reorder stock, reserve parts for this work order, take parts out for a job, we are expecting a delivery, raise a part request, create a purchase order from suggested orders, receive a purchase order."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP stock and reorder

Helps a maintenance team keep spare parts available: find what is low or out, see what can still
be promised, hold or issue stock for a work order, record deliveries that are on their way, and
move shortfalls into requisitions or draft purchase orders. Reading is free; every write is shown
to the user first and needs a clear yes.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | none |
| `uteamup_stock_get_tenant_alert_summary` | Count of active stock alerts | none |
| `uteamup_stock_get_tenant_alerts` | Paged stock alerts (out, low) | `page`, `pageSize`, `severity`, `alertType`, `stockGuid`, `search` |
| `uteamup_stock_search_items` | Find stock items and their levels | `q`, `itemType`, `stockGuid`, `stockStatus`, `sheet`, `sortBy`, `page`, `pageSize` |
| `uteamup_stock_list_locations` | List storerooms (stock locations) | none |
| `uteamup_stock_get_items_by_location` | Items in one storeroom, including `updatedAt` | `stockGuid` |
| `uteamup_stock_get_atp` | On hand, reserved, available-to-promise, backordered | `itemGuid` |
| `uteamup_part_search` / `uteamup_part_get_stock_levels` | Find a catalogue part and its stock across locations | `searchTerm`, `maxResults` / `partGuid` |
| `uteamup_workorder_search` / `uteamup_workorder_list` | Find the work order GUID | `searchFilter` / `search`, `openOnly`, `page`, `pageSize` |
| `uteamup_stock_create_reservation` | Hold stock for a work order or project | `stockItemGuid`, `quantity`, `workorderGuid`, `projectGuid`, `unitGuid`, `reservedUntil` |
| `uteamup_stock_list_reservations` / `uteamup_stock_release_reservation` | See or release holds | `itemGuid`, `workorderGuid`, `projectGuid` / `reservationGuid` |
| `uteamup_stock_remove` | Issue (take out) stock, optionally against a work order | `stockGuid`, `stockItemGuid`, `quantity`, `reason`, `expectedUpdatedAt`, `idempotencyKey`, `workorderGuid` |
| `uteamup_stock_get_workorder_stock` | Parts already used on a work order | `workorderGuid` |
| `uteamup_stock_create_planned_incoming` / `uteamup_stock_list_planned_incoming` | Record or list expected deliveries (no inventory change) | `stockItemGuid`, `quantity`, `expectedDate`, `datePrecision`, `vendorGuid`, `notes` |
| `uteamup_stock_convert_planned_incoming` | Turn one incoming plan into a Draft purchase order | `plannedIncomingGuid`, `expectedVersionGuid` |
| `uteamup_part_request_create` / `uteamup_part_request_list` | Raise or list part requisitions (Pending drafts) | `partName`, `quantity`, `partGuid`, `workorderGuid`, `assetGuid`, `urgency`, `requiredByDate` |
| `uteamup_stock_get_suggested_orders` | Reorder shortfalls grouped by vendor | none |
| `uteamup_stock_create_suggested_order_po` | Draft purchase order from one vendor group | `vendorGuid` (omit for the no-vendor group) |
| `uteamup_stock_list_purchase_orders` / `uteamup_stock_get_purchase_order` | Find and read purchase orders | `status`, `page`, `pageSize` / `guid` |
| `uteamup_stock_submit_purchase_order` | Send a Draft purchase order for approval | `guid` |
| `uteamup_stock_receive_purchase_order` | Book received lines into stock | `purchaseOrderGuid`, `receivedItems`, `idempotencyKey` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a tool
   reports no tenant or the wrong one, show the list and ask which company to use.
2. **What is low.** Start with `uteamup_stock_get_tenant_alert_summary`. For a list, call
   `uteamup_stock_search_items` with `sheet: "attention"` (out, below or near minimum) or
   `stockStatus: "low"` / `"out"` / `"near"`, `sortBy: "level"`, and a small `pageSize` (20–50).
   Each row has `currentStock`, `minimumAmount`, `maximumAmount`, `reorderPoint`, `stockLevel`,
   `plannedIncomingQuantity` and `earliestExpectedDate`. Summarise as a short table; mention
   items that already have incoming stock so the user does not order twice.
3. **Can we promise it.** Before reserving or issuing, call `uteamup_stock_get_atp` with the item
   GUID. Use `availableToPromise`, not on-hand, when telling the user what is free.
4. **Find the work order.** `uteamup_workorder_search` (`searchFilter`) or `uteamup_workorder_list`
   (`search`, `openOnly: true`). Use the returned GUID.
5. **Reserve for a job.** Show item, quantity and work order, get a yes, then call
   `uteamup_stock_create_reservation` with `stockItemGuid`, `quantity` and `workorderGuid`
   (or `projectGuid`). A hold with neither owner needs `reservedUntil`. For a serialized unit pass
   `unitGuid` and `quantity: 1`.
6. **Issue (take out) for a job.** Read the item's storeroom with
   `uteamup_stock_get_items_by_location` (`stockGuid`) to get its current `updatedAt`. Show the
   removal, get a yes, then call `uteamup_stock_remove` with `stockGuid`, `stockItemGuid`,
   `quantity`, a short `reason`, `expectedUpdatedAt` set to that `updatedAt`, a new
   `idempotencyKey` GUID, and `workorderGuid`. If the call fails because the item changed, re-read
   and ask again; on an uncertain network result retry with the same `idempotencyKey`. Release
   any reservation that the issue replaces with `uteamup_stock_release_reservation`.
   Confirm with `uteamup_stock_get_workorder_stock`.
7. **Expected delivery.** To record stock that is on its way, call
   `uteamup_stock_create_planned_incoming` (`stockItemGuid`, `quantity`, `expectedDate` as
   `YYYY-MM-DD`, optional `vendorGuid`, `notes`). Tell the user this is planning only: it never
   changes inventory or sends an order. To make it a Draft purchase order, read it with
   `uteamup_stock_list_planned_incoming`, then `uteamup_stock_convert_planned_incoming` with its
   `expectedVersionGuid`.
8. **Requisition.** When the user wants an approval request rather than an order, call
   `uteamup_part_request_create` (`partName`, `quantity`, optional `partGuid`, `workorderGuid`,
   `assetGuid`, `urgency`, `requiredByDate`, `notes`). It is created as Pending; nothing is
   ordered and stock is unchanged. Check existing ones first with `uteamup_part_request_list`.
9. **Reorder.** Call `uteamup_stock_get_suggested_orders`; show each vendor group with its lines
   and estimated total. For each group the user confirms, call
   `uteamup_stock_create_suggested_order_po` with that `vendorGuid`. The result is a Draft.
   Only submit it with `uteamup_stock_submit_purchase_order` after a separate yes.
10. **Receive.** Read the order with `uteamup_stock_get_purchase_order`, confirm the received
    quantities per line, then call `uteamup_stock_receive_purchase_order` with `purchaseOrderGuid`,
    `receivedItems` (`purchaseOrderItemGuid`, `receivedQuantity`; serialized lines also need `serialNumbers`) and a new `idempotencyKey`.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess one or use
  an integer id. Never match a stock item by name alone when two storerooms hold the same part.
- Make sure the right company is active before reading or writing stock.
- Before any reservation, issue, plan, requisition, purchase order, submit or receive, show
  exactly what will change (item, storeroom, quantity, work order, vendor) and get a clear yes.
- Stock records are archived, never deleted. This skill does not archive anything.
- Draft purchase orders are not orders. Approving a purchase order and sending it to the vendor
  are separate steps; do not approve on the user's behalf unless they explicitly ask
  (`uteamup_stock_approve_purchase_order` exists but needs the approver's own decision).
- Respect permission and storeroom-access errors (for example `Stock.View`,
  `StockTransaction.Create`, `StockPurchaseOrder.Create`). Report them; do not try another tool to
  get around them.
- Keep results short: filter, page (20–50 rows), and summarise.
- If a write tool is missing or refused because the connection is read-only, explain that
  writing requires the full UteamUP connection.
- Outside this skill: changing an item's min/max or reorder point (ask the user to do it in the
  UteamUP web app). Not available through MCP at all: approving, rejecting or ordering a part
  requisition (part requests can only be created, read and edited while Pending) and creating a
  free-form purchase order with hand-picked lines; ask the user to do these in the web app.

## Examples

**"What spare parts are running low in the main storeroom?"**
`uteamup_stock_list_locations` → `uteamup_stock_search_items` (`stockGuid`, `sheet: "attention"`,
`sortBy: "level"`, `pageSize: 25`) → short table with planned incoming noted.

**"Reserve two filter cartridges for work order 'Pump 3 service' and take one out now."**
`uteamup_workorder_search` → `uteamup_stock_search_items` (`q: "filter cartridge"`) →
`uteamup_stock_get_atp` → confirm → `uteamup_stock_create_reservation` (`quantity: 2`,
`workorderGuid`) → `uteamup_stock_get_items_by_location` → confirm →
`uteamup_stock_remove` (`quantity: 1`, `workorderGuid`, `expectedUpdatedAt`, `idempotencyKey`).

**"Reorder everything that is short."**
`uteamup_stock_get_suggested_orders` → show vendor groups → per confirmed group
`uteamup_stock_create_suggested_order_po` → ask before `uteamup_stock_submit_purchase_order`.
