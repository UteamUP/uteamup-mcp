'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Asset type measurement presentation', () => {
  const baseUrl = 'https://api.test.com';
  const assetTypeGuid = '10000000-0000-4000-8000-000000000001';
  const attributeGuid = '10000000-0000-4000-8000-000000000002';
  const call = (name, args, reply) => callMcpTool(baseUrl, 'test-display-token', name, args, reply, args);
  const args = { assetTypeGuid, name: 'Tank', unit: 'L', decimalPlaces: 0, roundingMode: 'floor', chartType: 'bar', monitoringVisibility: 'hidden' };
  const tools = [{ name: 'UteamupAssetTypeMeterAddDefinition', args },
    { name: 'UteamupAssetTypeUpdateAttribute', args: { attributeGuid, model: { displaySettings: { decimalPlaces: 2, roundingMode: 'ceil', chartType: 'pie', monitoringVisibility: 'auto' } } } }];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards new settings with GUID identifiers and preserves the response', async () => {
    const expected = { externalGuid: attributeGuid, displaySettings: { decimalPlaces: 0, roundingMode: 'floor', chartType: 'bar', monitoringVisibility: 'hidden' } };
    const response = await call(tools[0].name, args, successReply(expected));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    expect(args).not.toHaveProperty('assetTypeId');
  });
  test('old-client updates omit new preferences', async () => {
    const legacy = { attributeGuid, model: { displaySettings: { decimalPlaces: null, roundingMode: 'round' } } };
    const response = await call(tools[1].name, legacy, successReply({ displaySettings: { ...legacy.model.displaySettings, chartType: 'bar', monitoringVisibility: 'hidden' } }));
    expect(JSON.parse(response.body.result.content[0].text).displaySettings.chartType).toBe('bar');
  });
  test('returns an empty meter list', async () => {
    const response = await call('UteamupAssetTypeMeterListDefinitions', { assetTypeGuid }, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });
  test('surfaces validation and permission errors', async () => {
    const response = await call(tools[0].name, args, errorReply(-32603, 'AssetType.Create required'));
    expect(response.body.error.message).toContain('AssetType.Create');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
