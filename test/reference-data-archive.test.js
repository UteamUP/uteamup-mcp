/**
 * ArchiveReferenceRecord and RestoreReferenceRecord MCP tool tests.
 *
 * Backend tools: ArchiveReferenceRecordCommand / RestoreReferenceRecordCommand + their handler.
 * Skills, certificates, currencies, shifts, work order templates and maintenance plans are marked inactive
 * instead of deleted once they have history: an inactive record leaves lists, searches and pickers and stays
 * readable by GUID and in every history row. Restore reactivates it. The permission follows the record type
 * (Skill.Delete, Certificate.Delete, Currency.Delete, Shift.Delete, WorkorderTemplate.Delete,
 * MaintenancePlan.Delete).
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

describe('Reference data archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_reference_archive';

  const SKILL = 'cccccccc-0000-4000-8000-000000000001';
  const PLAN = 'dddddddd-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply, expectedArgs);

  it.each([
    'skill',
    'certificate',
    'currency',
    'shift',
    'workordertemplate',
    'maintenanceplan',
  ])('marks a %s inactive and returns its state', async (recordType) => {
    const response = await call(
      'ArchiveReferenceRecord',
      { recordType, recordGuid: SKILL },
      successReply({ type: recordType, guid: SKILL, isActive: false }),
      { recordType, recordGuid: SKILL },
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.type).toBe(recordType);
    expect(data.guid).toBe(SKILL);
    expect(data.isActive).toBe(false);
  });

  it('reactivates an inactive maintenance plan', async () => {
    const response = await call(
      'RestoreReferenceRecord',
      { recordType: 'maintenanceplan', recordGuid: PLAN },
      successReply({ type: 'maintenanceplan', guid: PLAN, isActive: true }),
      { recordType: 'maintenanceplan', recordGuid: PLAN },
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.type).toBe('maintenanceplan');
    expect(data.isActive).toBe(true);
  });

  it('surfaces a missing delete right for the record type as a JSON-RPC error', async () => {
    const response = await call(
      'ArchiveReferenceRecord',
      { recordType: 'skill', recordGuid: SKILL },
      errorReply(-32000, 'Permission denied: Skill.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Skill\.Delete/);
  });

  it('surfaces a record outside the tenant as not_found', async () => {
    const response = await call(
      'RestoreReferenceRecord',
      { recordType: 'certificate', recordGuid: SKILL },
      errorReply(-32000, 'not_found: Record unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('surfaces an unknown record type as an argument error', async () => {
    const response = await call(
      'ArchiveReferenceRecord',
      { recordType: 'vendor', recordGuid: SKILL },
      errorReply(-32602, 'recordType must be skill, certificate, currency, shift, workordertemplate or maintenanceplan.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toMatch(/recordType/);
  });

  const errorTools = [
    { name: 'ArchiveReferenceRecord', args: { recordType: 'currency', recordGuid: SKILL } },
    { name: 'RestoreReferenceRecord', args: { recordType: 'shift', recordGuid: SKILL } },
  ];
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
