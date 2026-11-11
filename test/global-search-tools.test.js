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
});
