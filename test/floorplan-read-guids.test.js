'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

const base = 'https://api.uteamup.com';
const guid = '11111111-1111-4111-8111-111111111111';
const tools = [
  { name: 'UteamupFloorplanGet', args: { guid } },
  { name: 'UteamupFloorplanDownload', args: { guid } },
  { name: 'UteamupFloorplanGetByLocation', args: { locationGuid: guid } },
  { name: 'UteamupFloorplanGetByLocationFloor', args: { locationFloorGuid: guid } },
];

describe('Floorplan reads use public GUIDs', () => {
  beforeAll(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test.each(tools)('$name preserves its GUID argument and result', async ({ name, args }) => {
    const result = name.endsWith('Download')
      ? { fileName: 'drawing.pdf', contentType: 'application/pdf', base64Data: 'AQID' }
      : { guid, floorplanName: 'Drawing' };
    const response = await callMcpTool(base, 'test-token', name, args, successReply(result), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    expect(nock.isDone()).toBe(true);
  });

  describeJsonRpcCompliance((name, args, reply) => callMcpTool(base, 'test-token', name, args, reply), tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
