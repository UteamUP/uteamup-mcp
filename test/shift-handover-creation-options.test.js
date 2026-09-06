'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Handover creation option lookup', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('preserves paging and GUID-only options through the generic proxy', async () => {
    const result = {
      items: [{ guid: '11111111-1111-4111-8111-111111111111', name: 'Alex Worker' }],
      totalItems: 26, page: 2, pageSize: 25, totalPages: 2, hasNext: false, hasPrevious: true,
    };
    const response = await callMcpTool('https://api.test.com', 'handover_options_token',
      'UteamupShiftHandoverGetCreateOptions', { kind: 1, search: 'Alex', page: 2, pageSize: 25 }, successReply(result));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });
});
