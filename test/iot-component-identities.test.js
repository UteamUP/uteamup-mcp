'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Reviewed physical component identity tools', () => {
  const BASE_URL = 'https://api.uteamup.com';
  const TOKEN = 'isolated-source-identity-test-token';
  const sourceGuid = '11111111-1111-4111-8111-111111111111';
  const generationGuid = '22222222-2222-4222-8222-222222222222';
  const revision = '33333333-3333-4333-8333-333333333333';
  const operationId = '44444444-4444-4444-8444-444444444444';
  const unitGuid = '55555555-5555-4555-8555-555555555555';
  const review = { operationId, expectedSourceRevision: revision, sourceGenerationGuid: generationGuid,
    identity: { namespace: 'provider.hardware', stableHardwareId: 'Thread-Device-CaseSensitive' },
    unitGuid, expectedUnitSequence: 0, effectiveFrom: '2026-11-02T10:00:00Z', reason: 'Reviewed exact physical identity',
    channels: [{ channelNamespace: 'homeassistant.entity', stableChannelId: 'sensor.bulb_power', attribute: 'power',
      attributeDefinitionGuid: revision, unit: 'W', valueKind: 'gauge', quality: 'measured', expectsTelemetry: true }] };
  const tools = [
    { name: 'uteamup_iot_source_generations_list', args: { sourceGuid } },
    { name: 'uteamup_iot_source_enroll', args: { sourceGuid, model: { operationId, expectedSourceRevision: revision, sourceKind: 'homeassistant', reason: 'Reviewed collector' } } },
    { name: 'uteamup_iot_source_retire', args: { sourceGuid, model: { operationId, expectedSourceRevision: revision, sourceGenerationGuid: generationGuid, reason: 'Retired collector' } } },
    { name: 'uteamup_iot_source_key_issue', args: { sourceGuid, model: { name: 'Collector', credentialPurpose: 'componentSourceV2', sourceGenerationGuid: generationGuid } } },
    { name: 'uteamup_iot_physical_identities_list', args: { sourceGuid, generationGuid, page: 2, pageSize: 10 } },
    { name: 'uteamup_iot_physical_identities_list', args: { sourceGuid, generationGuid, page: 1, pageSize: 1,
      identityNamespace: 'provider.hardware', stableHardwareId: 'Case Sensitive & /?' } },
    { name: 'uteamup_iot_physical_identity_review', args: { sourceGuid, model: review } },
    { name: 'uteamup_iot_physical_identity_end', args: { sourceGuid, identityGuid: revision, model: { operationId,
      expectedSourceRevision: revision, expectedIdentityRevision: revision, expectedUnitSequence: 0,
      effectiveAt: '2026-11-02T11:00:00Z', reason: 'Reviewed retirement', blockIdentity: true } } },
  ];
  const call = (name, args, reply) => callMcpTool(BASE_URL, TOKEN, name, args, reply, args);

  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test.each(tools)('$name forwards original public identities without authority fields', async ({ name, args }) => {
    const original = structuredClone(args);
    expect((await call(name, args, successReply({ accepted: true }))).status).toBe(200);
    expect(args).toEqual(original);
    expect(nock.isDone()).toBe(true);
    for (const field of ['tenantGuid', 'tenantId', 'userId', 'actorId', 'apiKeyId', 'sourceSecret'])
      expect(args).not.toHaveProperty(field);
  });

  test('keeps the exact alias, zero unit sequence and channel semantics on uncertain retries', async () => {
    const args = { sourceGuid, model: review };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call('uteamup_iot_physical_identity_review', args, successReply({ identityGuid: revision, bindings: [] }));
      expect(JSON.parse(response.body.result.content[0].text).identityGuid).toBe(revision);
    }
    expect(args.model.operationId).toBe(operationId);
    expect(args.model.expectedUnitSequence).toBe(0);
    expect(args.model.identity.stableHardwareId).toBe('Thread-Device-CaseSensitive');
    expect(args.model.channels[0]).toMatchObject({ quality: 'measured', expectsTelemetry: true });
  });

  test('retains nested binding/channel history and an explicit empty page', async () => {
    const page = { items: [{ identityGuid: revision, identity: review.identity, bindings: [{ unitGuid,
      effectiveFrom: review.effectiveFrom, effectiveTo: '2026-11-02T11:00:00Z', channels: review.channels }] }], page: 1, pageSize: 50, totalItems: 1 };
    for (const expected of [page, { ...page, items: [], totalItems: 0 }]) {
      const response = await call('uteamup_iot_physical_identities_list', { sourceGuid, generationGuid }, successReply(expected));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    }
  });

  test.each(tools)('$name preserves denied, retired-generation and stale-review errors', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32602, 'Current source authority or reviewed revision changed'));
    expect(response.body.error).toMatchObject({ code: -32602, message: 'Current source authority or reviewed revision changed' });
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
