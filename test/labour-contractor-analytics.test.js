'use strict';

const nock = require('nock');
const { callMcpTool: proxyCall } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Private labour contractor analytics tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_labour_contractor_analytics';
  const call = (name, args, reply) => proxyCall(BASE_URL, ACCESS_TOKEN, name, args, reply);
  const tool = { name: 'UteamupLabourContractorAnalyticsMe', args: {} };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns identity-scoped portfolio with separate currency slices', async () => {
    const response = await call(tool.name, {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          isRegisteredContractor: true,
          canViewProviderPortfolio: true,
          openMarketplaceJobs: 12,
          activeAgreements: 1,
          pendingPersonalDispatches: 1,
          financials: [
            { currencyCode: 'EUR', grossApprovedValue: 400, uteamupFeeAmount: 40, netApprovedValue: 360 },
            { currencyCode: 'USD', grossApprovedValue: 1000, uteamupFeeAmount: 100, netApprovedValue: 900 }
          ],
          upcomingDispatches: [{ dispatchGuid: '11111111-1111-4111-8111-111111111111' }]
        }) }] },
        id: 1
      }
    });

    const body = JSON.parse(response.body.result.content[0].text);
    expect(body.financials.map(item => item.currencyCode)).toEqual(['EUR', 'USD']);
    expect(body.financials[1].uteamupFeeAmount).toBe(100);
    expect(body.upcomingDispatches[0].dispatchGuid).toBe('11111111-1111-4111-8111-111111111111');
    expect(body).not.toHaveProperty('providerPartyGuid');
  });

  describeJsonRpcCompliance(call, [tool]);
  describe401Unauthorized(BASE_URL, [tool]);
  describe503ServiceUnavailable(BASE_URL, [tool]);
});
