---
name: uteamup-industry-coding
description: Looks up, creates and assigns industrial reference designations (KKS, RDS-PP, IEC 81346, ISO 14224 and tenant-defined systems) on UteamUP assets, records failure codes in the failure knowledge base and attaches compliance codes to assets, tools, parts, chemicals and locations. Use when the user says things like "what is the KKS code of this pump", "tag this asset with 1LAB10 AP001", "which assets are under code 1-HLA", "create the designation FOL 1LBA3 CT001", "remove the wrong code from this asset", "find a failure code for bearing overheating", "add a failure code", "which compliance codes does this asset have" or "add an ISO 14224 code to this tool".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP industry coding

UteamUP keeps three kinds of codes. **Industry codes** are entries in a coding-system
catalog (KKS, RDS-PP, ISO 14224 or a tenant's own system) arranged as a tree of plant,
system, equipment and component tiers; an asset is tagged with one catalog entry.
**Failure codes** are a knowledge base of failure types with symptoms, causes and fixes,
used when work is completed or failures are analysed. **Compliance codes** link a code
from a compliance standard (for example ISO14224, UNSPSC, ECLASS) to an asset, tool,
part, chemical or location. This skill helps an agent find the right code, show it to
the user, and assign or create it safely. See `references/code-systems.md` for how the
common code systems are built.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix (for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_tenant_get_my_tenants` | Companies the user belongs to | – |
| `uteamup_tenant_industry_profiles_get` | Primary and additional industry profiles of the company | – |
| `uteamup_codingsystem_list` | Coding systems available to the company | – |
| `uteamup_codingsystem_tree` | Browse the catalog one level at a time | `codingSystemGuid`, `parentGuid` (omit for roots) |
| `uteamup_codingsystem_search_assets` | Assets whose code starts with a prefix | `codePrefix` |
| `uteamup_codingsystem_workorders` | Work orders under a code branch | `codeBranchPrefix` |
| `uteamup_codecatalog_history` | Activity timeline of one code | `codeGuid`, `types`, `fromUtc`, `toUtc`, `cursor`, `pageSize` |
| `uteamup_codingsystem_next_code` | Next free child code under a parent | `parentEntryGuid` |
| `uteamup_codingsystem_parent_candidates` | Assets that may anchor a non-root code | `codeCatalogEntryGuid` |
| `uteamup_codingsystem_next_plant_sequence` | Next plant sequence number for a root code | `codeCatalogEntryGuid` |
| `uteamup_codingsystem_create_code_by_path` | Create a whole designation, reusing existing tiers | `codingSystemGuid`, `codePath`, `name`, `description`, `acknowledgeNonStandard` |
| `uteamup_codingsystem_create_plant_code` | Create a root (plant-tier) entry | `codingSystemGuid`, `code`, `name`, `description` |
| `uteamup_codingsystem_update_entry_by_guid` | Rename or describe a catalog entry | `entryGuid`, `model` (`name`, `description`, `componentTypeCode`, `componentTypeDescription`, `iconName`) |
| `uteamup_codingsystem_deactivate_entry_by_guid` | Retire a catalog entry (soft, cascades to children) | `entryGuid` |
| `uteamup_asset_search` | Find an asset by name or serial number | `searchFilter` |
| `uteamup_codingsystem_assign_asset` | Tag an asset with a catalog entry (audited) | `assetGuid`, `codeCatalogEntryGuid` |
| `uteamup_asset_edit_code_assignment` | Change an asset's code segment, entry or parent | `assetGuid`, `desiredCode`, `codeCatalogEntryGuid`, `parentAssetGuid`, `demoteToRoot`, `name` |
| `uteamup_codingsystem_remove_asset_assignment` | Untag an asset (catalog entry unchanged) | `assetGuid` |
| `uteamup_failure_code_search` | Find failure codes by symptom, cause or keyword | `searchTerm` |
| `uteamup_failure_code_list` | Page through failure codes | `page`, `pageSize`, `nameFilter`, `categoryId` |
| `uteamup_failure_code_get_most_common` | Most used failure codes | `count` |
| `uteamup_failure_code_get` | One failure code | `id` (numeric, from a list/search result) |
| `uteamup_failure_code_create` | Add a failure code | `model` (`code`, `name`, `description`, `commonSymptoms`, `possibleCauses`, `diagnosticSteps`, `knownFixes`, `preventiveMeasures`) |
| `uteamup_failure_code_update` | Change a failure code | `id`, `model` |
| `archive_record` | Archive a failure code | `recordType` = `failurecode`, `recordGuid` |
| `uteamup_compliance_standard_list` | Compliance standards (returns `standardGuid`) | `includeGlobal` |
| `uteamup_compliance_standard_get_by_code` | One standard by code | `standardCode` (for example `ISO14224`) |
| `uteamup_compliance_code_list_for_entity` | Compliance codes on one record | `entityType` (asset, tool, part, chemical, location), `entityGuid` |
| `uteamup_compliance_code_list` | Search all compliance codes | `page`, `pageSize`, `codeFilter`, `standardCodeFilter`, `entityTypeFilter` |
| `uteamup_compliance_code_create` | Attach a compliance code | `model` (`code`, `complianceStandardGuid`, `entityType`, `entityGuid`, `notes`, `externalReference`) |
| `uteamup_compliance_code_update` | Correct or deactivate a compliance code | `id`, `model` (full values plus `isActive`) |
| `uteamup_location_list` | Find a location GUID | `search`, `page`, `pageSize` |

## Workflow

### A. Look up a code or the assets behind it
1. If the company's coding standard is unknown, call `uteamup_tenant_industry_profiles_get`
   and `uteamup_codingsystem_list`. Keep the `codingSystemGuid` of the system the user means.
2. For "which assets are under X", call `uteamup_codingsystem_search_assets` with
   `codePrefix` = the code exactly as written (for example `1-HLA` or `1LAB10`). Summarise
   name, code and status; do not print full records.
3. For "what code does asset Y have", find the asset with `uteamup_asset_search` and read
   its code fields from the result.
4. To find a catalog entry, walk `uteamup_codingsystem_tree` from the roots, passing each
   chosen node's `externalGuid` as `parentGuid`. Stop when the node's display code matches.
5. For history or open work on a code, use `uteamup_codecatalog_history` (`codeGuid`) or
   `uteamup_codingsystem_workorders` (`codeBranchPrefix`).

### B. Tag an asset with an industry code
1. Resolve the asset GUID with `uteamup_asset_search`. If several match, ask which one.
2. Find the catalog entry as in A.4. If it does not exist, go to C first.
3. For a non-root code, `uteamup_codingsystem_parent_candidates` shows where the asset can
   sit in the plant tree; for a plant-tier code, `uteamup_codingsystem_next_plant_sequence`
   shows the number the asset will receive (for example 1FOL, 2FOL).
4. Show the user: asset name, current code (if any), new code and coding system. Ask for a clear yes.
5. Call `uteamup_codingsystem_assign_asset` with `assetGuid` and `codeCatalogEntryGuid`.
6. Verify with `uteamup_codingsystem_search_assets` using the new code as `codePrefix`.
7. To correct a wrong code later, use `uteamup_asset_edit_code_assignment` (only the fields
   that change) or `uteamup_codingsystem_remove_asset_assignment`, each after confirmation.

### C. Create a missing designation
1. Ask for the designation exactly as printed on the drawing or register.
2. Show the full path that will be created and which tiers already exist (from the tree).
3. After a yes, call `uteamup_codingsystem_create_code_by_path` with `codingSystemGuid`,
   `codePath` and an optional leaf `name`. Existing tiers are reused.
4. If the call rejects a segment as non-standard, explain the format problem. Only retry
   with `acknowledgeNonStandard: true` if the user explicitly wants a custom code.
5. For a single new child under a known parent, `uteamup_codingsystem_next_code` gives the
   next free number; for an empty catalog, `uteamup_codingsystem_create_plant_code` adds a root.

### D. Failure codes
1. Search first: `uteamup_failure_code_search` with the symptom or cause words, or
   `uteamup_failure_code_get_most_common`. Offer the best two or three matches with code,
   name and a one-line cause.
2. A failure is recorded against a work order when it is completed (the completion tool
   accepts a `failure` object with `failureCodeGuid`); pass the code's `externalGuid` there.
3. To add a new code, check that no similar code exists, draft the fields, confirm, then
   call `uteamup_failure_code_create`. To retire one, confirm and call `archive_record`
   with `recordType: "failurecode"` and the code's `externalGuid`.

### E. Compliance codes
1. Resolve the target record GUID (asset, tool, part, chemical or location).
2. Read existing codes with `uteamup_compliance_code_list_for_entity`.
3. Find the standard with `uteamup_compliance_standard_get_by_code` or
   `uteamup_compliance_standard_list`; use its `standardGuid`.
4. Confirm, then call `uteamup_compliance_code_create` with `code`,
   `complianceStandardGuid`, `entityType` and `entityGuid`.
5. To retire a code, read it, then call `uteamup_compliance_code_update` with the same
   values and `isActive: false`.

## Rules

- Identifiers are GUIDs. Search or list first, then use the returned GUID; never guess or
  use integer ids. Exception: `uteamup_failure_code_get`, `uteamup_failure_code_update`
  and `uteamup_compliance_code_update` only accept the numeric `id`; use only the `id`
  returned by a list or search call in the same conversation.
- Make sure the right company (tenant) is active. If a tool reports no tenant or the wrong
  tenant, call `uteamup_tenant_get_my_tenants` and ask the user which company to use.
- Before any create, update, assign, unassign, deactivate or archive, show exactly what will
  change and get a clear yes. Records are archived or deactivated, never deleted. Do not
  call `uteamup_compliance_code_delete` or `uteamup_failure_code_delete`; deactivate or use
  `archive_record` instead.
- Write codes exactly as the user or drawing gives them. Do not "fix" spacing, separators or
  leading digits without asking; a different separator can be a different code.
- One asset carries one industry code. Reassigning replaces the old code; say so.
- Respect permission errors (for example `Asset.UpdateCodeAssignment`, `Coding.Create`,
  `Compliance.Create`). Report them; do not retry with other tools to get around them.
- Keep results short: use prefixes, filters and paging; summarise instead of dumping trees.
- If a write tool is unavailable (read-only connection), explain that writing requires the
  full UteamUP connection.
- Changing the company's designation profile, separators, level names or industry profiles
  is an administrator task; point the user to the web app instead of doing it here.

## Not available through MCP

- Tagging a **location** with an industry (KKS/RDS) code: catalog assignment works on assets
  only. Locations can carry compliance codes. Ask the user to do it in the web app if needed.
- Searching the code catalog by code text: walk `uteamup_codingsystem_tree` instead.
- Failure-code categories cannot be listed by name; `categoryId` filters need a known id.

## Examples

**"Which assets are under 1LAB?"**
`uteamup_codingsystem_search_assets(codePrefix: "1LAB")` then summarise names and codes.

**"Tag the new feedwater pump with 1LAB10 AP001."**
`uteamup_asset_search(searchFilter: "feedwater pump")` → `uteamup_codingsystem_list` →
`uteamup_codingsystem_tree` (walk to 1LAB10 AP001) → confirm with the user →
`uteamup_codingsystem_assign_asset(assetGuid, codeCatalogEntryGuid)` → verify with
`uteamup_codingsystem_search_assets(codePrefix: "1LAB10")`.

**"Find a failure code for a pump bearing running hot."**
`uteamup_failure_code_search(searchTerm: "bearing overheating")` → present the top matches;
if none fit, propose a new code and, after a yes, `uteamup_failure_code_create`.
