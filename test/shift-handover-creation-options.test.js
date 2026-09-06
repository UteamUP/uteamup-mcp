'use strict';

const nock = require('nock');
const { callMcpTool, sendRawRequest, successReply } = require('./helpers/mcp-test-helpers');

describe('Handover creation option lookup', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards a public operator filter and preserves actor GUIDs in search results', async () => {
    const operatorGuid = '11111111-1111-4111-8111-111111111111';
    const args = { searchModel: { operatorGuid, page: 1, pageSize: 25 } };
    const result = { items: [{ guid: '22222222-2222-4222-8222-222222222222',
      outgoingOperatorGuid: operatorGuid, outgoingOperatorName: 'Recorded Alex' }], totalCount: 1, page: 1, pageSize: 25 };
    let captured;
    nock('https://api.test.com').post('/mcp', body => {
      captured = body.params.arguments;
      return body.params.name === 'UteamupShiftHandoverSearch';
    }).reply(200, JSON.stringify(successReply(result).body), { 'Content-Type': 'application/json' });
    const response = await sendRawRequest('https://api.test.com', 'UteamupShiftHandoverSearch', args);
    expect(captured).toEqual(args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });

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
