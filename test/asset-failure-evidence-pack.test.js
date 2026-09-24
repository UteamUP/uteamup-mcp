'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset failure incident evidence pack MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-failure-evidence-pack-token';
  const TOOL = 'UteamupAssetFailureEvidencePack';
  const FAILURE_GUID = '3f2b9c1d-7e4a-4b5c-9d6e-1a2b3c4d5e6f';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards the failure GUID and window unchanged and round-trips the sections', async () => {
    const args = { failureGuid: FAILURE_GUID, hoursBefore: 12, hoursAfter: 3 };
    const response = await call(
      TOOL,
      args,
      successReply({
        failureGuid: FAILURE_GUID,
        window: { hoursBefore: 12, hoursAfter: 3, failureTimeRecorded: true },
        meterReadings: { included: true, truncated: false, excludedReadingCount: 1, meters: [] },
        iotAlerts: { included: false, reason: 'permission', truncated: false, alerts: [] },
        priorFailures: { included: true, truncated: false, count: 3, mtbfHours: 240, failures: [] },
      }),
      args,
    );

    expect(response.status).toBe(200);
    const pack = JSON.parse(response.body.result.content[0].text);
    expect(pack.failureGuid).toBe(FAILURE_GUID);
    expect(pack.window).toMatchObject({ hoursBefore: 12, hoursAfter: 3 });
    expect(pack.iotAlerts).toMatchObject({ included: false, reason: 'permission' });
    expect(pack.priorFailures.mtbfHours).toBe(240);
  });

  test('sends only the GUID when no window is given, leaving the defaults to the backend', async () => {
    const args = { failureGuid: FAILURE_GUID };
    const response = await call(TOOL, args, successReply({ failureGuid: FAILURE_GUID }), args);

    expect(response.status).toBe(200);
    expect(JSON.stringify(args)).not.toMatch(/"(?:id|failureId|assetId)"/);
  });

  test('passes a backend permission denial through as a JSON-RPC error', async () => {
    const response = await call(
      TOOL,
      { failureGuid: FAILURE_GUID },
      errorReply(-32603, 'Permission denied: AssetFailure.View required'),
    );

    expect(response.body.error.message).toContain('AssetFailure.View');
    expect(response.body.result).toBeUndefined();
  });

  const tools = [{ name: TOOL, args: { failureGuid: FAILURE_GUID, hoursBefore: 24, hoursAfter: 6 } }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
