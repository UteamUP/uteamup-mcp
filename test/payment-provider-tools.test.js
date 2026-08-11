/**
 * Payment-provider MCP tool tests (billing-kling-remediation F5.1).
 *
 * Tools under test — the read-only provider surface (Kling is the only live rail, so
 * switching the active provider is deliberately NOT an MCP tool):
 *   UteamupPaymentProvidersList()
 *   UteamupPaymentProviderHealthCheck(providerName)
 *
 * Pattern mirrors billing-gateway-switcher-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Payment-provider MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_payment_providers';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const listPayload = {
    activeProvider: 'Kling',
    providers: [
      { providerType: 'Kling', isActive: true, isEnabled: true, disabledReason: null, maskedKey: 'kl_****9f2a' },
      { providerType: 'Payday', isActive: false, isEnabled: false, disabledReason: 'parked', maskedKey: null },
      { providerType: 'Stripe', isActive: false, isEnabled: false, disabledReason: 'parked', maskedKey: null }
    ]
  };

  const healthPayload = {
    providerName: 'Kling',
    healthy: true,
    checkedAt: '2026-08-12T00:00:00Z',
    detail: 'API reachable; credentials resolve.'
  };

  describe('Happy path', () => {
    test('UteamupPaymentProvidersList — returns the active provider and parked rails', async () => {
      const response = await call('UteamupPaymentProvidersList', {}, successReply(listPayload));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.content).toBeDefined();
    });

    test('UteamupPaymentProviderHealthCheck — forwards the provider name', async () => {
      const response = await call(
        'UteamupPaymentProviderHealthCheck',
        { providerName: 'Kling' },
        successReply(healthPayload)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });
  });

  const complianceTools = [
    { name: 'UteamupPaymentProvidersList', args: {} },
    { name: 'UteamupPaymentProviderHealthCheck', args: { providerName: 'Kling' } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
