'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Reviewed serialized component tools', () => {
  const BASE_URL = 'https://api.uteamup.com';
  const TOKEN = 'isolated-component-test-token';
  const unitGuid = '11111111-1111-4111-8111-111111111111';
  const assetGuid = '22222222-2222-4222-8222-222222222222';
  const operationId = '33333333-3333-4333-8333-333333333333';
  const positionGuid = '44444444-4444-4444-8444-444444444444';
  const revision = '55555555-5555-4555-8555-555555555555';
  const effectiveAt = '2026-11-02T10:00:00Z';
  const operation = { operationId, kind: 'Install', expectedUnitSequence: 0, effectiveAt,
    positionGuid, expectedPositionRevision: revision, reason: 'Reviewed physical installation' };
  const tools = [
    { name: 'uteamup_stock_list_component_positions', args: { assetGuid } },
    { name: 'uteamup_stock_create_component_position', args: { assetGuid, model: { operationId, positionKey: 'bulb-1', name: 'Bulb1' } } },
    { name: 'uteamup_stock_apply_component_operation', args: { unitGuid, model: operation } },
    { name: 'uteamup_stock_get_unit_lifecycle_facts', args: { unitGuid, page: 2, pageSize: 10 } },
    { name: 'uteamup_stock_get_unit_installation_at', args: { unitGuid, observedAt: effectiveAt } },
  ];
  const call = (name, args, reply) => callMcpTool(BASE_URL, TOKEN, name, args, reply, args);

  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test.each(tools)('$name forwards only public identities and exact reviewed terms', async ({ name, args }) => {
    const original = structuredClone(args);
    const response = await call(name, args, successReply({ accepted: true }));
    expect(response.status).toBe(200);
    expect(args).toEqual(original);
    expect(nock.isDone()).toBe(true);
    for (const field of ['tenantId', 'tenantGuid', 'userId', 'apiKeyId', 'unitId', 'assetId'])
      expect(args).not.toHaveProperty(field);
  });

  test('keeps original operation identity, zero sequence and both units on retries', async () => {
    const replacementUnitGuid = '66666666-6666-4666-8666-666666666666';
    const args = { unitGuid, model: { ...operation, kind: 'Replace', replacementUnitGuid,
      expectedReplacementUnitSequence: 0, removedDisposition: 'Scrapped' } };
    const receipt = { operationId, effectiveAt, unit: { guid: unitGuid, status: 'Scrapped', unitSequence: 2 },
      replacementUnit: { guid: replacementUnitGuid, status: 'Installed', unitSequence: 1 } };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call('uteamup_stock_apply_component_operation', args, successReply(receipt));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
    }
    expect(args.model.operationId).toBe(operationId);
    expect(args.model.expectedUnitSequence).toBe(0);
    expect(args.model.expectedReplacementUnitSequence).toBe(0);
  });

  test('retains empty pages and distinguishes unknown history from known removal', async () => {
    const page = { items: [], totalItems: 0, page: 1, pageSize: 50 };
    const response = await call('uteamup_stock_get_unit_lifecycle_facts', { unitGuid }, successReply(page));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(page);
    for (const state of ['UnknownBeforeRecordedHistory', 'KnownUninstalled', 'Ambiguous']) {
      const result = await call('uteamup_stock_get_unit_installation_at', { unitGuid, observedAt: effectiveAt }, successReply({ state }));
      expect(JSON.parse(result.body.result.content[0].text)).toEqual({ state });
    }
  });

  test.each(tools)('$name preserves denied/stale-state error envelopes', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32602, 'Current authority or reviewed revision changed'));
    expect(response.body.error).toMatchObject({ code: -32602, message: 'Current authority or reviewed revision changed' });
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
