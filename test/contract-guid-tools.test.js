'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

const CONTRACT_GUID = '11111111-1111-4111-8111-111111111111';
const USER_GUID = '22222222-2222-4222-8222-222222222222';

describe('Contract GUID MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'contract-guid-token';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('gets a contract by public GUID with its people and billing period', async () => {
    const response = await call(
      'UteamupContractGetByGuid',
      { contractGuid: CONTRACT_GUID },
      successReply({
        externalGuid: CONTRACT_GUID,
        title: 'ChatGPT Team',
        type: 'subscription',
        totalValue: 4990,
        billingFrequencyDays: 30,
        responsibleUserGuid: USER_GUID,
        users: [{ userGuid: USER_GUID, fullName: 'Anna Jónsdóttir' }],
      }),
      { contractGuid: CONTRACT_GUID },
    );

    const contract = JSON.parse(response.body.result.content[0].text);
    expect(contract.externalGuid).toBe(CONTRACT_GUID);
    expect(contract.billingFrequencyDays).toBe(30);
    expect(contract.users[0].userGuid).toBe(USER_GUID);
  });

  test('forwards the GUID and full update model unchanged', async () => {
    const model = {
      title: 'ChatGPT Team',
      type: 5,
      status: 2,
      priority: 2,
      currency: 'USD',
      totalValue: 4990,
      billingFrequencyDays: 30,
      responsibleUserGuid: USER_GUID,
      userGuids: [USER_GUID],
    };
    const response = await call(
      'UteamupContractUpdateByGuid',
      { contractGuid: CONTRACT_GUID, model },
      successReply({ externalGuid: CONTRACT_GUID, title: 'ChatGPT Team', users: [{ userGuid: USER_GUID }] }),
      { contractGuid: CONTRACT_GUID, model },
    );

    const updated = JSON.parse(response.body.result.content[0].text);
    expect(updated.users).toHaveLength(1);
  });

  test('deletes by public GUID and reports a missing contract as false', async () => {
    const response = await call(
      'UteamupContractDeleteByGuid',
      { contractGuid: CONTRACT_GUID },
      successReply(false),
      { contractGuid: CONTRACT_GUID },
    );

    expect(JSON.parse(response.body.result.content[0].text)).toBe(false);
  });

  const tools = [
    { name: 'UteamupContractGetByGuid', args: { contractGuid: CONTRACT_GUID } },
    { name: 'UteamupContractUpdateByGuid', args: { contractGuid: CONTRACT_GUID, model: { title: 'ChatGPT Team' } } },
    { name: 'UteamupContractDeleteByGuid', args: { contractGuid: CONTRACT_GUID } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
