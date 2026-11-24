/**
 * System status MCP tool tests.
 *
 * Tool under test:
 *   UteamupExternalServiceStatus(refresh?)   [configured Global Admin]
 *
 * Live status of every external service (AI providers, grounded search, database, storage,
 * Key Vault, payments, email, sign-in, Redis). Raw nock-mocked HTTPS calls simulate what the
 * MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('System status MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_system_status';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const report = (fromCache) => ({
    overallStatus: 'down',
    checkedAtUtc: '2026-09-22T23:00:00Z',
    fromCache,
    services: [
      {
        key: 'ai:d7054d6c-3e5a-4573-8391-55af67f1a678',
        category: 'ai',
        displayName: 'GoogleGemini (Managed GoogleGemini from GoogleAI)',
        status: 'down',
        latencyMs: 209,
        errorCode: 'provider_http_403',
        checkedAtUtc: '2026-09-22T23:00:01Z'
      },
      {
        key: 'database:postgres',
        category: 'database',
        displayName: 'PostgreSQL (shared database)',
        status: 'online',
        latencyMs: 4,
        errorCode: null,
        checkedAtUtc: '2026-09-22T23:00:01Z'
      }
    ]
  });

  describe('Happy path', () => {
    test('returns the cached report by default', async () => {
      const response = await call('UteamupExternalServiceStatus', {}, successReply(report(true)));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallStatus).toBe('down');
      expect(data.fromCache).toBe(true);
      expect(data.services).toHaveLength(2);
    });

    // UTE-1647: the report must carry per-service status, not only overallStatus.
    test('keeps per-service status, latency and error code alongside overallStatus', async () => {
      const response = await call('UteamupExternalServiceStatus', {}, successReply(report(false)));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallStatus).toBe('down');
      expect(data.services).toEqual(report(false).services);
      const failing = data.services.find(service => service.status === 'down');
      expect(failing.key).toBe('ai:d7054d6c-3e5a-4573-8391-55af67f1a678');
      expect(failing.errorCode).toBe('provider_http_403');
      expect(failing.latencyMs).toBe(209);
      const healthy = data.services.find(service => service.status === 'online');
      expect(healthy.key).toBe('database:postgres');
    });

    test('forwards refresh=true to force a new run', async () => {
      const response = await call(
        'UteamupExternalServiceStatus',
        { refresh: true },
        successReply(report(false)),
        { refresh: true }
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.fromCache).toBe(false);
      expect(data.services).toHaveLength(2);
    });
  });

  describe('Access', () => {
    test('a caller who is not a configured Global Admin gets a JSON-RPC error, not a report', async () => {
      const response = await call(
        'UteamupExternalServiceStatus',
        { refresh: true },
        errorReply(-32603, 'External service status requires a configured global administrator')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
    });
  });

  const complianceTools = [
    { name: 'UteamupExternalServiceStatus', args: {} },
    { name: 'UteamupExternalServiceStatus', args: { refresh: true } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
