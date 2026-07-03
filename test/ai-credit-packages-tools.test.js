/**
 * AI-credit packages MCP tool tests.
 *
 * Covers the read-only UteamupAiCreditPackagesList tool (backend PlanManagementTools →
 * GetAiCreditPackagesCommand, mirroring GET /api/plan/ai-credit-packages). Asserts the proxy
 * forwards a valid JSON-RPC 2.0 tools/call and passes the backend /mcp response through, plus the
 * shared JSON-RPC compliance + 401 + 503 suites.
 *
 * Pattern mirrors billing-gateway-switcher-tools.test.js: nock-mocked HTTPS calls simulating what
 * the MCP proxy forwards to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('AI-credit packages MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_credit_packages';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // Bronze/Silver/Gold, smallest bundle first — the shape the handler returns (PlanResponseModel[]).
  const packagesPayload = [
    { guid: '11111111-1111-1111-1111-111111111111', name: 'Bronze AI Credits', sku: 'AIC-BRONZE', planType: 'AiCredits', aiCreditsBundleSize: 25000, aiCreditsBundlePriceCents: 2500, aiCreditsBundlePriceEurCents: 2300, aiCreditsBundlePriceIsk: 3500, annualDiscountPercentage: 10, bestOffer: false, isActive: true },
    { guid: '22222222-2222-2222-2222-222222222222', name: 'Silver AI Credits', sku: 'AIC-SILVER', planType: 'AiCredits', aiCreditsBundleSize: 75000, aiCreditsBundlePriceCents: 5000, aiCreditsBundlePriceEurCents: 4600, aiCreditsBundlePriceIsk: 7000, annualDiscountPercentage: 15, bestOffer: true, isActive: true },
    { guid: '33333333-3333-3333-3333-333333333333', name: 'Gold AI Credits', sku: 'AIC-GOLD', planType: 'AiCredits', aiCreditsBundleSize: 175000, aiCreditsBundlePriceCents: 10000, aiCreditsBundlePriceEurCents: 9200, aiCreditsBundlePriceIsk: 14000, annualDiscountPercentage: 20, bestOffer: false, isActive: true }
  ];

  describe('Happy path', () => {
    test('UteamupAiCreditPackagesList — forwards a no-arg tools/call and passes the package list through', async () => {
      const response = await call('UteamupAiCreditPackagesList', {}, successReply(packagesPayload));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.content).toBeDefined();
    });

    test('UteamupAiCreditPackagesList — empty catalogue passes through', async () => {
      const response = await call('UteamupAiCreditPackagesList', {}, successReply([]));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });
  });

  describe('Error pass-through', () => {
    test('UteamupAiCreditPackagesList — permission denied is forwarded', async () => {
      const response = await call('UteamupAiCreditPackagesList', {}, errorReply(403, 'Permission denied: Plan.View required'));
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });
  });

  const complianceTools = [{ name: 'UteamupAiCreditPackagesList', args: {} }];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
