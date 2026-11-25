---
name: uteamup-asset-onboarding
description: "Registers a new asset in UteamUP end to end: checks it does not already exist, picks the asset type and location, creates the asset, fills type attributes, uploads manuals, photos and warranty files and links them to the asset, sets the profile picture, and optionally adds the asset to a group and attaches QR, barcode, NFC or KKS codes. Use when the user says things like: add this machine to UteamUP, register a new asset, onboard the new compressor, create an asset for this pump, attach the manual to the asset, upload a photo of the equipment, put it in the production line group, give it a QR code, link this KKS code."
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP asset onboarding

Takes a piece of equipment from "we just bought it" to a complete asset record: the right type,
the right place, its identifying details, its documents and, when wanted, its group and scan
codes. Reading is free; every write is shown to the user first and needs a clear yes. Preventive
maintenance for the new asset is a separate step (the `uteamup-preventive-maintenance` skill, if
available).

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Confirm which company the connection uses | `page` |
| `uteamup_asset_search` | Find existing assets by name or serial number | `searchFilter` |
| `uteamup_asset_get_by_guid` | Read one asset (includes `updatedAt`) | `guid` |
| `uteamup_asset_type_list` / `uteamup_asset_type_get_tree` | Pick an asset type | `includeInactive` / none |
| `uteamup_asset_type_get_with_inherited` | Type attributes, including inherited ones | `assetTypeGuid` |
| `uteamup_asset_type_create` | New custom type, only if none fits | `model` (`name`, `categoryGroup`, `parentAssetTypeGuid`, `isMetered`) |
| `uteamup_location_list` | Find the location | `search`, `page`, `pageSize` |
| `uteamup_location_node_tree` | Rooms and areas inside a location | `locationGuid` |
| `uteamup_location_create` | New site or building, only if none fits | `model` (`name`, address fields) |
| `uteamup_asset_create` | Create the asset | `model` |
| `uteamup_asset_patch` | Change only the fields passed | `assetGuid` plus fields |
| `uteamup_meterreading_update_attributes` | Fill type attribute values | `assetGuid`, `request.values` |
| `uteamup_meterreading_record` | First meter reading (baseline) | `assetGuid`, `request` |
| `uteamup_document_find_by_hash` | Reuse a file already stored | `sha256` |
| `uteamup_document_list` | Find an existing document | `page`, `pageSize` |
| `uteamup_document_upload_with_content` | Upload a file as base64 | `fileName`, `fileContentBase64`, `contentType`, `description` |
| `uteamup_asset_add_document` | Link a document to the asset | `assetGuid`, `documentGuid` |
| `uteamup_asset_set_image_from_document` | Use a linked image as the profile picture | `assetGuid`, `documentGuid` |
| `uteamup_asset_get_aggregated_documents` | Check what is linked | `assetGuid` |
| `uteamup_asset_group_list` / `uteamup_asset_group_members_add` | Find a group, add the asset | `search`, `kind` / `groupGuid`, `model.assetGuids` |
| `uteamup_asset_group_create` | New group, only if none fits | `model` (`name`, `kind`, `memberAssetGuids`) |
| `uteamup_code_resolve` | Check whether a scanned value is already used | `value` |
| `uteamup_code_list` / `uteamup_code_get_unassigned` | Find existing codes | `nameFilter`, `typeFilter`, `isAssigned` |
| `uteamup_code_assign_to_asset` | Link an existing code | `codeGuid`, `assetGuid` |
| `uteamup_code_register_for_target` | Register a sticker already scanned | `targetType: "asset"`, `targetGuid`, `type`, `value` |
| `uteamup_code_generate_for_target` | Generate a new QR or barcode to print | `targetType: "asset"`, `targetGuid`, `type` |
| `uteamup_code_create` | Create a code, including KKS | `model` (`code`, `description`, `type`, `value`), `assetGuid` |
| `uteamup_code_get_by_asset` | Codes now on the asset | `assetGuid` |

## Workflow

1. **Company.** If unsure which company is active, call `uteamup_tenant_get_my_tenants`. If a
   tool reports no tenant or the wrong one, show the list and ask which company to use.
2. **Collect the facts.** Name, manufacturer, model number, serial number, year of manufacture,
   purchase and installation dates, where it is, what kind of equipment it is, and which files
   come with it. Ask only for what is missing; do not invent values.
3. **No duplicates.** `uteamup_asset_search` with the serial number, then the name. If a match
   exists, show it and ask whether to update that asset (`uteamup_asset_patch`) instead.
4. **Type.** `uteamup_asset_type_list` (or `uteamup_asset_type_get_tree` for the hierarchy).
   Suggest the closest type and confirm it. Create a type only if the user agrees nothing fits.
   Call `uteamup_asset_type_get_with_inherited` to see which attributes and meters the type adds.
5. **Location.** `uteamup_location_list` with `search`. For a room or area inside a site, use
   `uteamup_location_node_tree` and take the node GUID as `locationFloorGuid`. Locations do not
   nest; never create a second location for a room. Create a location only if the site is new.
6. **Confirm and create.** Show a summary, then call `uteamup_asset_create` with `model`:
   `name` (required, unique in the company), `primaryAssetTypeGuid` (and `assetTypeGuids` for
   extra types), `locationGuid`, `locationFloorGuid`, `serialNumber`, `modelNumber`,
   `manufacturer`, `manufactureYear`, `description`, `notes`, optional `categoryGuid`,
   `parentAssetGuid`, `manufacturerVendorGuid`, `purchaseDate`, `installationDate`. Purchase date
   must not be after installation date. Keep the returned `externalGuid`.
