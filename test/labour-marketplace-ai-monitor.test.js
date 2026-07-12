'use strict';

const nock = require('nock');
const { callMcpTool: proxyCall } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Labour marketplace AI MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_labour_ai_monitor';
  const monitorGuid = '11111111-1111-4111-8111-111111111111';
  const providerPartyGuid = '22222222-2222-4222-8222-222222222222';
  const jobGuid = '33333333-3333-4333-8333-333333333333';
  const revisionGuids = [
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555'
  ];
  const call = (name, args, reply) => proxyCall(BASE_URL, ACCESS_TOKEN, name, args, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists private monitors and preserves explicit budgets', async () => {
    const response = await call('UteamupLabourMarketplaceAiJobMonitorsList', {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify([{
          guid: monitorGuid,
          providerPartyGuid,
          name: 'Shutdown work',
          maxCreditsPerRun: 2,
          monthlyCreditBudget: 20,
          creditsUsedThisMonth: 4,
          status: 'Active'
        }]) }] },
        id: 1
      }
    });

    const monitors = JSON.parse(response.body.result.content[0].text);
    expect(monitors).toHaveLength(1);
    expect(monitors[0].guid).toBe(monitorGuid);
    expect(monitors[0].monthlyCreditBudget).toBe(20);
  });

  test('returns an empty array when the user has no monitors', async () => {
    const response = await call('UteamupLabourMarketplaceAiJobMonitorsList', {}, {
      status: 200,
      body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: '[]' }] }, id: 2 }
    });
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('previews cost before a potentially charged run', async () => {
    const response = await call('UteamupLabourMarketplaceAiJobMonitorCost', {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ expectedCredits: 2, remaining: 18, canRun: true }) }] },
        id: 3
      }
    });
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ expectedCredits: 2, remaining: 18 });
  });

  test('forwards GUID-first create arguments and budgets', async () => {
    const args = {
      providerPartyGuid,
      name: 'Power jobs',
      industry: 'Power',
      frequencyHours: 24,
      maxCreditsPerRun: 2,
      monthlyCreditBudget: 20,
      isActive: true
    };
    const response = await call('UteamupLabourMarketplaceAiJobMonitorCreate', args, {
      status: 200,
      body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify({ guid: monitorGuid, ...args }) }] }, id: 4 }
    });
    expect(JSON.parse(response.body.result.content[0].text).providerPartyGuid).toBe(providerPartyGuid);
  });

  test('returns advisory run results and charged credits', async () => {
    const response = await call('UteamupLabourMarketplaceAiJobMonitorRun', { monitorGuid }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ monitorGuid, matches: [], creditsCharged: 0, remaining: 18, paused: false }) }] },
        id: 5
      }
    });
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ monitorGuid, creditsCharged: 0, paused: false });
  });

  test('surfaces permission failures without leaking another user monitor', async () => {
    const response = await call('UteamupLabourMarketplaceAiJobMonitorDelete', { monitorGuid }, {
      status: 200,
      body: { jsonrpc: '2.0', error: { code: -32000, message: 'Permission denied: MarketplaceAI.Use required' }, id: 6 }
    });
    expect(response.body.error.message).toContain('MarketplaceAI.Use');
  });

  test('previews and returns an editable buyer job draft without publishing', async () => {
    const cost = await call('UteamupLabourMarketplaceBuyerJobDraftCost', {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ expectedCredits: 4, remaining: 12, canRun: true }) }] },
        id: 7
      }
    });
    expect(JSON.parse(cost.body.result.content[0].text).expectedCredits).toBe(4);

    const args = {
      description: 'Four fitters for a planned turbine outage.',
      currencyCode: 'USD',
      projectGuid: '33333333-3333-4333-8333-333333333333',
      language: 'English'
    };
    const draft = await call('UteamupLabourMarketplaceBuyerJobDraftCreate', args, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          projectGuid: args.projectGuid,
          title: 'Turbine outage mechanical crew',
          creditsCharged: 4,
          disclaimer: 'Editable draft only; no job was published.'
        }) }] },
        id: 8
      }
    });
    expect(JSON.parse(draft.body.result.content[0].text)).toMatchObject({
      projectGuid: args.projectGuid,
      creditsCharged: 4
    });
  });

  test('previews and returns an advisory offer comparison without selecting a provider', async () => {
    const cost = await call('UteamupLabourMarketplaceOfferComparisonCost', {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ expectedCredits: 4, remaining: 12, canRun: true }) }] },
        id: 9
      }
    });
    expect(JSON.parse(cost.body.result.content[0].text).expectedCredits).toBe(4);

    const args = { jobGuid, revisionGuids, language: 'English' };
    const comparison = await call('UteamupLabourMarketplaceOfferComparison', args, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          jobGuid,
          hasMixedCurrencies: true,
          offers: revisionGuids.map((revisionGuid, index) => ({
            revisionGuid,
            currencyCode: index === 0 ? 'USD' : 'EUR'
          })),
          summary: 'Resolve scope and currency differences before deciding.',
          creditsCharged: 4,
          disclaimer: 'Advisory only; no provider was selected or ranked.'
        }) }] },
        id: 10
      }
    });
    const body = JSON.parse(comparison.body.result.content[0].text);
    expect(body.jobGuid).toBe(jobGuid);
    expect(body.offers.map(offer => offer.revisionGuid)).toEqual(revisionGuids);
    expect(body.hasMixedCurrencies).toBe(true);
    expect(body).not.toHaveProperty('selectedRevisionGuid');
  });

  test('previews and returns an editable contractor application draft without submitting', async () => {
    const cost = await call('UteamupLabourMarketplaceContractorApplicationDraftCost', {}, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ expectedCredits: 4, remaining: 9, canRun: true }) }] },
        id: 11
      }
    });
    expect(JSON.parse(cost.body.result.content[0].text).expectedCredits).toBe(4);

    const args = { jobGuid, providerPartyGuid, language: 'English' };
    const draft = await call('UteamupLabourMarketplaceContractorApplicationDraftCreate', args, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          jobGuid,
          providerPartyGuid,
          coverNote: 'Editable contractor draft.',
          answers: [{ questionGuid: '44444444-4444-4444-8444-444444444444', requiresContractorVerification: true }],
          possibleQualificationGaps: ['HV switching'],
          creditsCharged: 4,
          disclaimer: 'Editable only; no application was submitted.'
        }) }] },
        id: 12
      }
    });
    expect(JSON.parse(draft.body.result.content[0].text)).toMatchObject({
      jobGuid,
      providerPartyGuid,
      creditsCharged: 4
    });
  });

  const createArgs = { providerPartyGuid, name: 'Power jobs', maxCreditsPerRun: 2, monthlyCreditBudget: 20 };
  const tools = [
    { name: 'UteamupLabourMarketplaceBuyerJobDraftCost', args: {} },
    { name: 'UteamupLabourMarketplaceBuyerJobDraftCreate', args: { description: 'Four fitters for a planned outage.', currencyCode: 'USD' } },
    { name: 'UteamupLabourMarketplaceOfferComparisonCost', args: {} },
    { name: 'UteamupLabourMarketplaceOfferComparison', args: { jobGuid, revisionGuids, language: 'English' } },
    { name: 'UteamupLabourMarketplaceContractorApplicationDraftCost', args: {} },
    { name: 'UteamupLabourMarketplaceContractorApplicationDraftCreate', args: { jobGuid, providerPartyGuid, language: 'English' } },
    { name: 'UteamupLabourMarketplaceAiJobMonitorsList', args: {} },
    { name: 'UteamupLabourMarketplaceAiJobMonitorCost', args: {} },
    { name: 'UteamupLabourMarketplaceAiJobMonitorCreate', args: createArgs },
    { name: 'UteamupLabourMarketplaceAiJobMonitorUpdate', args: { monitorGuid, ...createArgs } },
    { name: 'UteamupLabourMarketplaceAiJobMonitorDelete', args: { monitorGuid } },
    { name: 'UteamupLabourMarketplaceAiJobMonitorRun', args: { monitorGuid } }
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
