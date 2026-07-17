/**
 * Procurement-intelligence MCP proxy contract.
 *
 * The backend owns the typed tool and permission gate; this verifies the generic
 * proxy preserves the bounded lookback argument and returns GUID-only evidence.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupPartGetProcurementIntelligence', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_procurement_intelligence';
  const tool = {
    name: 'UteamupPartGetProcurementIntelligence',
    args: { lookbackDays: 365 },
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply);

  it('returns GUID-only duplicate and purchase-order evidence', async () => {
    const response = await call(
      tool.name,
      tool.args,
      successReply({
        duplicatePartCandidates: [
          {
            firstPartGuid: '11111111-1111-1111-1111-111111111111',
            secondPartGuid: '22222222-2222-2222-2222-222222222222',
            confidenceScore: 100,
          },
        ],
        spendAnomalies: [
          {
            purchaseOrderGuid: '33333333-3333-3333-3333-333333333333',
            purchaseOrderItemGuid: '44444444-4444-4444-4444-444444444444',
          },
        ],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.duplicatePartCandidates[0].firstPartGuid).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(data.duplicatePartCandidates[0].firstPartId).toBeUndefined();
    expect(data.spendAnomalies[0].purchaseOrderGuid).toBe(
      '33333333-3333-3333-3333-333333333333',
    );
  });

  it('forwards only the explicit lookback and never spoofed tenant identity', async () => {
    let captured;
    nock(baseUrl)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({}).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(baseUrl, tool.name, tool.args);

    expect(captured.params.arguments).toEqual({ lookbackDays: 365 });
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
    expect(captured.params.arguments.userId).toBeUndefined();
  });

  describeJsonRpcCompliance(call, [tool]);
  describe401Unauthorized(baseUrl, [tool]);
  describe503ServiceUnavailable(baseUrl, [tool]);
});