7. **Attributes and meters.** If the type has attributes, call
   `uteamup_meterreading_update_attributes` with `request.values` as
   `[{attributeDefinitionGuid, rawValue}]`. For a meter, offer a first reading with
   `uteamup_meterreading_record` (`request.attributeDefinitionGuid`, `request.readingValue`).
8. **Documents.** For each file:
   - Compute the SHA-256 of the bytes when you can and call `uteamup_document_find_by_hash`. If a
     document comes back, link that one instead of uploading again.
   - Otherwise call `uteamup_document_upload_with_content` with `fileName` (with extension),
     `fileContentBase64`, `contentType` (`application/pdf`, `image/jpeg`, `image/png`, …) and a
     short `description`.
   - Link it with `uteamup_asset_add_document` (`assetGuid`, `documentGuid`). Uploading alone
     does not link it. Linking twice is harmless.
   - For a photo the user wants as the asset picture, call
     `uteamup_asset_set_image_from_document` after linking.
   - Finish with `uteamup_asset_get_aggregated_documents` to confirm.
9. **Group (optional).** `uteamup_asset_group_list` with `search`; add with
   `uteamup_asset_group_members_add` (`model.assetGuids: [assetGuid]`). Kinds: `1` System, `2`
   ProductionLine, `3` Area, `4` Fleet, `5` Utility, `6` SafetySystem, `99` Custom.
10. **Codes (optional).**
    - Sticker already on the machine: `uteamup_code_resolve` with the scanned value first; if
      free, `uteamup_code_register_for_target` (`targetType: "asset"`, `type` QR, BARCODE or NFC,
      `value` exactly as scanned).
    - Need a new sticker: `uteamup_code_generate_for_target` (`type` QR or BARCODE).
    - Existing unassigned code: `uteamup_code_list` (`isAssigned: false`) then
      `uteamup_code_assign_to_asset`.
    - KKS or other industry code: `uteamup_code_create` with `type: "KKS"`, `code`, `value`,
      `description` and `assetGuid`. Placing an asset in a coded hierarchy (code catalog) is done
      with `uteamup_asset_edit_code_assignment` only for assets that are already coded; full
      catalog import is not available through MCP, ask the user to use the web app.
11. **Report.** Give the asset name, GUID, type, location, linked documents, group and codes, and
    anything that was skipped.

## Document size

`uteamup_document_upload_with_content` sends the whole file inside one tool call as base64, which
is about one third larger than the file (a 9 MB file becomes about 12 MB). The MCP transport and
the storage provider each have their own request limits, and the tool does not promise one fixed
maximum. So:

- Small files (photos, short PDFs) are fine. For large manuals or drawings, tell the user the
  upload may fail and that the web app (or the API multipart upload) handles large files better.
- Only upload files you can actually read. Never put a file path or URL in place of the content.
- If an upload times out, the result is unknown: check `uteamup_document_find_by_hash` before
  retrying so the same file is not stored twice.
- `uteamup_document_upload` takes metadata only; it does not carry file bytes. Do not use it to
  upload a file.

## Rules

- Identifiers are GUIDs. Search or list first and use the returned GUID; never guess or use
  integer ids (do not use `uteamup_asset_get` with a number or `uteamup_location_get`).
- Before any create, update, link or code change, show the user what will happen and get a clear
  yes. One confirmation may cover the whole onboarding summary if it lists every step.
- Records are archived, never deleted. Do not call `uteamup_asset_delete` (it deletes
  permanently). To undo a mistaken asset, tell the user; archiving goes through
  `uteamup_asset_archive_preview` and `uteamup_asset_archive` with their review.
- Prefer `uteamup_asset_patch` over `uteamup_asset_update` for later changes; `update` replaces
  every field. Pass `expectedUpdatedAtUtc` from the last read so another person's edit is not
  overwritten. Set-type fields (`documentGuids`, `toolGuids`, `assetTypeGuids`, …) replace the
  whole set; use `addDocumentGuids` to add without removing.
- A scanned code value must be passed exactly as read. If `uteamup_code_resolve` shows it belongs
  to another record, stop and ask.
- Respect permission errors (for example Asset.Create, Documents.Upload, Asset.Update): report
  them and stop; do not try another tool to get around them.
- Keep results short: use `page`/`pageSize` and search filters; summarise lists.
- If a write tool is unavailable (read-only connection), explain that registering assets needs the
  full UteamUP connection.

## Examples

**"Add our new Atlas Copco GA37 compressor, serial API123456, in the Boiler room at Plant 2, and
attach the manual."**
`uteamup_asset_search` (serial, then name) → `uteamup_asset_type_list` → `uteamup_location_list`
(`search: "Plant 2"`) → `uteamup_location_node_tree` (Boiler room) → confirm →
`uteamup_asset_create` → `uteamup_document_find_by_hash` → `uteamup_document_upload_with_content`
→ `uteamup_asset_add_document` → `uteamup_asset_get_aggregated_documents`.

**"Use this photo as the picture for pump P-204 and give it a QR sticker."**
`uteamup_asset_search` → confirm → `uteamup_document_upload_with_content` (`image/jpeg`) →
`uteamup_asset_add_document` → `uteamup_asset_set_image_from_document` →
`uteamup_code_generate_for_target` (`targetType: "asset"`, `type: "QR"`).

**"Put the three new conveyors in the Packing line group and link KKS 10LBA20AP001 to the first."**
`uteamup_asset_search` ×3 → `uteamup_asset_group_list` (`search: "Packing"`) → confirm →
`uteamup_asset_group_members_add` → `uteamup_code_resolve` → `uteamup_code_create`
(`type: "KKS"`, `assetGuid`).
