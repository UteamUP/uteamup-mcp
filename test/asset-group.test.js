/**
 * Proxy contract tests for the live backend AssetGroupTools schema.
 *
 * An asset group is a set of assets reasoned about together — a production line, a utility
 * system, a fleet. The proxy must forward the group GUID, the membership payload, the diagram
 * positions and the UPMate link-generation request verbatim: a dropped `sections`-style nested
 * argument silently changes what is written. As everywhere, GUID-only arguments and no integer
 * identifiers on the way back.
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

describe('Asset group MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_group';
  const GROUP_GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const OTHER_GROUP_GUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const ASSET_GUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const SECOND_ASSET_GUID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const DEPENDENCY_GUID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const GENERATION_GUID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const REQUEST_GUID = '11111111-2222-4333-8444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const listRow = {
    guid: GROUP_GUID,
    name: 'Boiler House',
    description: 'Steam generation',
    kind: 'utility',
    iconName: 'fire',
    color: '#c2410c',
    isActive: true,
    memberCount: 4,
    dependencyCount: 2,
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z'
  };

  const member = {
    assetGuid: ASSET_GUID,
    name: 'Feed pump 1',
    iconName: 'pump',
    serialNumber: 'FP-1',
    codingSystemCode: '10LAC10AP001',
    criticalityClass: 'high',
    isActive: true,
    role: 'primary',
    positionX: 120,
    positionY: 40,
    displayOrder: 1,
    notes: null,
    childAssetCount: 0,
    openFailureCount: 0,
    locationGuid: null,
    locationName: null
  };

  // PaginatedResults<T>: items / currentPage / pageSize / totalItems / totalPages.
  const page = (items, currentPage = 1, pageSize = 50) => ({
    items,
    currentPage,
    pageSize,
    totalItems: items.length,
    totalPages: items.length === 0 ? 0 : 1
  });

  test('lists groups with member and dependency counts and no integer identifiers', async () => {
    const response = await call(
      'UteamupAssetGroupList',
      { search: 'boiler', page: 1, pageSize: 50 },
      successReply(page([listRow]))
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].guid).toBe(GROUP_GUID);
    expect(data.items[0].memberCount).toBe(4);
    expect(data.items[0]).not.toHaveProperty('id');
    expect(data.items[0]).not.toHaveProperty('tenantId');
  });

  test('forwards the kind and includeInactive filters verbatim', async () => {
    const response = await call(
      'UteamupAssetGroupList',
      { kind: 'ProductionLine', includeInactive: true, page: 2, pageSize: 25 },
      successReply(page([], 2, 25)),
      { kind: 'ProductionLine', includeInactive: true, page: 2, pageSize: 25 }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.items).toEqual([]);
    expect(data.currentPage).toBe(2);
  });

  test('reads one group with members and both edge directions', async () => {
    const response = await call(
      'UteamupAssetGroupGet',
      { groupGuid: GROUP_GUID },
      successReply({
        ...listRow,
        canvasState: { zoom: 1, panX: 0, panY: 0 },
        mapPositionX: 300,
        mapPositionY: 120,
        members: [member],
        outgoingDependencies: [],
        incomingDependencies: []
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.members[0].assetGuid).toBe(ASSET_GUID);
    expect(data.members[0]).not.toHaveProperty('assetId');
    expect(data.outgoingDependencies).toEqual([]);
    expect(data.incomingDependencies).toEqual([]);
  });

  test('creates a group seeded with members in one round trip', async () => {
    const model = {
      name: 'Boiler House',
      description: 'Steam generation',
      kind: 'Utility',
      memberAssetGuids: [ASSET_GUID, SECOND_ASSET_GUID]
    };
    const response = await call(
      'UteamupAssetGroupCreate',
      { model },
      successReply({ ...listRow, members: [member], outgoingDependencies: [], incomingDependencies: [] }),
      { model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.guid).toBe(GROUP_GUID);
    expect(data.name).toBe('Boiler House');
  });

  test('soft-deletes a group and reports the outcome as a flag, not a 404', async () => {
    const response = await call(
      'UteamupAssetGroupDelete',
      { groupGuid: GROUP_GUID },
      successReply({ groupGuid: GROUP_GUID, deleted: true })
    );
    expect(JSON.parse(response.body.result.content[0].text))
      .toEqual({ groupGuid: GROUP_GUID, deleted: true });
  });

  test('reports a missing group on delete as deleted:false rather than an error', async () => {
    const response = await call(
      'UteamupAssetGroupDelete',
      { groupGuid: OTHER_GROUP_GUID },
      successReply({ groupGuid: OTHER_GROUP_GUID, deleted: false })
    );
    expect(JSON.parse(response.body.result.content[0].text).deleted).toBe(false);
  });

  test('adds members and returns the resulting membership', async () => {
    const model = { assetGuids: [ASSET_GUID, SECOND_ASSET_GUID], role: 'Supporting' };
    const response = await call(
      'UteamupAssetGroupMembersAdd',
      { groupGuid: GROUP_GUID, model },
      successReply([member, { ...member, assetGuid: SECOND_ASSET_GUID, name: 'Feed pump 2', role: 'supporting' }]),
      { groupGuid: GROUP_GUID, model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data.map((row) => row.assetGuid)).toEqual([ASSET_GUID, SECOND_ASSET_GUID]);
  });

  test('removes one member by the two GUIDs only', async () => {
    const response = await call(
      'UteamupAssetGroupMembersRemove',
      { groupGuid: GROUP_GUID, assetGuid: ASSET_GUID },
      successReply({ groupGuid: GROUP_GUID, assetGuid: ASSET_GUID, removed: true })
    );
    expect(JSON.parse(response.body.result.content[0].text).removed).toBe(true);
  });

  test('reads the diagram with nodes, edges and canvas state', async () => {
    const response = await call(
      'UteamupAssetGroupDiagramGet',
      { groupGuid: GROUP_GUID },
      successReply({
        groupGuid: GROUP_GUID,
        groupName: 'Boiler House',
        nodes: [member],
        edges: [{
          guid: DEPENDENCY_GUID,
          sourceAssetGuid: ASSET_GUID,
          sourceAssetName: 'Feed pump 1',
          targetAssetGuid: SECOND_ASSET_GUID,
          targetAssetName: 'Boiler 1',
          dependencyType: 'feeds',
          failureImpact: 'stopped',
          impactDelayMinutes: 15,
          isAISuggested: false,
          confidence: null,
          generationGuid: null
        }],
        canvasState: { zoom: 1.25, panX: -40, panY: 10 }
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.edges[0].failureImpact).toBe('stopped');
    expect(data.canvasState.zoom).toBe(1.25);
    expect(data.edges[0]).not.toHaveProperty('sourceAssetId');
  });

  test('forwards diagram positions and the optional canvas state verbatim', async () => {
    const model = {
      positions: [{ assetGuid: ASSET_GUID, x: 10, y: 20 }],
      canvasState: { zoom: 2, panX: 5, panY: 5 }
    };
    const response = await call(
      'UteamupAssetGroupPositionsSave',
      { groupGuid: GROUP_GUID, model },
      successReply({ groupGuid: GROUP_GUID, groupName: 'Boiler House', nodes: [], edges: [], canvasState: model.canvasState }),
      { groupGuid: GROUP_GUID, model }
    );
    expect(JSON.parse(response.body.result.content[0].text).canvasState.zoom).toBe(2);
  });

  test('surfaces a position addressing a non-member as a validation error', async () => {
    const response = await call(
      'UteamupAssetGroupPositionsSave',
      { groupGuid: GROUP_GUID, model: { positions: [{ assetGuid: SECOND_ASSET_GUID, x: 0, y: 0 }] } },
      errorReply(-32000, 'Asset is not a member of this group.')
    );
    expect(response.body.error.message).toContain('not a member');
  });

  test('auto-layout returns the refreshed diagram', async () => {
    const response = await call(
      'UteamupAssetGroupAutoLayout',
      { groupGuid: GROUP_GUID },
      successReply({ groupGuid: GROUP_GUID, groupName: 'Boiler House', nodes: [member], edges: [], canvasState: { zoom: 1, panX: 0, panY: 0 } })
    );
    expect(JSON.parse(response.body.result.content[0].text).nodes).toHaveLength(1);
  });

  test('reads the tenant group map and marks auto-positioned groups', async () => {
    const response = await call(
      'UteamupAssetGroupMapGet',
      {},
      successReply({
        groups: [
          { guid: GROUP_GUID, name: 'Boiler House', kind: 'utility', iconName: null, color: null, memberCount: 4, x: 0, y: 0, isAutoPositioned: true }
        ],
        edges: []
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.groups[0].isAutoPositioned).toBe(true);
    expect(data.edges).toEqual([]);
  });

  test('lists group-to-group edges in both directions', async () => {
    const edge = {
      guid: DEPENDENCY_GUID,
      sourceGroupGuid: GROUP_GUID,
      sourceGroupName: 'Boiler House',
      targetGroupGuid: OTHER_GROUP_GUID,
      targetGroupName: 'Turbine Hall',
      dependencyType: 'feeds',
      failureImpact: 'stopped',
      impactDelayMinutes: null,
      notes: null,
      isAISuggested: false,
      confidence: null,
      createdAt: '2026-09-01T09:00:00Z'
    };
    const response = await call(
      'UteamupAssetGroupDependenciesList',
      { groupGuid: GROUP_GUID },
      successReply([edge, { ...edge, guid: '99999999-9999-4999-8999-999999999999', sourceGroupGuid: OTHER_GROUP_GUID, targetGroupGuid: GROUP_GUID }])
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[0].sourceGroupGuid).toBe(GROUP_GUID);
    expect(data[1].targetGroupGuid).toBe(GROUP_GUID);
  });

  test('rejects a self-link on group dependency create', async () => {
    const response = await call(
      'UteamupAssetGroupDependenciesCreate',
      { model: { sourceGroupGuid: GROUP_GUID, targetGroupGuid: GROUP_GUID } },
      errorReply(-32000, 'A group cannot depend on itself.')
    );
    expect(response.body.error.message).toContain('cannot depend on itself');
  });

  test('simulates a whole group failing and returns deterministic numbers', async () => {
    const response = await call(
      'UteamupAssetGroupImpactAnalyze',
      { groupGuid: GROUP_GUID, propagateDegraded: true, maxDepth: 5 },
      successReply({
        rootAssetGuid: null,
        rootGroupGuid: GROUP_GUID,
        maxDepth: 5,
        propagateDegraded: true,
        affectedAssets: [{ assetGuid: SECOND_ASSET_GUID, assetName: 'Turbine 1', impact: 'stopped', depth: 1 }],
        affectedGroups: [{ groupGuid: OTHER_GROUP_GUID, groupName: 'Turbine Hall', impact: 'stopped' }]
      }),
      { groupGuid: GROUP_GUID, propagateDegraded: true, maxDepth: 5 }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.maxDepth).toBe(5);
    expect(data.affectedAssets[0].impact).toBe('stopped');
    expect(data.affectedAssets[0]).not.toHaveProperty('assetId');
  });

  test('blast radius ranks the single points of failure', async () => {
    const response = await call(
      'UteamupAssetGroupBlastRadius',
      { groupGuid: GROUP_GUID },
      successReply({
        groupGuid: GROUP_GUID,
        members: [
          { assetGuid: ASSET_GUID, assetName: 'Feed pump 1', reachedAssetCount: 6, isSinglePointOfFailure: true },
          { assetGuid: SECOND_ASSET_GUID, assetName: 'Feed pump 2', reachedAssetCount: 0, isSinglePointOfFailure: false }
        ]
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.members[0].isSinglePointOfFailure).toBe(true);
    expect(data.members[1].reachedAssetCount).toBe(0);
  });

  test('live status names the signal that produced each colour', async () => {
    const response = await call(
      'UteamupAssetGroupLiveStatus',
      { groupGuid: GROUP_GUID },
      successReply({
        groupGuid: GROUP_GUID,
        telemetryAvailable: false,
        computedAtUtc: '2026-09-08T10:00:00Z',
        members: [{ assetGuid: ASSET_GUID, status: 'critical', source: 'openFailure', observedAt: '2026-09-08T09:00:00Z' }]
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.members[0].status).toBe('critical');
    expect(data.members[0].source).toBe('openFailure');
    expect(data.telemetryAvailable).toBe(false);
  });

  test('label payload carries the QR target and the assigned codes', async () => {
    const response = await call(
      'UteamupAssetGroupLabelPayload',
      { groupGuid: GROUP_GUID },
      successReply({
        guid: GROUP_GUID,
        name: 'Boiler House',
        qrValue: `https://app.uteamup.com/asset-groups/${GROUP_GUID}`,
        barcodeValue: 'AG-0001',
        codes: [{ code: '10LAC', codingSystemName: 'KKS' }]
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.qrValue).toContain(GROUP_GUID);
    expect(data.codes[0].codingSystemName).toBe('KKS');
  });

  test('link generation forwards the whole request and returns a proposal, not a write', async () => {
    const request = {
      prompt: 'The feed pump feeds the boiler and the boiler drives the turbine.',
      mode: 'AssetLinks',
      assetGroupGuid: GROUP_GUID,
      requestGuid: REQUEST_GUID
    };
    const response = await call(
      'UteamupAssetGroupLinksGenerate',
      { request },
      successReply({
        generationGuid: GENERATION_GUID,
        status: 'proposed',
        mode: 'assetLinks',
        assetGroupGuid: GROUP_GUID,
        explanation: 'Two edges follow from the described flow.',
        assumptions: ['Feed pump 1 is the only feed'],
        clarifications: [],
        links: [{ linkId: 'l1', sourceGuid: ASSET_GUID, sourceName: 'Feed pump 1', targetGuid: SECOND_ASSET_GUID, targetName: 'Boiler 1' }],
        unresolvedReferences: [],
        processingSteps: [],
        warnings: [],
        creditsCharged: 3,
        remaining: 97,
        quotaBlockedReason: null,
        provider: 'openai',
        modelName: 'gpt-4',
        error: null,
        expiresAtUtc: '2026-09-09T10:00:00Z'
      }),
      { request }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.generationGuid).toBe(GENERATION_GUID);
    expect(data.creditsCharged).toBe(3);
    expect(data.links[0].sourceGuid).toBe(ASSET_GUID);
  });

  test('a refused quota comes back on the 200 body, never as a transport error', async () => {
    const response = await call(
      'UteamupAssetGroupLinksGenerate',
      { request: { prompt: 'Describe the wiring please.', assetGroupGuid: GROUP_GUID, requestGuid: REQUEST_GUID } },
      successReply({
        generationGuid: GENERATION_GUID,
        status: 'quotaBlocked',
        links: [],
        creditsCharged: 0,
        remaining: 0,
        quotaBlockedReason: 'The tenant has no AI credits left this period.'
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.body.error).toBeUndefined();
    expect(data.quotaBlockedReason).toContain('no AI credits');
    expect(data.creditsCharged).toBe(0);
    expect(data.links).toEqual([]);
  });

  test('re-reading a stored generation costs nothing', async () => {
    const response = await call(
      'UteamupAssetGroupLinksGenerationGet',
      { generationGuid: GENERATION_GUID },
      successReply({ generationGuid: GENERATION_GUID, status: 'proposed', links: [], creditsCharged: 0 })
    );
    expect(JSON.parse(response.body.result.content[0].text).creditsCharged).toBe(0);
  });

  test('apply forwards the accepted ids and the per-link overrides verbatim', async () => {
    const request = {
      acceptedLinkIds: ['l1'],
      overrides: [{ linkId: 'l1', failureImpact: 'SafetyRisk', notes: 'Trip risk on loss of feed' }]
    };
    const response = await call(
      'UteamupAssetGroupLinksApply',
      { generationGuid: GENERATION_GUID, request },
      successReply({ generationGuid: GENERATION_GUID, createdCount: 1, skippedCount: 0, createdDependencyGuids: [DEPENDENCY_GUID] }),
      { generationGuid: GENERATION_GUID, request }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.createdCount).toBe(1);
    expect(data.createdDependencyGuids).toEqual([DEPENDENCY_GUID]);
  });

  test('applying the same generation twice is a conflict', async () => {
    const response = await call(
      'UteamupAssetGroupLinksApply',
      { generationGuid: GENERATION_GUID, request: { acceptedLinkIds: ['l1'] } },
      errorReply(-32000, 'This generation has already been applied.')
    );
    expect(response.body.error.message).toContain('already been applied');
  });

  const allTools = [
    { name: 'UteamupAssetGroupList', args: { page: 1, pageSize: 10 } },
    { name: 'UteamupAssetGroupGet', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupCreate', args: { model: { name: 'Boiler House' } } },
    { name: 'UteamupAssetGroupUpdate', args: { groupGuid: GROUP_GUID, model: { name: 'Boiler House' } } },
    { name: 'UteamupAssetGroupDelete', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupMembersAdd', args: { groupGuid: GROUP_GUID, model: { assetGuids: [ASSET_GUID] } } },
    { name: 'UteamupAssetGroupMembersRemove', args: { groupGuid: GROUP_GUID, assetGuid: ASSET_GUID } },
    { name: 'UteamupAssetGroupDiagramGet', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupPositionsSave', args: { groupGuid: GROUP_GUID, model: { positions: [] } } },
    { name: 'UteamupAssetGroupAutoLayout', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupMapGet', args: {} },
    { name: 'UteamupAssetGroupDependenciesList', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupDependenciesCreate', args: { model: { sourceGroupGuid: GROUP_GUID, targetGroupGuid: OTHER_GROUP_GUID } } },
    { name: 'UteamupAssetGroupDependenciesDelete', args: { dependencyGuid: DEPENDENCY_GUID } },
    { name: 'UteamupAssetGroupImpactAnalyze', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupBlastRadius', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupLiveStatus', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupLabelPayload', args: { groupGuid: GROUP_GUID } },
    { name: 'UteamupAssetGroupLinksGenerate', args: { request: { prompt: 'Describe the wiring please.', assetGroupGuid: GROUP_GUID, requestGuid: REQUEST_GUID } } },
    { name: 'UteamupAssetGroupLinksGenerationGet', args: { generationGuid: GENERATION_GUID } },
    { name: 'UteamupAssetGroupLinksApply', args: { generationGuid: GENERATION_GUID, request: { acceptedLinkIds: ['l1'] } } }
  ];

  test('the tool matrix covers every asset group tool exactly once', () => {
    expect(allTools).toHaveLength(21);
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(allTools.length);
  });

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/"(assetId|groupId|tenantId|dependencyId|userId)"/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
