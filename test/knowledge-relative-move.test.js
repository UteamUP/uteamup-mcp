'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const base = 'https://api.test.com';
const name = 'UteamupKnowledgeArticleMoveRelative';
const args = { articleGuid: '11111111-1111-4111-8111-111111111111',
  targetArticleGuid: '22222222-2222-4222-8222-222222222222', placeAfter: false, confirm: true };
const call = (tool, values, reply) => callMcpTool(base, 'test-token', tool, values, reply, values);

describe('Knowledge relative move transport', () => {
  afterEach(() => nock.cleanAll());
  test('forwards GUID placement and explicit confirmation without actor arguments', async () => {
    const response = await call(name, args, successReply({ externalGuid: args.articleGuid, sortOrder: 0 }));
    expect(JSON.parse(response.body.result.content[0].text).externalGuid).toBe(args.articleGuid);
    expect(Object.keys(args)).toEqual(['articleGuid', 'targetArticleGuid', 'placeAfter', 'confirm']);
  });
  test('preserves a rejected mutation as an error', async () => {
    const response = await call(name, args, errorReply(-32602, 'Confirmation required'));
    expect(response.body.error).toBeDefined();
    expect(response.body.result).toBeUndefined();
  });
  test('does not invent an article for an empty response', async () => {
    const response = await call(name, args, successReply(null));
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });
  describeJsonRpcCompliance(call, [{ name, args }]);
  describe401Unauthorized(base, [{ name, args }]);
  describe503ServiceUnavailable(base, [{ name, args }]);
});
