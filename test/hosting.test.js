'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const baseUrl = 'https://api.uteamup.com';
const tool = { name: 'UteamupHostingCosts', args: { month: '2026-11-01' } };
const call = (name, args, reply) => callMcpTool(baseUrl, 'test-token', name, args, reply);

describe('Saved platform hosting evidence', () => {
  afterEach(() => nock.cleanAll());
  test('passes complete snapshot evidence and unknown invoice amounts through unchanged', async () => {
    const model = { isConfigured: true, month: '2026-11-01', subscriptions: [{
      subscriptionGuid: 'aaaaaaaa-1111-4111-8111-111111111111',
      costs: { charges: [{ cost: -10, currency: 'EUR', resourceId: null }] },
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
});

describeJsonRpcCompliance(call, [tool]);
describe401Unauthorized(baseUrl, [tool]);
describe503ServiceUnavailable(baseUrl, [tool]);
