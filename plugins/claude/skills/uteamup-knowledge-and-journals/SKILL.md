---
name: uteamup-knowledge-and-journals
description: Captures and finds operational knowledge in UteamUP through the UteamUP MCP server - journal (logbook) entries with linked assets, codes and documents, knowledge articles in knowledge spaces, document search, upload and versions, and import of Word, Markdown, text and photo notes into journals - using search first, GUIDs only, and confirmation before any write or AI-credit spend. Use when the user says things like "log what we did on the boiler today", "import this daily log", "turn this photo of my notes into a journal", "find the procedure for resetting the chiller", "write a knowledge article from this work order", "publish the draft guide", "find the pump manual", "upload this PDF", or "what did we log about pump P-12 last month".
license: Proprietary
compatibility: Requires the UteamUP MCP server (https://api.uteamup.com/mcp or the @uteamup/mcp-server package) and a signed-in UteamUP account.
metadata:
  publisher: UteamUP
  version: "1.0.0"
  access: write
---

# UteamUP knowledge and journals

Help a team record what happened and find what they know. **Journals** are dated log entries
(daily logs, observations, incident notes) that can link assets, parts, tools, industry codes,
work orders and documents. **Knowledge articles** are structured pages (procedures, guides) that
live in **knowledge spaces** and move Draft → In review → Published. **Documents** are the files
behind both. The skill searches before writing, links by GUID, and asks before spending AI
credits.

## Tools

Tool names below are the UteamUP MCP tool names; some clients show them with a server prefix
(for example `uteamup:` or `mcp__uteamup__`).

| Tool | Purpose | Key arguments |
|------|---------|---------------|
| `uteamup_journal_search` | Find journals by words in title or content | `searchTerm`, `maxResults` (max 100) |
| `uteamup_journal_list` | Page journals with filters | `searchModel` (`pageNumber`, `pageSize`, `searchTerm`, `assetGuid`, `locationGuid`, `workorderGuid`, `categoryGuid`, `fromDate`, `toDate`, `isArchived`) |
| `uteamup_journal_get_by_asset` | Journals linked to an asset | `assetGuid`, `pageNumber`, `pageSize` |
| `uteamup_journal_get_by_date_range` | Journals between two dates | `fromDate`, `toDate`, `maxResults` |
| `uteamup_journal_get` | One journal | `journalGuid` |
| `uteamup_journal_link_suggestions` | Records mentioned in a text (read-only, no AI credits) | `text` (max 8,000 chars) |
| `uteamup_codecatalog_search` | Industry code GUIDs for mentions | `query`, `limit` |
| `uteamup_journal_create` | New journal entry | `model` (`title`, `content`, `journalDate`, `priority` 1-5, `assetGuids`, `partGuids`, `toolGuids`, `codeCatalogEntryGuids`, `workorderGuid`, `locationGuid`, `categoryGuid`, `documentGuids`, `tagGuids`) |
| `uteamup_journal_update` | Change a journal | `journalGuid`, `model` (full data) |
| `uteamup_journal_get_templates` / `uteamup_journal_create_from_template` | Journal templates | `templateGuid`, `model` |
| `uteamup_journal_add_documents` / `uteamup_journal_remove_documents` | Attach or detach existing documents | `journalGuid`, `documentGuids` |
| `uteamup_journal_get_documents` | Files on a journal | `journalGuid` |
| `uteamup_journal_import` | Import a .docx, .md or .txt file as a journal | `fileName`, `fileContentBase64` (max 10 MB), `title`, `summary`, `targetJournalGuid` |
| `uteamup_journal_create_from_image` | New journal from a photo | `imageFileName`, `imageContentBase64` (max 25 MB), `title` |
| `uteamup_journal_add_images` | Append photos to a journal | `journalGuid`, `imageFileNames`, `imageContentsBase64` |
| `uteamup_journal_set_archive_status` | Archive or unarchive a journal | `journalGuid`, `isArchived` |
| `uteamup_knowledge_space_list` / `uteamup_knowledge_space_get` | Spaces and their GUIDs | `spaceGuid` |
| `uteamup_knowledge_article_search` | Find articles | `searchRequest` (`query`, `spaceGuid`, `status`, `articleType`, `assetGuid`, `locationGuid`, `pageNumber`, `pageSize`) |
| `uteamup_knowledge_article_get_linked` | Articles linked to a record | `entityType`, `entityGuid` |
| `uteamup_knowledge_article_create` | New draft article | `model` (`title`, `content` Markdown, `spaceGuid`, `articleType`, `parentArticleGuid`, `assetGuids`, `locationGuids`, `documentGuids`, `tagGuids`) |
| `uteamup_knowledge_article_link_entity` / `uteamup_knowledge_article_unlink_entity` | Link an article to a record | `entityType`, `entityGuid`, `articleGuid` |
| `uteamup_knowledge_article_move_relative` | Reorder an article in its tree | `articleGuid`, `targetArticleGuid`, `placeAfter`, `confirm` |
| `uteamup_knowledge_article_submit_review` | Draft → In review | `articleGuid` |
| `uteamup_knowledge_article_publish` | Draft or In review → Published | `articleGuid` |
| `uteamup_knowledge_article_generate_from_workorder` | AI draft from a completed work order (AI credits) | `request` (`workorderGuid`, `articleType`, `parentArticleGuid`) |
| `uteamup_knowledge_article_generate_from_journal` | AI draft from a journal (AI credits) | `request` (`journalGuid`, `articleType`, `parentArticleGuid`) |
| `uteamup_knowledge_ai_generate_from_text` | AI draft from pasted text (AI credits) | `request` (`spaceGuid`, `text`, `parentArticleGuid`) |
| `uteamup_knowledge_ai_translate` | AI-translate an article (AI credits) | `articleGuid`, `targetLanguages` |
| `uteamup_global_search` | Find documents, journals or articles by text | `query` (3+ chars), `entityTypes` (`document`, `journal`, `knowledgearticle`) |
| `uteamup_document_get_timeline` | Documents by date range and text | `from`, `to`, `types`, `q` |
| `uteamup_document_get` / `uteamup_document_get_metadata` | One document | `guid` |
| `uteamup_document_find_by_hash` | Check whether a file is already uploaded | `sha256` |
| `uteamup_document_upload_with_content` | Upload a file | `fileName`, `fileContentBase64`, `contentType`, `description` |
| `uteamup_document_update` | Rename or describe a document | `documentGuid`, `fileName`, `description` |
| `uteamup_document_list_versions_by_guid` / `uteamup_document_upload_version_by_guid` | Versions of a document | `documentGuid`, `fileName`, `fileContentBase64`, `contentType` |
| `uteamup_document_import_get_batch` | Review an import batch and its suggestions | `batchGuid` |
| `uteamup_document_review_queue` | Documents waiting for peer review | `page`, `pageSize`, `batchGuid` |
| `archive_record` / `restore_record` | Archive or restore a journal or knowledge space | `recordType` (`journal`, `knowledgespace`), `recordGuid` |

## Workflow

1. **Confirm the company.** If a tool reports no tenant or access denied, call
   `uteamup_tenant_get_my_tenants`, show it and ask the user which company they mean.
2. **Search first.** For "what do we know about X": `uteamup_knowledge_article_search` with
   `query`, then `uteamup_journal_search`, then `uteamup_global_search` with `entityTypes`
   `document`. For a known record, use `uteamup_knowledge_article_get_linked` or
   `uteamup_journal_get_by_asset`. Summarise; quote only the relevant lines.
3. **Write a journal entry.**
   - Run `uteamup_journal_link_suggestions` on the user's text; show the suggested assets, parts,
     tools and codes and let the user choose which to link.
   - Find any missing GUIDs (`uteamup_asset_search`, `uteamup_codecatalog_search`).
   - Show the draft: title, date, priority, content summary, links. Ask for a yes.
   - Call `uteamup_journal_create` with `content`, `journalDate` (UTC), `priority` between 1 and
     5 (3 is normal), and the chosen GUID lists.
4. **Import notes.** A .docx, .md or .txt file goes to `uteamup_journal_import` (base64, max
   10 MB; .doc, .docm and .svg are refused). A photo of notes goes to
   `uteamup_journal_create_from_image`; more photos for the same entry go to
   `uteamup_journal_add_images`. Show the returned review items (ambiguous codes, created
   documents) and let the user confirm links.
5. **Attach a file.** Compute its SHA-256 and call `uteamup_document_find_by_hash` first; reuse the
   existing document if found. Otherwise `uteamup_document_upload_with_content`, then link it
   with `uteamup_journal_add_documents` or the article's `documentGuids`. For a new revision of
   a known file use `uteamup_document_upload_version_by_guid`.
6. **Write a knowledge article.** `uteamup_knowledge_space_list` → pick the space. Search for an
   existing article on the topic first. Draft the Markdown, show it, then
   `uteamup_knowledge_article_create` with `spaceGuid`, `title`, `content` and `articleType`
   (0 General, 1 Procedure, 2 Troubleshooting guide). New articles start as drafts.
7. **AI drafts** (generate from work order, journal or text; translate) spend AI credits. Say so,
   ask for an explicit yes, then call the tool. If the result carries `quotaBlockedReason`, tell
   the user the AI quota is used up.
8. **Review and publish.** `uteamup_knowledge_article_submit_review` sends a draft to review;
   `uteamup_knowledge_article_publish` makes it visible to everyone in the space. Confirm before
   publishing.
9. **Link and order.** `uteamup_knowledge_article_link_entity` with `entityType` (asset, part,
   tool, chemical, location, workorder, vendor, team, floorplan, customer, contact and others)
   and the record GUID. Reorder with `uteamup_knowledge_article_move_relative`, `confirm` true
   only after the user agrees.
10. **Archive.** Journal: `uteamup_journal_set_archive_status` with `isArchived` true (or
    `archive_record` `journal`). Knowledge space: `archive_record` `knowledgespace`.

## Rules

- Identifiers are GUIDs. Search or list first and reuse the returned GUID; never guess one and
  never use integer ids. Do not use the integer tools `uteamup_knowledge_article_get`,
  `uteamup_knowledge_article_update`, `uteamup_knowledge_article_get_by_asset`,
  `uteamup_knowledge_article_get_by_failure_code` or `uteamup_knowledge_article_suggest_related`.
- Editing the text of an existing knowledge article is not available through MCP with GUIDs; ask
  the user to edit it in the web app, or create a new draft if they prefer.
- Make sure the right company is active before writing.
- Before any create, update, import, upload, publish, link or archive, show what will change and
  get a clear yes. Records are archived, never deleted.
- AI-priced tools (`uteamup_knowledge_article_generate_from_workorder`,
  `uteamup_knowledge_article_generate_from_journal`, `uteamup_knowledge_ai_generate_from_text`,
  `uteamup_knowledge_ai_translate`, `uteamup_knowledge_article_analyze_gaps`)
  are used only after the user agrees to spend credits. Plain search and
  `uteamup_journal_link_suggestions` use no AI credits.
- Journal and article content may contain personal or customer data; never paste it to other
  tools or outside UteamUP.
- Respect permission errors (Journal.Import, Document.Upload, KnowledgeArticle.Create,
  KnowledgeArticle.Publish, space membership); report them and do not route around them.
- Keep answers short: page with `pageSize` 10-25 and summarise instead of dumping content.
- If write tools are missing, the connection is read-only; explain that changes need the full
  UteamUP connection.

## Examples

**"Log that we replaced the seal on pump P-12 today, took 2 hours."**
1. `uteamup_journal_link_suggestions` `{ "text": "Replaced the seal on pump P-12, 2 hours." }` → suggests asset P-12.
2. Show draft (title "Seal replaced on P-12", today, priority 3, linked asset). User says yes.
3. `uteamup_journal_create` `{ "model": { "title": "Seal replaced on P-12", "content": "...", "journalDate": "<today UTC>", "priority": 3, "assetGuids": ["<P-12 GUID>"] } }`

**"How do we reset the chiller after a high-pressure trip?"**
1. `uteamup_knowledge_article_search` `{ "searchRequest": { "query": "chiller high pressure reset", "pageSize": 5 } }`
2. If nothing useful: `uteamup_journal_search` `{ "searchTerm": "chiller trip", "maxResults": 10 }`
3. Answer from the best article, name it, and offer to draft a procedure if none exists.

**"Make a procedure out of work order WO-2291."**
1. `uteamup_workorder_search` `{ "searchFilter": "WO-2291" }` → GUID; `uteamup_knowledge_space_list` → space.
2. Explain it uses AI credits; on yes, `uteamup_knowledge_article_generate_from_workorder`
   `{ "request": { "workorderGuid": "<GUID>", "articleType": 1 } }` (1 = Procedure)
3. Show the draft and offer `uteamup_knowledge_article_submit_review`.
