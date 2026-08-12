'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRaw,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('provider-neutral billing commerce MCP tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_billing_commerce';
  const orderGuid = '11111111-1111-1111-1111-111111111111';
  const invoiceGuid = '22222222-2222-2222-2222-222222222222';
  const call = (name, args, reply, expectedArgs) =>
    callMcpToolRaw(baseUrl, accessToken, name, args, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('context preserves typed unavailable state without a fallback provider', async () => {
    const payload = {
      tenantGuid: '33333333-3333-3333-3333-333333333333',
      provider: null,
      currency: null,
      customerProfileComplete: false,
      availability: { available: false, code: 'KLING_CONFIGURATION_UNAVAILABLE' },
      paymentMethods: [],
      allowedActions: ['view_invoices'],
    };
    const response = await call('UteamupBillingContextGet', {}, successReply(payload), {});
    const result = JSON.parse(response.body.result.content[0].text);

    expect(result.provider).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.paymentMethods).toEqual([]);
  });

  test('catalog preserves blocked products separately from eligible items', async () => {
    const payload = {
      currency: 'ISK',
      items: [],
      blockedItems: [{ sku: 'AI-TOPUP-100-ISK-V1', productKind: 3, code: 'PRICE_NOT_APPROVED' }],
    };
    const response = await call('UteamupBillingCatalogList', {}, successReply(payload), {});
    const result = JSON.parse(response.body.result.content[0].text);

    expect(result.items).toEqual([]);
    expect(result.blockedItems).toHaveLength(1);
  });

  test('order and invoice GUIDs are forwarded exactly', async () => {
    const orderResponse = await call(
      'UteamupBillingOrderGet',
      { orderGuid },
      successReply({ guid: orderGuid, status: 4, selectedPaymentMethod: 'card' }),
      { orderGuid },
    );
    const invoiceResponse = await call(
      'UteamupBillingInvoiceGet',
      { invoiceGuid },
      successReply({ guid: invoiceGuid, invoiceNumber: 'UU-2026-1' }),
      { invoiceGuid },
    );

    expect(orderResponse.status).toBe(200);
    expect(invoiceResponse.status).toBe(200);
  });

  test('empty tenant ledger collections pass through unchanged', async () => {
    for (const name of [
      'UteamupBillingAgreementsList',
      'UteamupBillingInvoicesList',
    ]) {
      const response = await call(name, {}, successReply([]), {});
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    }
  });

  test('missing profile and ledger record pass through as null', async () => {
    for (const [name, args] of [
      ['UteamupBillingProfileGet', {}],
      ['UteamupBillingOrderGet', { orderGuid }],
      ['UteamupBillingInvoiceGet', { invoiceGuid }],
    ]) {
      const response = await call(name, args, successReply(null), args);
      expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
    }
  });

  test('JSON-RPC error shape passes through without fabricating an empty ledger', async () => {
    const response = await call(
      'UteamupBillingInvoicesList',
      {},
      errorReply(-32603, 'billing ledger unavailable'),
      {},
    );

    expect(response.body.error.code).toBe(-32603);
    expect(response.body.error.message).toContain('unavailable');
  });

  const tools = [
    { name: 'UteamupBillingContextGet', args: {} },
    { name: 'UteamupBillingProfileGet', args: {} },
    { name: 'UteamupBillingCatalogList', args: {} },
    { name: 'UteamupBillingOrderGet', args: { orderGuid } },
    { name: 'UteamupBillingAgreementsList', args: {} },
    { name: 'UteamupBillingInvoicesList', args: {} },
    { name: 'UteamupBillingInvoiceGet', args: { invoiceGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
