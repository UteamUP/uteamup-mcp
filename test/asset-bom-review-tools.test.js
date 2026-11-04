'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Canonical asset PDF BOM review tools', () => {
  const base = 'https://api.test.com';
  const assetGuid = '11111111-1111-4111-8111-111111111111';
  const sessionGuid = '22222222-2222-4222-8222-222222222222';
  const evidenceGuid = '33333333-3333-4333-8333-333333333333';
  const call = (name, args, reply) => callMcpTool(base, 'test-bom-token', name, args, reply, args);
  const tools = [
    { name: 'UteamupAssetBomSources', args: { assetGuid }, result: [] },
    { name: 'UteamupAssetBomReviewCreate', args: { assetGuid, documentGuid: evidenceGuid }, result: { sessionGuid, assetGuid, revision: 1, rows: [], creditsCharged: 0 } },
    { name: 'UteamupAssetBomReviewGet', args: { assetGuid, sessionGuid }, result: null },
    { name: 'UteamupAssetBomReviewAnalyze', args: { assetGuid, sessionGuid, request: {
      pageGuids: [evidenceGuid], confirmedCreditsPerPage: 5, confirmedEstimatedCredits: 5, analysisMode: 'ai'
    } }, result: { success: true, revision: 2 } },
    { name: 'UteamupAssetBomReviewPatchRow', args: { assetGuid, sessionGuid, candidateGuid: evidenceGuid, request: {
      revision: 2, decision: 'approved', row: {
        itemNumber: 'A-01', partNumber: 'SEAL-01', description: 'Seal', quantity: 0.125,
        matchedPartGuid: evidenceGuid, createNewPart: false, uncertaintyAcknowledged: true
      }
    } }, result: { success: true, revision: 3 } },
    { name: 'UteamupAssetBomReviewPatchPage', args: { assetGuid, sessionGuid, pageGuid: evidenceGuid, request: {
      revision: 3, isSelected: false, exclusionReason: 'No BOM on the reviewed page'
    } }, result: { success: true, revision: 4 } },
    { name: 'UteamupAssetBomReviewApply', args: { assetGuid, sessionGuid, request: {
      revision: 4, acknowledged: false
    } }, result: { success: false, revision: 4 } },
    { name: 'UteamupAssetBomReviewDelete', args: { assetGuid, sessionGuid }, result: true }
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  for (const tool of tools) {
    test(tool.name + ' forwards exact public GUIDs and reviewed request without adding authority', async () => {
      const response = await call(tool.name, tool.args, successReply(tool.result));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(tool.result);
      expect(tool.args).not.toHaveProperty('tenantId');
      expect(tool.args).not.toHaveProperty('tenantGuid');
      expect(tool.args).not.toHaveProperty('userId');
      expect(tool.args).not.toHaveProperty('globalAdminBypass');
      expect(tool.args).not.toHaveProperty('canCreateParts');
    });
    test(tool.name + ' preserves canonical errors', async () => {
      const response = await call(tool.name, tool.args, errorReply(-32001, 'Source permission required'));
      expect(response.body.error.code).toBe(-32001);
    });
  }
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
