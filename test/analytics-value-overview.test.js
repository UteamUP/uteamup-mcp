'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

// Feature d251c66e: current stock, asset and combined value, each section bound to its cost permission.
describe('UteamupAnalyticsValueOverview', () => {
  const base = 'https://api.test.com';
  const tool = { name: 'UteamupAnalyticsValueOverview', args: {} };
  const call = (name, args, reply) => callMcpTool(base, 'test-value-token', name, args, reply, args);
  const parse = response => JSON.parse(response.body.result.content[0].text);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns stock, asset and portfolio value as the backend sends them', async () => {
    const overview = {
      generatedAtUtc: '2026-11-09T12:00:00Z',
      stock: {
        itemCount: 2,
        unvaluedItemCount: 1,
        hasUnknownCurrency: true,
        currencyGroups: [
          { currencyCode: 'ISK', isCurrencyKnown: true, valuationStatus: 'KnownCurrency', onHandValue: 125000, damagedValue: 5000, expiredValue: 0 },
          { currencyCode: null, isCurrencyKnown: false, valuationStatus: 'CurrencyNotSet', itemCount: 1, onHandValue: 0 }
        ],
        onOrder: [{ currencyCode: 'EUR', value: 100, lineCount: 1 }]
      },
      assets: { currency: 'ISK', bookValueTotal: 900000, purchaseCostTotal: 1500000, isApproximate: false },
      portfolio: { currency: 'ISK', total: 1025000, includesStock: true, includesAssets: true }
    };

    const body = parse(await call(tool.name, tool.args, successReply(overview)));

    expect(body.portfolio.total).toBe(1025000);
    expect(body.stock.currencyGroups[1].currencyCode).toBeNull();
    expect(body.stock.onOrder[0].currencyCode).toBe('EUR');
  });

  test('keeps a section the caller may not see as null rather than zero', async () => {
    const body = parse(await call(tool.name, tool.args, successReply({
      stock: null,
      assets: { currency: 'ISK', bookValueTotal: 500 },
      portfolio: { currency: 'ISK', total: 500, includesStock: false, includesAssets: true }
    })));

    expect(body.stock).toBeNull();
    expect(body.portfolio.includesStock).toBe(false);
  });

  test('passes the access-denied refusal through for a caller with neither cost permission', async () => {
    const response = await call(tool.name, tool.args, errorReply(-32001,
      'permission_denied: Access denied: value analytics need InventoryCost.View with Stock.View, or AssetCost.View with Asset.View.'));

    expect(response.body.error.code).toBe(-32001);
    expect(response.body.error.message).toMatch(/Access denied/);
  });

  test('takes no identity or tenant selector; the bearer token decides what is visible', () => {
    expect(tool.args).not.toHaveProperty('tenantId');
    expect(tool.args).not.toHaveProperty('tenantGuid');
    expect(tool.args).not.toHaveProperty('userId');
  });

  describeJsonRpcCompliance(call, [tool]);
  describe401Unauthorized(base, [tool]);
  describe503ServiceUnavailable(base, [tool]);
});
