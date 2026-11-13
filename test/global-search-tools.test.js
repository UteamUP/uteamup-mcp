"use strict";
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('global search wire contract', () => {
  afterEach(() => nock.cleanAll());
  test('forwards scoped tag queries and preserves reference metadata and partial warnings', async () => {
    const args = { query: '#engine-room', maxResults: 5, entityTypes: 'asset,part' };
    const expected = { assets: [{ id: '11111111-2222-4333-8444-555555555555', name: 'Pump', reference: 'P-804', matchedTag: 'engine-room' }], parts: [], warnings: ['Search for documents is temporarily unavailable.'] };
    const response = await callMcpTool('https://api.uteamup.com', 'offline-test-token', 'uteamup_global_search', args, successReply(expected), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    expect(nock.isDone()).toBe(true);
  });

  test('forwards the change date and page and keeps the Help and UPSense groups', async () => {
    const args = { query: 'pump', maxResults: 50, entityTypes: 'iotalert', changedSince: '2026-11-01T00:00:00Z', page: 2 };
    const expected = {
      iotAlerts: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Pump vibration', changedAt: '2026-11-12T13:40:00Z' }],
      helpArticles: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Reading pump meters', reference: '/meter-readings' }],
      warnings: [],
    };
    const response = await callMcpTool('https://api.uteamup.com', 'offline-test-token', 'uteamup_global_search', args, successReply(expected), args);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(expected);
    expect(result.iotAlerts[0]).not.toHaveProperty('deviceId');
    expect(nock.isDone()).toBe(true);
  });
});
