/**
 * Proxy contract tests for the live backend AssetDependencyTools schema.
 *
 * Dependency edges are tenant-level facts about the equipment, not group content, so they are
 * gated by the asset permissions and appear in every group containing both ends. The failure
 * simulation is computed deterministically from those edges — the proxy must never reshape the
 * numbers, and must forward `createReverse` faithfully, because a dropped mirror silently turns
 * a mutual relation into a one-way one.
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

describe('Asset dependency MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_dependency';
  const SOURCE_GUID = '11111111-1111-4111-8111-111111111111';
  const TARGET_GUID = '22222222-2222-4222-8222-222222222222';
  const DEPENDENCY_GUID = '33333333-3333-4333-8333-333333333333';
  const REVERSE_GUID = '44444444-4444-4444-8444-444444444444';
  const GROUP_GUID = '55555555-5555-4555-8555-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const edge = {
    guid: DEPENDENCY_GUID,
    sourceAssetGuid: SOURCE_GUID,
    sourceAssetName: 'Feed pump 1',
    targetAssetGuid: TARGET_GUID,
    targetAssetName: 'Boiler 1',
    dependencyType: 'feeds',
    failureImpact: 'stopped',
    impactDelayMinutes: 20,
    notes: null,
    isAISuggested: false,
    confidence: null,
    generationGuid: null,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z'
  };

  test('lists both directions for one asset with GUID-only rows', async () => {
    const incoming = { ...edge, guid: REVERSE_GUID, sourceAssetGuid: TARGET_GUID, targetAssetGuid: SOURCE_GUID };
    const response = await call(
      'UteamupAssetDependencyListByAsset',
      { assetGuid: SOURCE_GUID },
      successReply([edge, incoming])
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[0].sourceAssetGuid).toBe(SOURCE_GUID);
    expect(data[1].targetAssetGuid).toBe(SOURCE_GUID);
    for (const row of data) {
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('sourceAssetId');
      expect(row).not.toHaveProperty('targetAssetId');
    }
  });

  test('an asset with no edges returns an empty list, not null', async () => {
    const response = await call(
      'UteamupAssetDependencyListByAsset',
      { assetGuid: TARGET_GUID },
      successReply([])
    );
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('creates one edge and returns a single-row list', async () => {
    const model = {
      sourceAssetGuid: SOURCE_GUID,
      targetAssetGuid: TARGET_GUID,
      dependencyType: 'Feeds',
      failureImpact: 'Stopped',
      impactDelayMinutes: 20
    };
    const response = await call(
      'UteamupAssetDependencyCreate',
      { model },
      successReply([edge]),
      { model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(1);
    expect(data[0].guid).toBe(DEPENDENCY_GUID);
  });

  test('createReverse is forwarded verbatim and produces two rows', async () => {
    const model = {
      sourceAssetGuid: SOURCE_GUID,
      targetAssetGuid: TARGET_GUID,
      dependencyType: 'Feeds',
      failureImpact: 'Stopped',
      createReverse: { dependencyType: 'DependsOn', failureImpact: 'Degraded', impactDelayMinutes: 60 }
    };
    const response = await call(
      'UteamupAssetDependencyCreate',
      { model },
      successReply([
        edge,
        {
          ...edge,
          guid: REVERSE_GUID,
          sourceAssetGuid: TARGET_GUID,
          targetAssetGuid: SOURCE_GUID,
          dependencyType: 'dependsOn',
          failureImpact: 'degraded',
          impactDelayMinutes: 60
        }
      ]),
      { model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[1].dependencyType).toBe('dependsOn');
    expect(data[1].failureImpact).toBe('degraded');
  });

  test('rejects a self-link', async () => {
    const response = await call(
      'UteamupAssetDependencyCreate',
      { model: { sourceAssetGuid: SOURCE_GUID, targetAssetGuid: SOURCE_GUID } },
      errorReply(-32000, 'An asset cannot depend on itself.')
    );
    expect(response.body.error.message).toContain('cannot depend on itself');
  });

  test('a duplicate edge of the same type is a conflict', async () => {
    const response = await call(
      'UteamupAssetDependencyCreate',
      { model: { sourceAssetGuid: SOURCE_GUID, targetAssetGuid: TARGET_GUID, dependencyType: 'Feeds' } },
      errorReply(-32000, 'A Feeds dependency between these assets already exists.')
    );
    expect(response.body.error.message).toContain('already exists');
  });

  test('an asset outside the tenant is reported as not found', async () => {
    const response = await call(
      'UteamupAssetDependencyCreate',
      { model: { sourceAssetGuid: SOURCE_GUID, targetAssetGuid: '66666666-6666-4666-8666-666666666666' } },
      errorReply(-32000, 'Asset not found in this tenant')
    );
    expect(response.body.error.message).toContain('not found in this tenant');
  });

  test('updates only the supplied fields and never the endpoints', async () => {
    const model = { failureImpact: 'SafetyRisk', notes: 'Trips the boiler protection' };
    const response = await call(
      'UteamupAssetDependencyUpdate',
      { dependencyGuid: DEPENDENCY_GUID, model },
      successReply({ ...edge, failureImpact: 'safetyRisk', notes: 'Trips the boiler protection' }),
      { dependencyGuid: DEPENDENCY_GUID, model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.failureImpact).toBe('safetyRisk');
    expect(data.sourceAssetGuid).toBe(SOURCE_GUID);
    expect(data.targetAssetGuid).toBe(TARGET_GUID);
  });

  test('deletes by dependency GUID only and reports the outcome as a flag', async () => {
    const response = await call(
      'UteamupAssetDependencyDelete',
      { dependencyGuid: DEPENDENCY_GUID },
      successReply({ dependencyGuid: DEPENDENCY_GUID, deleted: true })
    );
    expect(JSON.parse(response.body.result.content[0].text))
      .toEqual({ dependencyGuid: DEPENDENCY_GUID, deleted: true });
  });

  test('simulates one asset failing and echoes the clamped bounds back', async () => {
    const response = await call(
      'UteamupAssetDependencyImpactAnalyze',
      { assetGuid: SOURCE_GUID, propagateDegraded: true, maxDepth: 500 },
      successReply({
        rootAssetGuid: SOURCE_GUID,
        rootGroupGuid: null,
        maxDepth: 100,
        propagateDegraded: true,
        affectedAssets: [
          { assetGuid: TARGET_GUID, assetName: 'Boiler 1', impact: 'stopped', depth: 1 }
        ],
        affectedGroups: [{ groupGuid: GROUP_GUID, groupName: 'Boiler House', impact: 'stopped' }]
      }),
      { assetGuid: SOURCE_GUID, propagateDegraded: true, maxDepth: 500 }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.maxDepth).toBe(100);
    expect(data.affectedAssets[0].assetGuid).toBe(TARGET_GUID);
    expect(data.affectedAssets[0]).not.toHaveProperty('assetId');
  });

  test('an asset with nothing downstream reports an empty impact rather than an error', async () => {
    const response = await call(
      'UteamupAssetDependencyImpactAnalyze',
      { assetGuid: TARGET_GUID },
      successReply({ rootAssetGuid: TARGET_GUID, maxDepth: 25, propagateDegraded: false, affectedAssets: [], affectedGroups: [] })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.body.error).toBeUndefined();
    expect(data.affectedAssets).toEqual([]);
  });

  test('the neighbourhood returns nodes, edges and the groups they belong to', async () => {
    const response = await call(
      'UteamupAssetDependencyNeighbourhood',
      { assetGuid: SOURCE_GUID, depth: 3 },
      successReply({
        assetGuid: SOURCE_GUID,
        assetName: 'Feed pump 1',
        depth: 3,
        nodes: [{ assetGuid: TARGET_GUID, name: 'Boiler 1', role: 'primary', positionX: 0, positionY: 0, displayOrder: 1, isActive: true, childAssetCount: 0, openFailureCount: 0 }],
        edges: [edge],
        groups: [{ guid: GROUP_GUID, name: 'Boiler House', kind: 'utility', isActive: true, memberCount: 4, dependencyCount: 2 }]
      }),
      { assetGuid: SOURCE_GUID, depth: 3 }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.depth).toBe(3);
    expect(data.groups[0].guid).toBe(GROUP_GUID);
    expect(data.nodes[0]).not.toHaveProperty('assetId');
  });

  test('an out-of-range depth is clamped by the backend and echoed back', async () => {
    const response = await call(
      'UteamupAssetDependencyNeighbourhood',
      { assetGuid: SOURCE_GUID, depth: 9 },
      successReply({ assetGuid: SOURCE_GUID, assetName: 'Feed pump 1', depth: 3, nodes: [], edges: [], groups: [] })
    );
    expect(JSON.parse(response.body.result.content[0].text).depth).toBe(3);
  });

  const allTools = [
    { name: 'UteamupAssetDependencyListByAsset', args: { assetGuid: SOURCE_GUID } },
    { name: 'UteamupAssetDependencyCreate', args: { model: { sourceAssetGuid: SOURCE_GUID, targetAssetGuid: TARGET_GUID } } },
    { name: 'UteamupAssetDependencyUpdate', args: { dependencyGuid: DEPENDENCY_GUID, model: { failureImpact: 'Degraded' } } },
    { name: 'UteamupAssetDependencyDelete', args: { dependencyGuid: DEPENDENCY_GUID } },
    { name: 'UteamupAssetDependencyImpactAnalyze', args: { assetGuid: SOURCE_GUID } },
    { name: 'UteamupAssetDependencyNeighbourhood', args: { assetGuid: SOURCE_GUID, depth: 2 } }
  ];

  test('the tool matrix covers every asset dependency tool exactly once', () => {
    expect(allTools).toHaveLength(6);
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(allTools.length);
  });

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/"(assetId|dependencyId|tenantId|groupId)"/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
