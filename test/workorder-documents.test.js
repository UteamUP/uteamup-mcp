'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Work order document link MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'workorder-documents-token';
  const workorderGuid = '3f2a7c52-9e8c-4a0c-8d71-8f5aa4b6f112';
  const documentGuid = '11111111-1111-4111-8111-111111111111';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('attaches documents by GUID and forwards the arguments verbatim', async () => {
    const args = { workorderGuid, documentGuids: [documentGuid] };
    const response = await call(
      'UteamupWorkorderAddDocuments', args, successReply({ workorderGuid, changed: 1 }), args,
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual({ workorderGuid, changed: 1 });
    expect(result).not.toHaveProperty('workorderId');
  });

  test('removes one document link by GUID', async () => {
    const args = { workorderGuid, documentGuid };
    const response = await call(
      'UteamupWorkorderRemoveDocument', args, successReply({ workorderGuid, changed: 1 }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).changed).toBe(1);
  });

  test('takes no tenant or user arguments', async () => {
    const args = { workorderGuid, documentGuids: [documentGuid] };
    await call('UteamupWorkorderAddDocuments', args, successReply({ workorderGuid, changed: 1 }), args);

    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('userId');
  });

  test('preserves backend errors for documents outside the tenant', async () => {
    const response = await call(
      'UteamupWorkorderAddDocuments',
      { workorderGuid, documentGuids: [documentGuid] },
      errorReply(-32602, 'None of the documents exist in this tenant, or they are archived.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('this tenant');
  });

  const tools = [
    { name: 'UteamupWorkorderAddDocuments', args: { workorderGuid, documentGuids: [documentGuid] } },
    { name: 'UteamupWorkorderRemoveDocument', args: { workorderGuid, documentGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
