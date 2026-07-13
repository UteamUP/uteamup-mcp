'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  errorReply,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('durable handover transfer challenge MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'handover_transfer_token';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const ISSUE_ARGS = { handoverGuid: HANDOVER_GUID };
  const REDEEM_ARGS = { token: 'signed-single-use-token' };
  const tools = [
    { name: 'UteamupHandoverAttestationIssue', args: ISSUE_ARGS },
    { name: 'UteamupHandoverAttestationRedeem', args: REDEEM_ARGS },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('preserves the fully-bound issue receipt without integer identities', async () => {
    const challenge = {
      token: 'signed-single-use-token',
      sessionGuid: '22222222-2222-4222-8222-222222222222',
      challengeGuid: '33333333-3333-4333-8333-333333333333',
      handoverGuid: HANDOVER_GUID,
      shiftGuid: '44444444-4444-4444-8444-444444444444',
      issuerUserGuid: '55555555-5555-4555-8555-555555555555',
      expectedReceiverUserGuid: '66666666-6666-4666-8666-666666666666',
      purpose: 'shift-handover-transfer',
      audience: 'uteamup-mobile-handover',
      transport: 'QrNfcDeepLink',
      expiresAt: '2026-07-13T13:01:00Z',
      sessionExpiresAt: '2026-07-13T13:15:00Z',
    };

    const response = await call(
      'UteamupHandoverAttestationIssue',
      ISSUE_ARGS,
      successReply(challenge),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(challenge);
    expect(JSON.stringify(result)).not.toMatch(/tenantId|handoverId|shiftId|userId/);
  });

  test('preserves a durable redemption receipt', async () => {
    const receipt = {
      status: 'Redeemed',
      isValid: true,
      handoverGuid: HANDOVER_GUID,
      shiftGuid: '44444444-4444-4444-8444-444444444444',
      sessionGuid: '22222222-2222-4222-8222-222222222222',
      challengeGuid: '33333333-3333-4333-8333-333333333333',
      issuerUserGuid: '55555555-5555-4555-8555-555555555555',
      expectedReceiverUserGuid: '66666666-6666-4666-8666-666666666666',
      purpose: 'shift-handover-transfer',
      audience: 'uteamup-mobile-handover',
      redeemedAt: '2026-07-13T13:00:30Z',
    };

    const response = await call(
      'UteamupHandoverAttestationRedeem',
      REDEEM_ARGS,
      successReply(receipt),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
  });

  test('forwards only the stable handover GUID when issuing', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.params?.name === 'UteamupHandoverAttestationIssue';
      })
      .reply(
        200,
        JSON.stringify(successReply({ handoverGuid: HANDOVER_GUID }).body),
        { 'Content-Type': 'application/json' },
      );

    await sendRawRequest(
      BASE_URL,
      'UteamupHandoverAttestationIssue',
      ISSUE_ARGS,
    );

    expect(captured.params).toEqual({
      name: 'UteamupHandoverAttestationIssue',
      arguments: ISSUE_ARGS,
    });
  });

  test('preserves replay verdicts without turning redemption into a read', async () => {
    const response = await call(
      'UteamupHandoverAttestationRedeem',
      REDEEM_ARGS,
      successReply({ status: 'Replayed', isValid: false }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual({ status: 'Replayed', isValid: false });
  });

  test('preserves permission errors from the backend', async () => {
    const response = await call(
      'UteamupHandoverAttestationIssue',
      ISSUE_ARGS,
      errorReply(-32003, 'Permission denied: ShiftHandover.Attest required.'),
    );

    expect(response.body.error.code).toBe(-32003);
    expect(response.body.error.message).toContain('ShiftHandover.Attest required');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
