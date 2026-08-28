/** Enterprise Quality governance MCP proxy contracts. */
'use strict';

const nock = require('nock');
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Quality governance MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality';
  const RECORD_GUID = '6f83f5f3-75fd-4d74-a086-9b8427ff5c34';
  const EVIDENCE_GUID = 'f1f28d95-41cf-46a4-ac4d-476aefc8fa20';

  const searchTool = {
    name: 'UteamupQualityRecordsSearch',
    args: {
      recordKind: 'NonConformance',
      siteGuid: '0902f687-b9bf-4244-9717-6655cf5e95b1',
      retentionDispositionStatus: 'Active',
      historyIntegrityStatus: 'Verified',
      search: 'NCR-2026',
      page: 2,
      pageSize: 25,
    },
  };
  const ledgerTool = {
    name: 'UteamupQualityRecordLedgerGet',
    args: {
      recordKind: 'NonConformance',
      domainRecordGuid: RECORD_GUID,
    },
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('forwards every bounded search filter without tenant or user identity arguments', async () => {
    const response = await call(
      searchTool.name,
      searchTool.args,
      successReply({
        items: [{
          domainRecordGuid: RECORD_GUID,
          recordKind: 'NonConformance',
          displayNumber: 'NCR-2026-0042',
          historyIntegrityStatus: 'Verified',
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      searchTool.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].domainRecordGuid).toBe(RECORD_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
    expect(searchTool.args).not.toHaveProperty('tenantGuid');
    expect(searchTool.args).not.toHaveProperty('userId');
  });

  test('preserves an empty permission-filtered page', async () => {
    const response = await call(
      searchTool.name,
      {},
      successReply({ items: [], totalCount: 0, page: 1, pageSize: 25 }),
      {},
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  test('passes through immutable ledger evidence and history using public GUIDs', async () => {
    const response = await call(
      ledgerTool.name,
      ledgerTool.args,
      successReply({
        governance: {
          domainRecordGuid: RECORD_GUID,
          recordKind: 'NonConformance',
          displayNumber: 'NCR-2026-0042',
        },
        history: [{
          guid: 'f248a42d-8022-4daa-b0ba-d847206e8d96',
          eventSequence: 1,
          actionKey: 'nonconformance.created',
          evidenceLinkGuids: [EVIDENCE_GUID],
        }],
        decisions: [],
        evidence: [{
          guid: EVIDENCE_GUID,
          documentGuid: '823a4ec2-8378-4289-af41-06f7240c0d92',
          documentVersionGuid: '1c67ae5f-b2e7-42e4-b9fa-a8868460dd22',
        }],
        escalations: [],
      }),
      ledgerTool.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.governance.domainRecordGuid).toBe(RECORD_GUID);
    expect(data.history[0].evidenceLinkGuids).toEqual([EVIDENCE_GUID]);
    expect(data.evidence[0]).not.toHaveProperty('documentId');
    expect(data.evidence[0]).not.toHaveProperty('documentVersionId');
  });

  test('preserves a missing ledger as a null success', async () => {
    const response = await call(
      ledgerTool.name,
      ledgerTool.args,
      successReply(null),
      ledgerTool.args,
    );

    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  test('passes through record-specific permission denial', async () => {
    const response = await call(
      ledgerTool.name,
      ledgerTool.args,
      errorReply(-32000, 'Permission denied for the requested Quality record kind.'),
    );

    expect(response.body.error.message).toMatch(/record kind/i);
  });

  const tools = [searchTool, ledgerTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
