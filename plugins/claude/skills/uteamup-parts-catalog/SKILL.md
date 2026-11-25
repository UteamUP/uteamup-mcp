---
name: uteamup-parts-catalog
description: Maintains the spare-parts catalog in UteamUP through the UteamUP MCP server - creating and updating parts, kits and their components, cross-references and superseded numbers, vendor catalog entries with cost and lead time, asset-type compatibility, part images and documents, and draft part requisitions - always searching for duplicates first, using GUIDs only and confirming before each write. Use when the user says things like "add this bearing to the catalog", "is there already a part with number 6205-2RS", "this part replaces the old one", "add Acme as a supplier for this filter at 12 EUR", "make a service kit for the pump", "can we build 5 kits", "which machines does this belt fit", "attach the datasheet to this part", or "request two new SSDs for server 3".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP parts catalog

Keep the parts master data clean and useful: one record per real part, with the right numbers,
suppliers, compatible equipment, pictures and datasheets, and kits that bundle parts for a job.
Also raise part requisitions (draft purchase requests) for parts that are needed. Stock
quantities, transfers and purchase orders belong to stock work, not to this skill.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_part_search` | Find parts by name, description, part or serial number | `searchTerm`, `maxResults` |
| `uteamup_part_list` | Page parts, optional name filter and sort | `pageNumber`, `pageSize` (max 100), `nameFilter`, `sortBy`, `sortOrder` |
| `uteamup_part_get` | One part with specifications and vendor | `partGuid` |
| `uteamup_part_get_stock_levels` | Stock per location (read only) | `partGuid` |
| `uteamup_part_create` | New part | `name`, `description`, `partNumber`, `manufacturer`, `modelNumber`, `sku`, `unitOfMeasure`, `value`, `currencyGuid`, `vendorGuid`, `categoryGuid`, `weightKg`, `notes` |
| `uteamup_part_update` | Change part fields (omitted fields stay) | `partGuid` + the fields to change |
| `uteamup_part_list_cross_references` | OEM, alternate and superseded numbers | `partGuid` |
| `uteamup_part_add_cross_reference` | Add a number | `partGuid`, `referenceType` (OEM, Alternate, Supersedes, SupersededBy, Competitor, Custom), `referenceNumber`, `manufacturer`, `relatedPartGuid`, `notes` |
| `uteamup_part_delete_cross_reference` | Remove a number | `partGuid`, `referenceGuid` |
| `uteamup_part_list_vendor_catalog` | Suppliers of a part with price and lead time | `partGuid` |
| `uteamup_part_upsert_vendor_catalog` | Add or change a supplier entry | `partGuid`, `vendorGuid`, `vendorPartNumber`, `unitCost`, `currencyGuid`, `minimumOrderQuantity`, `leadTimeDays`, `isPreferred` |
| `uteamup_part_delete_vendor_catalog` | Remove a supplier entry | `partGuid`, `entryGuid` |
| `uteamup_vendor_get_catalog` | Everything one vendor supplies | `vendorGuid` |
| `uteamup_part_list_kit_components` | Components of a kit part | `partGuid` |
| `uteamup_part_add_kit_component` | Add a component to a kit | `partGuid` (kit), `componentPartGuid`, `quantity` (min 0.01) |
| `uteamup_part_delete_kit_component` | Remove a component line | `partGuid`, `componentGuid` |
| `uteamup_part_get_kit_availability` | How many kits can be built from stock | `partGuid` |
| `uteamup_part_list_compatibility` | Asset types a part fits | `partGuid` |
| `uteamup_part_add_compatibility` | Declare fitment to an asset type | `partGuid`, `assetTypeGuid`, `notes` |
| `uteamup_part_delete_compatibility` | Remove a fitment | `partGuid`, `compatibilityGuid` |
| `uteamup_asset_type_list_compatible_parts` | Parts that fit an asset type | `assetTypeGuid` |
| `uteamup_asset_type_list` | Asset types and GUIDs | `includeInactive` |
| `uteamup_part_upload_image` | Upload a part picture | `partGuid`, `fileName`, `contentType` (image/png or image/jpeg), `base64Content` (max 2 MB) |
| `uteamup_part_set_image_from_document` | Use an attached image as the main picture | `partGuid`, `documentGuid` |
| `uteamup_part_add_document` / `uteamup_part_remove_document` | Attach or detach a document | `partGuid`, `documentGuid` |
| `uteamup_document_find_by_hash` / `uteamup_document_upload_with_content` | Reuse or upload a datasheet | `sha256` / `fileName`, `fileContentBase64`, `contentType` |
| `uteamup_part_request_create` | Draft requisition in Pending status | `partName`, `quantity`, `partGuid`, `partNumber`, `assetGuid`, `workorderGuid`, `preferredVendorGuid`, `deliveryLocationGuid`, `urgency`, `requiredByDate`, `notes` |
| `uteamup_part_request_list` | List requisitions | `status`, `urgency`, `assetGuid`, `workorderGuid`, `page`, `pageSize` |
| `uteamup_part_request_get` | One requisition | `requestGuid` |
| `uteamup_part_request_update` | Change a requisition (send all fields) | `requestGuid` + the create fields |
| `uteamup_vendor_search` | Vendor GUID by name | `nameFilter` |
| `uteamup_category_list` | Categories and GUIDs | none |
| `uteamup_currency_list` | Currency GUIDs | `nameFilter` |

## Workflow

1. **Confirm the company.** If a tool reports no tenant or access denied, call
   `uteamup_tenant_get_my_tenants`, show it and ask which company to use.
2. **Search for duplicates first.** Call `uteamup_part_search` with the part number, then with
   the name. Also check cross-references of close matches
   (`uteamup_part_list_cross_references`). If a match exists, propose updating it or adding a
   cross-reference instead of creating a new part.
3. **Resolve related GUIDs:** vendor (`uteamup_vendor_search`), category
   (`uteamup_category_list`), currency (`uteamup_currency_list` with `nameFilter` such as `EUR`),
   asset type (`uteamup_asset_type_list`).
4. **Show the proposed record or change** (name, numbers, manufacturer, unit, price and
   currency, vendor, category) and ask for a clear yes.
5. **Write after the yes.**
   - New part: `uteamup_part_create`. Then add extra numbers with
     `uteamup_part_add_cross_reference`.
   - Change: `uteamup_part_update` with `partGuid` and only the fields to change.
   - Supersession: on the new part add `Supersedes` with the old number and `relatedPartGuid` set
     to the old part; optionally add `SupersededBy` on the old part.
   - Supplier: `uteamup_part_upsert_vendor_catalog`; set `isPreferred` true for the default
     supplier only if the user says so.
   - Fitment: `uteamup_part_add_compatibility` per asset type.
6. **Kits.** A kit is a part with components. Create (or find) the kit part, then call
   `uteamup_part_add_kit_component` for each component with its quantity per kit. Check
   `uteamup_part_get_kit_availability` to tell the user how many kits stock can supply.
7. **Pictures and documents.** For a datasheet, hash the file and call
   `uteamup_document_find_by_hash`; upload with `uteamup_document_upload_with_content` only if it
   is new, then `uteamup_part_add_document`. For a photo use `uteamup_part_upload_image` (PNG or
   JPEG, at most 2 MB, base64 without a data-URL prefix).
8. **Requisitions.** `uteamup_part_request_create` makes a Pending draft; nothing is ordered or
   approved and stock does not change. Link `partGuid` when the part exists, plus the asset or
   work order it is for. Approval, ordering and rejection are done by procurement reviewers in
   the web app; they are not available through MCP.
9. **Report** the part with its key numbers and what was linked; offer the next step.

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never guess one and
  never use integer ids (`id`, `categoryId`, `vendorId` arguments).
- Make sure the right company is active before writing.
- One real part, one record. Never create a part without searching for it first.
- Before any create, update, link, removal or requisition, show what will change and get a clear
  yes. Removing a cross-reference, supplier entry, kit line or fitment removes a line inside the
  part; still confirm it.
- Parts are archived, never deleted. Never call `uteamup_part_delete` (permanent, integer id).
  Archiving a part is not available through MCP with GUIDs; ask the user to archive it in the
  web app.
- `uteamup_part_request_update` replaces the whole requisition; omitting `partGuid` clears the
  catalog link. Read it with `uteamup_part_request_get` first and send every field back.
- Prices: always pair a cost with a currency GUID; never guess a price.
- Respect permission errors (Parts, Vendor, Document.Upload); report them and do not route around
  them with other tools.
- Keep answers short: `maxResults` or `pageSize` 10-25, summarise, offer more.
- If write tools are missing, the connection is read-only; explain that changes need the full
  UteamUP connection.

## Examples

**"Add SKF 6205-2RS bearing, 8.50 EUR from Nordic Bearings."**
1. `uteamup_part_search` `{ "searchTerm": "6205-2RS", "maxResults": 10 }` → no match.
2. `uteamup_vendor_search` `{ "nameFilter": "Nordic Bearings" }`, `uteamup_currency_list` `{ "nameFilter": "EUR" }`.
3. Confirm, then `uteamup_part_create` `{ "name": "Bearing 6205-2RS", "partNumber": "6205-2RS", "manufacturer": "SKF", "unitOfMeasure": "pcs", "value": 8.5, "currencyGuid": "<EUR>", "vendorGuid": "<vendor>" }`
4. `uteamup_part_upsert_vendor_catalog` with the vendor part number and `unitCost` 8.5.

**"Make a pump service kit: 1 seal kit and 2 O-rings."**
1. `uteamup_part_search` for each part and for an existing "pump service kit".
2. Confirm, `uteamup_part_create` `{ "name": "Pump service kit" }` if missing.
3. `uteamup_part_add_kit_component` twice (`quantity` 1 and 2), then
   `uteamup_part_get_kit_availability`.

**"We need two 1 TB SSDs for server 3 by Friday."**
1. `uteamup_asset_search` `{ "searchFilter": "server 3" }`, `uteamup_part_search` `{ "searchTerm": "1TB SSD" }`.
2. Confirm, then `uteamup_part_request_create` `{ "partName": "1 TB NVMe SSD", "quantity": 2, "partGuid": "<if found>", "assetGuid": "<server 3>", "urgency": "high", "requiredByDate": "<Friday>" }`
