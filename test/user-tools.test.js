/** GUID-first user MCP contract tests: list and search return userGuid, get takes it. */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('user MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_user_tools';
  const userGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const user = {
    id: '6f1c2d3e-0000-4000-8000-000000000001',
    userGuid,
    userName: 'ada@example.com',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it.each([
    ['UteamupUserList', { page: 1, pageSize: 10 }, [user]],
    ['UteamupUserSearch', { searchFilter: 'ada' }, [user]],
    ['UteamupUserGet', { userGuid }, user],
  ])('%s keeps the userGuid contract', async (toolName, args, data) => {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
      args,
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(data);
  });

  const errorTools = [
    { name: 'UteamupUserList', args: {} },
    { name: 'UteamupUserGet', args: { userGuid } },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
