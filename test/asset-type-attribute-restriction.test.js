'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// Restricting a personal-data step (Recorded by, Location, Signature, Photo, Audio, Video) to roles
// through UteamupAssetTypeAddAttribute / UteamupAssetTypeUpdateAttribute.
describe('Asset type attribute restriction MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-type-restriction-token';
  const assetTypeGuid = '6b1f9a52-7c3e-4d7a-9a51-1f0e2d3c4b5a';
  const attributeGuid = '9c8b7a65-4d3e-4f2a-8b1c-0d9e8f7a6b5c';
  const managerRole = '2f4e6d8c-1a3b-4c5d-9e7f-8a6b4c2d0e1f';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('add forwards the restriction and roles verbatim', async () => {
    const args = {
      assetTypeGuid,
      model: {
        name: 'Recorded by',
        fieldKey: 'recorded_by',
        dataType: 'recordedBy',
        isRestricted: true,
        restrictedViewerRoleGuids: [managerRole],
      },
    };
    const response = await call('UteamupAssetTypeAddAttribute', args,
      successReply({ externalGuid: attributeGuid, isRestricted: true, restrictedViewerRoleGuids: [managerRole] }),
      args);

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.isRestricted).toBe(true);
    expect(result.restrictedViewerRoleGuids).toEqual([managerRole]);
  });

  test('update forwards a lifted restriction verbatim', async () => {
    const args = { attributeGuid, model: { isRestricted: false } };
    const response = await call('UteamupAssetTypeUpdateAttribute', args,
      successReply({ externalGuid: attributeGuid, isRestricted: false, restrictedViewerRoleGuids: [] }),
      args);

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.restrictedViewerRoleGuids).toEqual([]);
  });

  test('a caller without Privacy.Manage gets the refusal unchanged', async () => {
    const response = await call('UteamupAssetTypeUpdateAttribute',
      { attributeGuid, model: { isRestricted: false } },
      errorReply(-32603, 'Changing who can see personal reading data requires Privacy.Manage.'));

    expect(response.body.error.message).toContain('Privacy.Manage');
  });

  test('restricting a non-personal step is refused unchanged', async () => {
    const response = await call('UteamupAssetTypeUpdateAttribute',
      { attributeGuid, model: { isRestricted: true } },
      errorReply(-32603, 'Only Recorded by, Location, Signature, Photo, Audio and Video steps can be restricted.'));

    expect(response.body.error.message).toContain('can be restricted');
  });

  const tools = [
    { name: 'UteamupAssetTypeAddAttribute', args: { assetTypeGuid, model: { name: 'Location', fieldKey: 'location', dataType: 'location', isRestricted: true } } },
    { name: 'UteamupAssetTypeUpdateAttribute', args: { attributeGuid, model: { isRestricted: true, restrictedViewerRoleGuids: [managerRole] } } },
  ];
  describeJsonRpcCompliance((toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply), tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
