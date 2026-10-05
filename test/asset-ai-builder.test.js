/** Generic-proxy contract for the backend-registered asset AI builder tools. */
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

describe('Asset AI builder MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_ai_builder';
  const assetGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const generateArgs = { assetGuid, kinds: ['Checklist', 'MeterReadings'], instructions: 'Winter operation' };
  const applyArgs = {
    assetGuid,
    request: {
      requestGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      generationGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      meters: [{ clientKey: 'MeterReadings-0', name: 'Oil temperature', intervalSeconds: 86400, createMeterAssetType: true }],
    },
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const callTool = (name, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, name, toolArgs, mockReply, expectedArgs);
  const parse = response => JSON.parse(response.body.result.content[0].text);

  it('readiness reports missing information per kind without charging', async () => {
    const response = await callTool('UteamupAssetAiBuilderReadiness', { assetGuid }, successReply({
      assetGuid,
      signals: { hasModelNumber: false, readableDocumentCount: 0, unreadDocumentGuids: [] },
      kinds: [{ kind: 0, verdict: 2, reasonKeys: ['missingModelNumber', 'noReadableDocuments'], creditsPerRun: 5 }],
      canCreateAssetTypes: false,
      remaining: 40,
    }));

    const data = parse(response);
    expect(data.kinds[0].reasonKeys).toEqual(['missingModelNumber', 'noReadableDocuments']);
    expect(data.canCreateAssetTypes).toBe(false);
  });

  it('forwards generate kinds and instructions verbatim and returns the proposal', async () => {
    const response = await callTool('UteamupAssetAiBuilderGenerate', generateArgs, successReply({
      generationGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      assetGuid,
      checklists: [{ clientKey: 'Checklist-0', draft: { name: 'Monthly inspection', items: [] }, sourceDocumentGuids: [] }],
      generatedKinds: [0],
      creditsCharged: 5,
      remaining: 35,
      warnings: ['kindSkipped:MeterReadings:missingModelNumber'],
    }), generateArgs);

    const data = parse(response);
    expect(data.checklists).toHaveLength(1);
    expect(data.creditsCharged).toBe(5);
    expect(data.warnings[0]).toMatch(/^kindSkipped:MeterReadings/);
  });

  it('surfaces a quota block in the body, not as an error', async () => {
    const response = await callTool('UteamupAssetAiBuilderGenerate', generateArgs, successReply({
      assetGuid, checklists: [], generatedKinds: [], creditsCharged: 0, quotaBlockedReason: 'quotaExceeded',
      warnings: ['notGenerated:Checklist', 'notGenerated:MeterReadings'],
    }));

    const data = parse(response);
    expect(response.body.error).toBeUndefined();
    expect(data.quotaBlockedReason).toBe('quotaExceeded');
  });

  it('forwards the apply payload verbatim and passes the Premium plan-gate warning through', async () => {
    const response = await callTool('UteamupAssetAiBuilderApply', applyArgs, successReply({
      createdByKind: {},
      linkedByKind: {},
      skipped: [{ clientKey: 'MeterReadings-0', kind: 4, reasonKey: 'assetTypeCreationRequiresPremium' }],
      warnings: [],
      wasReplay: false,
    }), applyArgs);

    const data = parse(response);
    expect(data.skipped[0].reasonKey).toBe('assetTypeCreationRequiresPremium');
  });

  it('history returns an empty list for an asset with no generations', async () => {
    const response = await callTool('UteamupAssetAiBuilderHistory', { assetGuid }, successReply([]));
    expect(parse(response)).toEqual([]);
  });

  it('surfaces permission failures as JSON-RPC errors', async () => {
    const response = await callTool('UteamupAssetAiBuilderReadiness', { assetGuid },
      errorReply(-32000, 'Permission denied: Asset.View required'));
    expect(response.body.error.message).toMatch(/Asset\.View/);
  });

  it('takes no tenant or user identity arguments (identity comes from the token)', () => {
    for (const toolArgs of [generateArgs, applyArgs, { assetGuid }]) {
      expect(Object.keys(toolArgs)).not.toEqual(expect.arrayContaining(['tenantGuid']));
      expect(Object.keys(toolArgs)).not.toEqual(expect.arrayContaining(['userId']));
    }
  });

  const tools = [
    { name: 'UteamupAssetAiBuilderReadiness', args: { assetGuid } },
    { name: 'UteamupAssetAiBuilderGenerate', args: generateArgs },
    { name: 'UteamupAssetAiBuilderApply', args: applyArgs },
    { name: 'UteamupAssetAiBuilderHistory', args: { assetGuid } },
  ];
  describeJsonRpcCompliance(callTool, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
