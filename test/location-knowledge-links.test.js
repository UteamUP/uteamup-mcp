'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
describe('Reviewed Location knowledge relations', () => {
  const base = 'https://api.test.com';
  const guid = '11111111-1111-4111-8111-111111111111';
  const call = (name, args, reply) => callMcpTool(base, 'test-relation-token', name, args, reply);
  beforeEach(() => nock.cleanAll()); afterEach(() => nock.cleanAll());
  const tools = ['Link', 'Unlink'].map(action => ({name:`UteamupLocationKnowledge${action}`,
    args:{locationGuid:guid,articleGuid:guid,confirmed:true,model:{idempotencyKey:guid,mutationOutcomeVersion:1,
      expectedLinkGuid:action==='Link'?null:guid}}}));
  for (const tool of tools) {
    test(`${tool.name} retains exact relation receipt`, async () => {
      const receipt={schemaVersion:1,operationGuid:guid,locationGuid:guid,articleGuid:guid,
        action:tool.name.endsWith('Unlink')?'unlink':'link',outcome:'applied',linkGuid:guid};
      const result=await call(tool.name,tool.args,successReply(receipt));
      expect(JSON.parse(result.body.result.content[0].text)).toEqual(receipt);
    });
    test(`${tool.name} retains conflict without fallback`, async () => {
      const result=await call(tool.name,tool.args,errorReply(-32602,'Relation changed'));
      expect(result.body.error.message).toBe('Relation changed');
    });
  }
  describeJsonRpcCompliance(call,tools); describe401Unauthorized(base,tools); describe503ServiceUnavailable(base,tools);
});
