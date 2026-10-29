'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Asset activity comment paging and creation', () => {
  const base = 'https://api.uteamup.com';
  const assetGuid = '11111111-1111-4111-8111-111111111111';
  const activityLogGuid = '22222222-2222-4222-8222-222222222222';
  const comment = { guid: '33333333-3333-4333-8333-333333333333', assetGuid, activityLogGuid, text: 'Inspection explains this change' };
  const cases = [
    { name: 'UteamupCommentListByAssetPaginated', args: { assetGuid, activityLogGuid, page: 2, pageSize: 20 }, result: { items: [comment], pageNumber: 2, pageSize: 20, totalCount: 21, totalPages: 2 } },
    { name: 'UteamupCommentCreate', args: { model: { assetGuid, activityLogGuid, text: comment.text } }, result: comment },
  ];
  const call = (name, args, reply) => callMcpTool(base, 'test-asset-comment-token', name, args, reply, args);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());
  for (const entry of cases) {
    test(`${entry.name} preserves activity GUIDs and bounded page metadata`, async () => {
      const response = await call(entry.name, entry.args, successReply(entry.result));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(entry.result);
      expect(nock.isDone()).toBe(true);
    });
    test(`${entry.name} preserves scope refusal`, async () => {
      const response = await call(entry.name, entry.args, errorReply(-32602, 'Activity entry not found on this asset'));
      expect(response.body.error.message).toBe('Activity entry not found on this asset');
    });
  }
  test('an empty asset thread stays empty', async () => {
    const empty = { items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0 };
    const response = await call(cases[0].name, { assetGuid }, successReply(empty));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });
  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(base, cases);
  describe503ServiceUnavailable(base, cases);
});
