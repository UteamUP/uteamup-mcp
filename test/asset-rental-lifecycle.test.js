'use strict';
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const BASE_URL = 'https://api.test.com';
const TOKEN = 'rental-lifecycle-test';
const guid = '11111111-1111-4111-8111-111111111111';
const model = { requestGuid: guid, customerGuid: guid, rentalStartDate: '2030-01-01T10:00:00Z', expectedEndDate: '2030-01-03T10:00:00Z', rateType: 'Daily' };
const evidence = { expectedUpdatedAtUtc: '2026-09-07T10:00:00.123456Z', inspectionGuid: guid, observedAtUtc: '2026-09-07T10:00:00Z', odometerKm: 12345, photoUrls: ['https://evidence.example/condition.jpg'] };
const tools = [
 { name: 'UteamupAssetrentalStart', args: { assetGuid: guid, model } },
 { name: 'UteamupAssetrentalExtend', args: { rentalGuid: guid, model: { expectedUpdatedAtUtc: evidence.expectedUpdatedAtUtc, expectedEndDate: model.expectedEndDate, reason: 'Customer extension' } } },
 { name: 'UteamupAssetrentalCancel', args: { rentalGuid: guid, model: { expectedUpdatedAtUtc: evidence.expectedUpdatedAtUtc, reason: 'Customer cancellation' } } },
 { name: 'UteamupAssetrentalCheckout', args: { rentalGuid: guid, model: evidence } },
 { name: 'UteamupAssetrentalEnd', args: { rentalGuid: guid, model: { ...evidence, requiresCleaning: true } } },
 { name: 'UteamupAssetrentalReady', args: { assetGuid: guid, model: evidence } },
 { name: 'UteamupAssetreadinessCreateHold', args: { assetGuid: guid, model: { requestGuid: guid, holdType: 'Cleaning', reason: 'Return cleaning' } } },
 { name: 'UteamupAssetreadinessReleaseHold', args: { holdGuid: guid, model: { expectedUpdatedAtUtc: evidence.expectedUpdatedAtUtc, releaseNotes: 'Cleaning completed' } } },
];
describe('GUID rental lifecycle MCP transport', () => {
 beforeEach(() => nock.cleanAll()); afterEach(() => nock.cleanAll());
 const call = (name, args, reply) => callMcpTool(BASE_URL, TOKEN, name, args, reply);
 test.each(tools)('$name preserves structured public evidence', async ({ name, args }) => {
  const reply = await callMcpTool(BASE_URL, TOKEN, name, args, successReply({ externalGuid: guid }), args);
  expect(JSON.parse(reply.body.result.content[0].text).externalGuid).toBe(guid);
 });
 describeJsonRpcCompliance(call, tools);
 describe401Unauthorized(BASE_URL, tools);
 describe503ServiceUnavailable(BASE_URL, tools);
});
