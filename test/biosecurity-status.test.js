'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Biosecurity status MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_biosecurity';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const workorderGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const permitGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  describe('UteamupBiosecurityStatus tool', () => {
    test('returns an uncleared Block zone with the open draft', async () => {
      const response = await call(
        'UteamupBiosecurityStatus',
        { workorderGuid },
        successReply({
          workorderGuid,
          isZone: true,
          policy: 'block',
          locationName: 'Site Nord',
          cleared: false,
          clearingPermitGuid: null,
          validUntilUtc: null,
          openDraftPermitGuid: permitGuid,
        }),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isZone).toBe(true);
      expect(data.policy).toBe('block');
      expect(data.cleared).toBe(false);
      expect(data.openDraftPermitGuid).toBe(permitGuid);
    });

    test('returns the clearing permit and its end for a cleared user', async () => {
      const response = await call(
        'UteamupBiosecurityStatus',
        { workorderGuid },
        successReply({
          workorderGuid,
          isZone: true,
          policy: 'warn',
          cleared: true,
          clearingPermitGuid: permitGuid,
          validUntilUtc: '2026-09-25T08:00:00Z',
          openDraftPermitGuid: null,
        }),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.cleared).toBe(true);
      expect(data.clearingPermitGuid).toBe(permitGuid);
      expect(data.validUntilUtc).toBe('2026-09-25T08:00:00Z');
    });

    test('passes a not-a-zone answer through unchanged', async () => {
      const response = await call(
        'UteamupBiosecurityStatus',
        { workorderGuid },
        successReply({ workorderGuid, isZone: false, policy: 'none', cleared: false }),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isZone).toBe(false);
      expect(data.policy).toBe('none');
    });
  });

  describeJsonRpcCompliance(call, [
    { name: 'UteamupBiosecurityStatus', args: { workorderGuid } },
  ]);
  describe401Unauthorized(BASE_URL, [
    { name: 'UteamupBiosecurityStatus', args: { workorderGuid } },
  ]);
  describe503ServiceUnavailable(BASE_URL, [
    { name: 'UteamupBiosecurityStatus', args: { workorderGuid } },
  ]);
});
