/**
 * Production AI-tier assist MCP tool tests.
 *
 * Backend tools are registered on the API; this proxy test verifies JSON-RPC
 * forwarding and the expected credit/quota result shapes.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('AI tier assist MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_tier_assist';
  const ASSET_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ATTRIBUTE_GUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const PERMIT_GUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const WORKORDER_GUID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const PHOTO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  it('returns a review-only meter OCR suggestion with credit receipt fields', async () => {
    const response = await call(
      'UteamupMeterreadingOcr',
      { assetGuid: ASSET_GUID, attributeDefinitionGuid: ATTRIBUTE_GUID, photoBase64: PHOTO_BASE64 },
      successReply({
        assetGuid: ASSET_GUID,
        attributeDefinitionGuid: ATTRIBUTE_GUID,
        readingValue: 1234.5,
        confidence: 0.91,
        visibleText: '1234.5 kWh',
        creditsCharged: 2,
        remaining: 98,
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.readingValue).toBe(1234.5);
    expect(data.confidence).toBeCloseTo(0.91);
    expect(data.creditsCharged).toBe(2);
    expect(data.remaining).toBe(98);
  });

  it('returns a cached daily brief repeat without a new charge', async () => {
    const response = await call(
      'UteamupWorkorderDailyBrief',
      { date: '2026-07-08T00:00:00Z', regenerate: false },
      successReply({
        date: '2026-07-08T00:00:00Z',
        cached: true,
        summaryBullets: ['Start with overdue safety work.'],
        workorders: [{ workorderGuid: WORKORDER_GUID, ticketId: 'PRE-1', name: 'Inspect pump', priority: 1, reason: 'Overdue' }],
        creditsCharged: 0,
        remaining: 100,
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.cached).toBe(true);
    expect(data.creditsCharged).toBe(0);
    expect(data.workorders[0].workorderGuid).toBe(WORKORDER_GUID);
  });

  it('returns permit prefill suggestions as review rows only', async () => {
    const response = await call(
      'UteamupPermitAiPrefill',
      { workPermitGuid: PERMIT_GUID, workorderGuid: WORKORDER_GUID, context: 'Hot work near pump skid' },
      successReply({
        workPermitGuid: PERMIT_GUID,
        hazards: [{ hazardDescription: 'Ignition source near process area', controlMeasure: 'Gas test and fire watch' }],
        ppe: ['Flame-resistant clothing'],
        isolationSteps: ['Verify area is gas-free'],
        rescuePlanNotes: ['Keep extinguisher and attendant nearby'],
        sourceReferences: ['Work order PRE-1'],
        creditsCharged: 3,
        remaining: 97,
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.hazards).toHaveLength(1);
    expect(data.ppe[0]).toMatch(/flame/i);
    expect(data.creditsCharged).toBe(3);
  });

  it('forwards GUID arguments only for meter OCR', async () => {
    const args = { assetGuid: ASSET_GUID, attributeDefinitionGuid: ATTRIBUTE_GUID, photoBase64: PHOTO_BASE64 };
    const captured = await captureCall('UteamupMeterreadingOcr', args);
    expect(captured.params.arguments).toEqual(args);
    expect(captured.params.arguments.assetId).toBeUndefined();
    expect(captured.params.arguments.attributeDefinitionId).toBeUndefined();
  });

  it('surfaces quota exhaustion on the 200 body', async () => {
    const response = await call(
      'UteamupWorkorderDailyBrief',
      { regenerate: true },
      successReply({ quotaBlockedReason: 'AI quota exhausted for this tenant.', creditsCharged: 0, remaining: 0 }),
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.quotaBlockedReason).toMatch(/quota/i);
    expect(data.remaining).toBe(0);
  });

  it('surfaces permission denied as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupMeterreadingOcr',
      { assetGuid: ASSET_GUID, attributeDefinitionGuid: ATTRIBUTE_GUID, photoBase64: PHOTO_BASE64 },
      errorReply(-32000, 'Permission denied: MeterReading.Create required'),
    );
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  const allTools = [
    { name: 'UteamupMeterreadingOcr', args: { assetGuid: ASSET_GUID, attributeDefinitionGuid: ATTRIBUTE_GUID, photoBase64: PHOTO_BASE64 } },
    { name: 'UteamupWorkorderDailyBrief', args: { regenerate: false } },
    { name: 'UteamupPermitAiPrefill', args: { workPermitGuid: PERMIT_GUID, workorderGuid: WORKORDER_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
