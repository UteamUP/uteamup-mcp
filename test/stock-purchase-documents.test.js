'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Purchase receipt document contracts', () => {
  const baseUrl = 'https://api.uteamup.com';
  const token = 'synthetic-purchase-contract-token';
  const stockGuid = '11111111-1111-4111-8111-111111111111';
  const stockItemGuid = '22222222-2222-4222-8222-222222222222';
  const purchaseGuid = '33333333-3333-4333-8333-333333333333';
  const documentGuid = '44444444-4444-4444-8444-444444444444';
  const cases = [
    { name: 'UteamupStockAddTransaction', args: { model: { stockGuid, stockItemGuid, amount: 2,
      purchaseDate: '2026-11-02T00:00:00Z', invoiceNumber: 'INV-2026-11', documentGuids: [documentGuid] } } },
    { name: 'UteamupStockGetPurchaseTransaction', args: { purchaseGuid } },
    { name: 'UteamupStockGetPurchaseTransactions', args: { stockItemGuid } }
  ];
  const call = (name, args, reply, expectedArgs) => callMcpTool(baseUrl, token, name, args, reply, expectedArgs);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it.each(cases)('forwards $name with the exact additive GUID arguments', async ({ name, args }) => {
    const response = await call(name, args, successReply({ guid: purchaseGuid, documents: [] }), args);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ guid: purchaseGuid, documents: [] });
  });

  it('preserves receipt metadata on authorized create and readback', async () => {
    const document = { documentGuid, fileName: 'receipt.pdf', contentType: 'application/pdf', fileSize: 1234, isArchived: false };
    for (const entry of cases) {
      const body = { guid: purchaseGuid, stockGuid, stockItemGuid, amount: 2, documents: [document] };
      const response = await call(entry.name, entry.args, successReply(entry.name.endsWith('Transactions') ? [body] : body), entry.args);
      const payload = JSON.parse(response.body.result.content[0].text);
      const row = Array.isArray(payload) ? payload[0] : payload;
      expect(row.documents).toEqual([document]);
      expect(row.documents[0]).not.toHaveProperty('id');
      expect(row.documents[0]).not.toHaveProperty('tenantGuid');
      expect(row.documents[0]).not.toHaveProperty('blobUrl');
    }
  });

  it('retains an empty receipt list when Document.View is unavailable', async () => {
    const response = await call(cases[1].name, cases[1].args, successReply({ guid: purchaseGuid, documents: [] }));
    expect(JSON.parse(response.body.result.content[0].text).documents).toEqual([]);
  });

  it('preserves complete-set validation and permission refusals', async () => {
    for (const message of ['invalid_argument: One or more document references are invalid or unavailable.',
      'permission_denied: Document.View is required to link purchase documents.']) {
      const response = await call(cases[0].name, cases[0].args, errorReply(-32602, message));
      expect(response.body.error.message).toBe(message);
      expect(response.body).not.toHaveProperty('result');
    }
  });

  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(baseUrl, cases);
  describe503ServiceUnavailable(baseUrl, cases);
});
