'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
describe('Fleet transport MCP contracts', () => {
  const guid = '11111111-1111-4111-8111-111111111111';
  const call = (name, args, response) => callMcpTool('https://api.test.com', 'transport-token', name, args, response);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test('preserves tenant-public references and optimistic version on service transitions', async () => {
    const model = { expectedUpdatedAtUtc: '2026-09-07T12:00:00Z', status: 'completed', finalFare: 14000, fareBasis: 'Airport transfer, agreed fixed price' };
    const response = await call('UteamupFleetTransportTransition', { assignmentGuid: guid, model }, successReply({ guid, status: 'completed', finalFare: 14000, fareCurrency: 'ISK' }));
    const service = JSON.parse(response.body.result.content[0].text);
    expect(service.guid).toBe(guid);
    expect(service.finalFare).toBe(14000);
    expect(service).not.toHaveProperty('assignedUserId');
  });
  test('preserves blocking qualification and fleet conflicts instead of reporting a dispatched service', async () => {
    const response = await call('UteamupFleetTransportTransition', { assignmentGuid: guid, model: { status: 'dispatched', expectedUpdatedAtUtc: '2026-09-07T12:00:00Z' } }, errorReply(-32603, 'Driver certification expires before service end'));
    expect(response.body.error.message).toContain('certification');
    expect(response.body.result).toBeUndefined();
  });
  test('preserves explicit null capacity and the passenger accessibility request', async () => {
    const response = await call('UteamupFleetTransportGet', { assignmentGuid: guid }, successReply({ guid, passengerCapacity: null, wheelchairCapacity: null, passengers: [{ passengerName: 'Passenger', wheelchairRequired: true, boarded: false }] }));
    const service = JSON.parse(response.body.result.content[0].text);
    expect(service.wheelchairCapacity).toBeNull();
    expect(service.passengers[0].wheelchairRequired).toBe(true);
  });
});
