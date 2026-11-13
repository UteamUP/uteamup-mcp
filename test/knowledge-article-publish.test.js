'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const base = 'https://api.test.com';
const articleGuid = '11111111-1111-4111-8111-111111111111';
const tools = [
  { name: 'UteamupKnowledgeArticlePublish', args: { articleGuid }, status: 2 },
  { name: 'UteamupKnowledgeArticleSubmitReview', args: { articleGuid }, status: 1 },
];
const call = (tool, values, reply) => callMcpTool(base, 'test-token', tool, values, reply, values);

describe('Knowledge article publish and submit-review transport', () => {
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name forwards only the article GUID and returns the new status', async ({ name, args, status }) => {
    const response = await call(name, args, successReply({ externalGuid: articleGuid, status }));
    const article = JSON.parse(response.body.result.content[0].text);
    expect(article.externalGuid).toBe(articleGuid);
    expect(article.status).toBe(status);
    expect(Object.keys(args)).toEqual(['articleGuid']);
  });

  test.each(tools)('$name preserves a missing KnowledgeArticle.Publish refusal as an error', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32603, 'KnowledgeArticle.Publish is required.'));
    expect(response.body.error).toBeDefined();
    expect(response.body.result).toBeUndefined();
  });

  test.each(tools)('$name preserves an article outside the tenant as an error', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32603, 'The knowledge article is unavailable.'));
    expect(response.body.error.message).toContain('unavailable');
  });

  test('publish of an archived article surfaces the status error', async () => {
    const response = await call(tools[0].name, tools[0].args,
      errorReply(-32603, "Cannot publish an article with status 'Archived'."));
    expect(response.body.error.message).toContain('Archived');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
