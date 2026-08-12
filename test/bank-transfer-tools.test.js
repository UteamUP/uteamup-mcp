/**
 * Bank-transfer billing MCP tool tests (billing-kling-remediation F5.4).
 *
 * Tools under test — GUID-first after the F5.4 migration (invoice/subscription/payment
 * identifiers are external GUIDs; the old int-id params are gone):
 *   UteamupBankTransferListInvoices(statusFilter?)          [GlobalAdmin]
 *   UteamupBankTransferGetInvoice(invoiceGuid)              [GlobalAdmin]
 *   UteamupBankTransferMarkPaid(invoiceGuid, amount, ref?)  [GlobalAdmin]
 *   UteamupBankTransferListSubscriptions()                  [GlobalAdmin]
 *   UteamupBankTransferActivateSubscription(subscriptionGuid) [GlobalAdmin]
 *   UteamupBankTransferDashboard()                          [GlobalAdmin]
 *   UteamupBankTransferBillingOverview()                    [tenant, Billing.View]
 *   UteamupBankTransferRefundPayment(paymentGuid, reason, amount?) [GlobalAdmin]
 *
 * Pattern mirrors billing-gateway-switcher-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Bank-transfer billing MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_bank_transfer';

  const INVOICE_GUID = '11111111-aaaa-4aaa-8aaa-111111111111';
  const SUBSCRIPTION_GUID = '22222222-bbbb-4bbb-8bbb-222222222222';
  const PAYMENT_GUID = '33333333-cccc-4ccc-8ccc-333333333333';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  describe('Happy path', () => {
    test('UteamupBankTransferGetInvoice — guid-keyed lookup', async () => {
      const response = await call(
        'UteamupBankTransferGetInvoice',
        { invoiceGuid: INVOICE_GUID },
        successReply({ guid: INVOICE_GUID, invoiceNumber: 'UU-2026-000123', status: 'Sent', totalAmount: 125000 })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupBankTransferMarkPaid — guid-keyed reconciliation', async () => {
      const response = await call(
        'UteamupBankTransferMarkPaid',
        { invoiceGuid: INVOICE_GUID, amount: 125000, bankReference: 'RB-778812' },
        successReply({ guid: INVOICE_GUID, status: 'Paid' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupBankTransferBillingOverview — tenant-scoped subscription read', async () => {
      const response = await call(
        'UteamupBankTransferBillingOverview',
        {},
        successReply({ guid: SUBSCRIPTION_GUID, status: 'Active', planName: 'Gold', scheduledCancelAt: null })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupBankTransferRefundPayment — full refund when amount omitted', async () => {
      const response = await call(
        'UteamupBankTransferRefundPayment',
        { paymentGuid: PAYMENT_GUID, reason: 'Duplicate charge — customer notified.' },
        successReply({ refundedAmount: 125000, creditNoteNumber: 'UU-2026-000124', providerRefundId: 're_test_1' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });
  });

  const complianceTools = [
    { name: 'UteamupBankTransferListInvoices', args: { statusFilter: 'Overdue' } },
    { name: 'UteamupBankTransferGetInvoice', args: { invoiceGuid: INVOICE_GUID } },
    { name: 'UteamupBankTransferMarkPaid', args: { invoiceGuid: INVOICE_GUID, amount: 125000 } },
    { name: 'UteamupBankTransferListSubscriptions', args: {} },
    { name: 'UteamupBankTransferActivateSubscription', args: { subscriptionGuid: SUBSCRIPTION_GUID } },
    { name: 'UteamupBankTransferDashboard', args: {} },
    { name: 'UteamupBankTransferBillingOverview', args: {} },
    { name: 'UteamupBankTransferRefundPayment', args: { paymentGuid: PAYMENT_GUID, reason: 'Compliance test refund.' } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
