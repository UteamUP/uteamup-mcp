'use strict';

const nock = require('nock');
const { callMcpTool: proxyCall } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Private labour marketplace workspace tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_labour_workspace';
  const call = (name, args, reply) => proxyCall(BASE_URL, ACCESS_TOKEN, name, args, reply);
  const tool = { name: 'UteamupLabourMarketplaceWorkspaceMe', args: {} };
  const timesheetsTool = {
    name: 'UteamupLabourAgreementTimesheets',
    args: { agreementGuid: '44444444-4444-4444-8444-444444444444' }
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns buyer, provider, and worker portfolios without identity selectors', async () => {
    const response = await call(tool.name, {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          hasBuyerPortfolio: true,
          hasProviderPortfolio: true,
          hasWorkerPortfolio: true,
          buyerJobs: [{ guid: '11111111-1111-4111-8111-111111111111', applicationCount: 2 }],
          providerApplications: [{ jobGuid: '22222222-2222-4222-8222-222222222222' }],
          agreements: [{ currentUserDispatchGuids: ['33333333-3333-4333-8333-333333333333'] }]
        }) }] },
        id: 1
      }
    });

    const body = JSON.parse(response.body.result.content[0].text);
    expect(body.buyerJobs[0].applicationCount).toBe(2);
    expect(body.providerApplications[0].jobGuid).toBe('22222222-2222-4222-8222-222222222222');
    expect(body.agreements[0].currentUserDispatchGuids).toEqual([
      '33333333-3333-4333-8333-333333333333'
    ]);
    expect(body).not.toHaveProperty('providerPartyGuid');
    expect(body).not.toHaveProperty('buyerPartyGuid');
    expect(body).not.toHaveProperty('userId');
  });

  test('returns rate-derived agreement timesheets through a GUID argument', async () => {
    const response = await call(timesheetsTool.name, timesheetsTool.args, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify([{
          guid: '55555555-5555-4555-8555-555555555555',
          labourAgreementGuid: timesheetsTool.args.agreementGuid,
          status: 'buyerApproved',
          labourSubtotal: 1000,
          platformFeeAmount: 100,
          providerApprovedAt: '2026-08-10T18:00:00Z',
          buyerApprovedAt: '2026-08-10T19:00:00Z',
          entries: [{ dispatchGuid: '66666666-6666-4666-8666-666666666666', hours: 8 }]
        }]) }] },
        id: 1
      }
    });

    const body = JSON.parse(response.body.result.content[0].text);
    expect(body[0].labourAgreementGuid).toBe(timesheetsTool.args.agreementGuid);
    expect(body[0].platformFeeAmount).toBe(100);
    expect(body[0].entries[0].dispatchGuid).toBe('66666666-6666-4666-8666-666666666666');
  });

  describeJsonRpcCompliance(call, [tool, timesheetsTool]);
  describe401Unauthorized(BASE_URL, [tool, timesheetsTool]);
  describe503ServiceUnavailable(BASE_URL, [tool, timesheetsTool]);
});
