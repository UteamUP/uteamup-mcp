/**
 * Supplier-invoice MCP proxy contracts.
 *
 * The backend owns tenant scoping, deterministic matching, and durable-run
 * preparation. The generic proxy must preserve GUID-only arguments unchanged.
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

describe('supplier-invoice tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_supplier_invoice';
  const invoiceGuid = '11111111-1111-4111-8111-111111111111';
  const idempotencyGuid = '22222222-2222-4222-8222-222222222222';
  const captureRequest = {
    purchaseOrderGuid: '33333333-3333-4333-8333-333333333333',
    currencyGuid: '44444444-4444-4444-8444-444444444444',
    invoiceNumber: 'INV-2041',
    invoiceDate: '2026-07-10T00:00:00Z',
    subtotalAmount: 20,
    taxAmount: 0,
    freightAmount: 0,
    totalAmount: 20,
    idempotencyGuid,
    lines: [{
      lineNumber: 1,
      description: 'Bearing',
      quantity: 1,
      unitPrice: 20,
      taxAmount: 0,
      freightAmount: 0,
      lineTotal: 20,
    }],
  };
  const tools = [
    {
      name: 'UteamupStockListSupplierInvoices',
      args: { page: 1, pageSize: 50, matchStatus: 'PendingReview' },
    },
    {
      name: 'UteamupStockGetSupplierInvoice',
      args: { invoiceGuid },
    },
    {
      name: 'UteamupStockPreviewSupplierInvoiceMatch',
      args: { invoiceGuid },
    },
    {
      name: 'UteamupStockCreateSupplierInvoice',
      args: { request: captureRequest },
    },
    {
      name: 'UteamupStockPrepareSupplierInvoiceMatchRun',
      args: { invoiceGuid, idempotencyGuid },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply);

  it('returns GUID-only deterministic match evidence', async () => {
    const response = await call(
      'UteamupStockPreviewSupplierInvoiceMatch',
      { invoiceGuid },
      successReply({
        invoiceGuid,
        purchaseOrderGuid: '33333333-3333-4333-8333-333333333333',
        canProposeMatch: true,
        lines: [{
          invoiceLineGuid: '44444444-4444-4444-8444-444444444444',
          suggestedPurchaseOrderItemGuid: '55555555-5555-4555-8555-555555555555',
          quantityVariance: 2,
          unitPriceVariance: 1.5,
        }],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.invoiceGuid).toBe(invoiceGuid);
    expect(data.invoiceId).toBeUndefined();
    expect(data.lines[0].suggestedPurchaseOrderItemGuid).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });

  it('forwards retry-safe durable-run preparation without tenant spoofing', async () => {
    let captured;
    nock(baseUrl)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({
        runGuid: '66666666-6666-4666-8666-666666666666',
        status: 'awaiting-approval',
      }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(
      baseUrl,
      'UteamupStockPrepareSupplierInvoiceMatchRun',
      { invoiceGuid, idempotencyGuid },
    );

    expect(captured.params.arguments).toEqual({ invoiceGuid, idempotencyGuid });
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.invoiceId).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
