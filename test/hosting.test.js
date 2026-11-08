'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const baseUrl = 'https://api.uteamup.com';
const tool = { name: 'UteamupHostingCosts', args: { month: '2026-11-01' } };
const retryTool = { name: 'UteamupHostingRetryPermissions', args: {} };
const refreshTool = { name: 'UteamupHostingRefresh', args: { month: '2026-11-01' } };
const call = (name, args, reply) => callMcpTool(baseUrl, 'test-token', name, args, reply);

describe('Saved platform hosting evidence', () => {
  afterEach(() => nock.cleanAll());
  test('passes complete snapshot evidence and unknown invoice amounts through unchanged', async () => {
    const model = { isConfigured: true, month: '2026-11-01', subscriptions: [{
      subscriptionGuid: 'aaaaaaaa-1111-4111-8111-111111111111',
      costs: { charges: [{ cost: -10, currency: 'EUR', resourceId: null }] },
      monthlyBreakdowns: [{ month: '2026-10-01', currency: 'EUR', cost: -10,
        collectedAt: '2026-11-08T21:08:00Z', categories: [{ category: 'other', cost: -10 }] }],
      invoices: { invoices: [{ name: 'invoice', total: null, tax: null, due: null }] },
    }] };
    const result = await call(tool.name, tool.args, successReply(model));
    expect(JSON.parse(result.body.result.content[0].text)).toEqual(model);
  });
  test('preserves the explicit unconfigured state', async () => {
    const model = { isConfigured: false, month: '2026-11-01', subscriptions: [] };
    const result = await call(tool.name, {}, successReply(model));
    expect(JSON.parse(result.body.result.content[0].text)).toEqual(model);
  });
  test('preserves configured-identity denial', async () => {
    const result = await call(tool.name, tool.args, errorReply(-32003, 'Configured Global Admin required'));
    expect(result.body.error.message).toContain('Global Admin');
  });
  test.each([true, false])('passes the guarded permission-retry result %s through unchanged', async (retried) => {
    const result = await call(retryTool.name, retryTool.args, successReply(retried));
    expect(JSON.parse(result.body.result.content[0].text)).toBe(retried);
  });
  test.each([true, false])('preserves guarded fresh collection result %s', async (accepted) => {
    const result = await call(refreshTool.name, refreshTool.args, successReply(accepted));
    expect(JSON.parse(result.body.result.content[0].text)).toBe(accepted);
  });
  test('preserves refresh configured-identity denial', async () => {
    const result = await call(refreshTool.name, refreshTool.args, errorReply(-32003, 'Configured Global Admin required'));
    expect(result.body.error.message).toContain('Global Admin');
  });
});

describeJsonRpcCompliance(call, [tool, retryTool, refreshTool]);
describe401Unauthorized(baseUrl, [tool, retryTool, refreshTool]);
describe503ServiceUnavailable(baseUrl, [tool, retryTool, refreshTool]);
