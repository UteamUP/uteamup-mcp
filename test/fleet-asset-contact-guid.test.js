'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('FleetAssetContact GUID-first MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'fleet-contact-guid-token';
  const assetExternalGuid = '11111111-1111-1111-1111-111111111111';
  const associationExternalGuid = '22222222-2222-2222-2222-222222222222';
  const contactExternalGuid = '33333333-3333-3333-3333-333333333333';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips GUID-only list arguments and response identity', async () => {
    const response = await call(
      'UteamupFleetAssetContactList',
      { assetExternalGuid },
      successReply([{
        externalGuid: associationExternalGuid,
        assetExternalGuid,
        contactExternalGuid,
        contactRole: 2,
      }]),
    );

    const [contact] = JSON.parse(response.body.result.content[0].text);
    expect(contact.externalGuid).toBe(associationExternalGuid);
    expect(contact.assetExternalGuid).toBe(assetExternalGuid);
    expect(contact.contactExternalGuid).toBe(contactExternalGuid);
    expect(contact).not.toHaveProperty('id');
    expect(contact).not.toHaveProperty('assetId');
    expect(contact).not.toHaveProperty('contactId');
  });

  test('round-trips GUID-only add arguments', async () => {
    const model = { contactExternalGuid, contactRole: 2 };
    const response = await call(
      'UteamupFleetAssetContactAdd',
      { assetExternalGuid, model },
      successReply({ externalGuid: associationExternalGuid, assetExternalGuid, ...model }),
    );

    const contact = JSON.parse(response.body.result.content[0].text);
    expect(contact.contactExternalGuid).toBe(contactExternalGuid);
    expect(model).not.toHaveProperty('contactId');
  });

  test('preserves duplicate-link validation errors', async () => {
    const response = await call(
      'UteamupFleetAssetContactAdd',
      { assetExternalGuid, model: { contactExternalGuid, contactRole: 2 } },
      errorReply(-32602, 'Contact is already linked to the asset with the selected role'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('already linked');
  });

  const tools = [
    { name: 'UteamupFleetAssetContactList', args: { assetExternalGuid } },
    {
      name: 'UteamupFleetAssetContactAdd',
      args: { assetExternalGuid, model: { contactExternalGuid, contactRole: 2 } },
    },
    {
      name: 'UteamupFleetAssetContactDelete',
      args: { assetExternalGuid, associationExternalGuid },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
