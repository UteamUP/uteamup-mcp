'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Contact type GUID-first MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'contact-type-token';
  const TYPE_GUID = '11111111-2222-4333-8444-555555555555';
  const model = {
    name: 'Legal team priority',
    color: '#A33B20',
    severity: 'warning',
  };
  const responseModel = {
    guid: TYPE_GUID,
    ...model,
    createdAt: '2026-09-21T09:00:00Z',
    updatedAt: '2026-09-21T09:00:00Z',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      mockReply,
      expectedArgs,
    );

  test('lists reusable contact types and keeps integer identifiers private', async () => {
    const response = await call(
      'UteamupContacttypeList',
      {},
      successReply([responseModel]),
    );

    const [contactType] = JSON.parse(response.body.result.content[0].text);
    expect(contactType.guid).toBe(TYPE_GUID);
    expect(contactType).not.toHaveProperty('id');
    expect(contactType).not.toHaveProperty('tenantId');
  });

  test('passes through an empty contact-type list', async () => {
    const response = await call('UteamupContacttypeList', {}, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('reads one contact type by public GUID', async () => {
    const args = { contactTypeGuid: TYPE_GUID };
    const response = await call(
      'UteamupContacttypeGet',
      args,
      successReply(responseModel),
      args,
    );
    expect(JSON.parse(response.body.result.content[0].text).guid).toBe(TYPE_GUID);
  });

  test('creates a contact type with color and severity', async () => {
    const response = await call(
      'UteamupContacttypeCreate',
      { model },
      successReply(responseModel),
      { model },
    );
    expect(JSON.parse(response.body.result.content[0].text).severity).toBe('warning');
  });

  test('updates a contact type by public GUID', async () => {
    const args = { contactTypeGuid: TYPE_GUID, model: { ...model, severity: 'critical' } };
    const response = await call(
      'UteamupContacttypeUpdate',
      args,
      successReply({ ...responseModel, severity: 'critical' }),
      args,
    );
    expect(JSON.parse(response.body.result.content[0].text).severity).toBe('critical');
  });

  test('deletes a contact type by public GUID', async () => {
    const response = await call(
      'UteamupContacttypeDelete',
      { contactTypeGuid: TYPE_GUID },
      successReply(true),
    );
    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
  });

  test('preserves duplicate-name validation errors', async () => {
    const response = await call(
      'UteamupContacttypeCreate',
      { model },
      errorReply(409, "Contact type 'Legal team priority' already exists for this tenant."),
    );
    expect(response.body.error.message).toContain('already exists');
  });

  const tools = [
    { name: 'UteamupContacttypeList', args: {} },
    { name: 'UteamupContacttypeGet', args: { contactTypeGuid: TYPE_GUID } },
    { name: 'UteamupContacttypeCreate', args: { model } },
    { name: 'UteamupContacttypeUpdate', args: { contactTypeGuid: TYPE_GUID, model } },
    { name: 'UteamupContacttypeDelete', args: { contactTypeGuid: TYPE_GUID } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
