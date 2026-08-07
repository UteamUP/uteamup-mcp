/**
 * Proxy contract tests for the live GUID-only Journal code-linking tools.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Journal code-linking MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_journal_code_linking';
  const CODE_GUID = '11111111-1111-4111-8111-111111111111';
  const SECOND_CODE_GUID = '22222222-2222-4222-8222-222222222222';
  const CODING_SYSTEM_GUID = '33333333-3333-4333-8333-333333333333';
  const JOURNAL_GUID = '44444444-4444-4444-8444-444444444444';
  const ASSET_GUID = '55555555-5555-4555-8555-555555555555';
  const CATEGORY_GUID = '66666666-6666-4666-8666-666666666666';
  const LOCATION_GUID = '77777777-7777-4777-8777-777777777777';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const codeEntry = {
    guid: CODE_GUID,
    code: '10-MAB-001',
    displayCode: '10-MAB-001',
    name: 'Feed Water Pump A',
    description: 'Primary feed water pump, unit 1',
    codingSystemGuid: CODING_SYSTEM_GUID,
    levelName: 'Equipment',
    levelOrder: 3,
    isPrimaryIdentifier: true
  };

  const journal = {
    guid: JOURNAL_GUID,
    tenantGuid: '88888888-8888-4888-8888-888888888888',
    title: 'Pump inspection',
    content: 'Checked pump bearings. All nominal.',
    journalDate: '2026-04-09T08:00:00Z',
    categoryGuid: CATEGORY_GUID,
    locationGuid: LOCATION_GUID,
    priority: 3,
    linkedCodeCatalogEntries: [
      {
        codeCatalogEntryGuid: CODE_GUID,
        code: '10-MAB-001',
        displayCode: '10-MAB-001',
        name: 'Feed Water Pump A',
        codingSystemGuid: CODING_SYSTEM_GUID,
        levelName: 'Equipment'
      }
    ]
  };

  const paginated = {
    journals: [journal],
    currentPage: 1,
    pageSize: 20,
    totalItems: 1,
    totalPages: 1
  };

  test('searches the code catalog and returns GUID-only identities', async () => {
    const response = await call(
      'UteamupCodecatalogSearch',
      { query: 'pump', limit: 10 },
      successReply([codeEntry])
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data).toEqual([codeEntry]);
    expect(data[0].guid).toBe(CODE_GUID);
    expect(data[0].codingSystemGuid).toBe(CODING_SYSTEM_GUID);
    expect(data[0]).not.toHaveProperty('id');
    expect(data[0]).not.toHaveProperty('codingSystemId');
  });

  test('gets journals by codeCatalogEntryGuid with the current page shape', async () => {
    const response = await call(
      'UteamupJournalGetByCode',
      { codeCatalogEntryGuid: CODE_GUID, pageNumber: 1, pageSize: 20 },
      successReply(paginated)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.totalItems).toBe(1);
    expect(data.currentPage).toBe(1);
    expect(data.journals[0].guid).toBe(JOURNAL_GUID);
    expect(data.journals[0].linkedCodeCatalogEntries[0].codeCatalogEntryGuid).toBe(CODE_GUID);
  });

  test('gets journals by assetGuid', async () => {
    const response = await call(
      'UteamupJournalGetByAsset',
      { assetGuid: ASSET_GUID, pageNumber: 1, pageSize: 20 },
      successReply(paginated)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.journals).toHaveLength(1);
    expect(data.journals[0].guid).toBe(JOURNAL_GUID);
  });

  test('creates a journal with category, location, and code GUIDs', async () => {
    const response = await call(
      'UteamupJournalCreateWithCodeMentions',
      {
        title: 'Pump inspection',
        content: 'Bearings checked.',
        categoryGuid: CATEGORY_GUID,
        codeCatalogEntryGuids: [CODE_GUID, SECOND_CODE_GUID],
        locationGuid: LOCATION_GUID,
        priority: 3
      },
      successReply(journal)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(JOURNAL_GUID);
    expect(data.categoryGuid).toBe(CATEGORY_GUID);
    expect(data.locationGuid).toBe(LOCATION_GUID);
  });

  test('surfaces tenant-scoped lookup failures', async () => {
    const response = await call(
      'UteamupJournalGetByCode',
      { codeCatalogEntryGuid: CODE_GUID },
      errorReply(-32000, 'Code catalog entry was not found in the tenant')
    );

    expect(response.body.error.message).toContain('not found in the tenant');
  });

  const allTools = [
    { name: 'UteamupCodecatalogSearch', args: { query: 'pump', limit: 10 } },
    { name: 'UteamupJournalGetByCode', args: { codeCatalogEntryGuid: CODE_GUID } },
    { name: 'UteamupJournalGetByAsset', args: { assetGuid: ASSET_GUID } },
    {
      name: 'UteamupJournalCreateWithCodeMentions',
      args: {
        title: 'Pump inspection',
        content: 'Bearings checked.',
        categoryGuid: CATEGORY_GUID,
        codeCatalogEntryGuids: [CODE_GUID],
        locationGuid: LOCATION_GUID
      }
    }
  ];

  test('proxy fixtures carry no integer resource identifiers', () => {
    expect(JSON.stringify({ codeEntry, journal, allTools })).not.toMatch(
      /\"(?:id|tenantId|categoryId|locationId|assetId|codingSystemId|codeCatalogEntryId|codeCatalogEntryIds)\"/
    );
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
