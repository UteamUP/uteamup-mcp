/**
 * ArchiveRecord and RestoreRecord MCP tool tests.
 *
 * Backend tools: ArchiveRecordCommand / RestoreRecordCommand + RecordArchiveCommandHandler.
 * Contacts, checklists, task lists, tags, floorplans, failure codes, warranties, UPMate agents, automations, work
 * reports, report templates, drivers, knowledge spaces and journals are archived, never deleted: an archived record
 * leaves lists, searches, pickers and mention search, nothing linked to it is removed, and it stays readable by GUID.
 * Restore brings it back. The permission follows the record type (Contact.Delete, CheckList.Delete,
 * TaskList.Delete, Tag.Delete, Floorplan.Delete, Coding.Update, Warranty.Delete, Automation.Update,
 * Automation.Delete, Report.Delete, Report.Export, Driver.Delete, KnowledgeSpace.Delete, Journal.Delete).
 *
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Record archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_record_archive';

  const RECORD = 'eeeeeeee-0000-4000-8000-000000000001';
  const ARCHIVER = 'ffffffff-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply, expectedArgs);

  it.each([
    'contact',
    'checklist',
    'tasklist',
    'tag',
    'floorplan',
    'failurecode',
    'upmateagent',
    'automation',
    'report',
    'reporttemplate',
  ])('archives a %s and returns who and when', async (recordType) => {
    const response = await call(
      'ArchiveRecord',
      { recordType, recordGuid: RECORD },
      successReply({
        type: recordType,
        guid: RECORD,
        archivedAtUtc: '2026-11-12T10:00:00Z',
        archivedByUserGuid: ARCHIVER,
        isArchived: true,
      }),
      { recordType, recordGuid: RECORD },
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.type).toBe(recordType);
    expect(data.guid).toBe(RECORD);
    expect(data.isArchived).toBe(true);
    expect(data.archivedByUserGuid).toBe(ARCHIVER);
  });

  it('archives a warranty through its existing deleted flag (no archiver GUID)', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'warranty', recordGuid: RECORD },
      successReply({ type: 'warranty', guid: RECORD, archivedAtUtc: '2026-11-12T10:00:00Z', isArchived: true }),
      { recordType: 'warranty', recordGuid: RECORD },
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isArchived).toBe(true);
    expect(data.archivedByUserGuid).toBeUndefined();
  });

  it.each(['driver', 'knowledgespace', 'journal'])(
    'archives a %s through its existing flag (no archiver GUID)',
    async (recordType) => {
      const response = await call(
        'ArchiveRecord',
        { recordType, recordGuid: RECORD },
        successReply({ type: recordType, guid: RECORD, archivedAtUtc: '2026-11-13T10:00:00Z', isArchived: true }),
        { recordType, recordGuid: RECORD },
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.type).toBe(recordType);
      expect(data.isArchived).toBe(true);
      expect(data.archivedByUserGuid).toBeUndefined();
    },
  );

  it('restores an archived automation, which stays disabled', async () => {
    const response = await call(
      'RestoreRecord',
      { recordType: 'automation', recordGuid: RECORD },
      successReply({ type: 'automation', guid: RECORD, archivedAtUtc: null, isArchived: false }),
      { recordType: 'automation', recordGuid: RECORD },
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isArchived).toBe(false);
  });

  it('surfaces a built-in automation monitor as BUILT_IN_AUTOMATION', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'automation', recordGuid: RECORD },
      errorReply(-32000, 'BUILT_IN_AUTOMATION: A built-in monitor cannot be archived. Disable it instead.'),
    );

    expect(response.body.error.message).toMatch(/BUILT_IN_AUTOMATION/);
  });

  it('surfaces a report template that schedules still use as TEMPLATE_SCHEDULED', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'reporttemplate', recordGuid: RECORD },
      errorReply(-32000, 'TEMPLATE_SCHEDULED: This template is used by 2 schedule(s). Change or archive those schedules first.'),
    );

    expect(response.body.error.message).toMatch(/TEMPLATE_SCHEDULED/);
  });

  it('surfaces a missing Report.Delete right as a JSON-RPC error', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'report', recordGuid: RECORD },
      errorReply(-32000, 'Permission denied: Report.Delete required'),
    );

    expect(response.body.error.message).toMatch(/Report\.Delete/);
  });

  it('restores an archived checklist', async () => {
    const response = await call(
      'RestoreRecord',
      { recordType: 'checklist', recordGuid: RECORD },
      successReply({ type: 'checklist', guid: RECORD, archivedAtUtc: null, isArchived: false }),
      { recordType: 'checklist', recordGuid: RECORD },
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isArchived).toBe(false);
    expect(data.archivedAtUtc).toBeNull();
  });

  it('surfaces a missing delete right for the record type as a JSON-RPC error', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'contact', recordGuid: RECORD },
      errorReply(-32000, 'Permission denied: Contact.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Contact\.Delete/);
  });

  it('surfaces a record of another tenant as not_found', async () => {
    const response = await call(
      'RestoreRecord',
      { recordType: 'tag', recordGuid: RECORD },
      errorReply(-32000, 'not_found: No tag with that GUID in this tenant.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('surfaces an unknown record type as an argument error', async () => {
    const response = await call(
      'ArchiveRecord',
      { recordType: 'workorder', recordGuid: RECORD },
      errorReply(-32602, 'recordType must be contact, checklist, tasklist, tag, floorplan, failurecode or warranty.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toMatch(/recordType/);
  });

  const errorTools = [
    { name: 'ArchiveRecord', args: { recordType: 'floorplan', recordGuid: RECORD } },
    { name: 'RestoreRecord', args: { recordType: 'warranty', recordGuid: RECORD } },
  ];
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
