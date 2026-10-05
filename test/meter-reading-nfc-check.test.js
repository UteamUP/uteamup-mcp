/**
 * UteamupMeterreadingRecord with an NFC tag check attribute.
 *
 * The phone sends the value read from the asset's NFC tag as request.scannedNfcValue; the backend
 * records 1 (Yes) only when it is a tag registered to that asset, otherwise 0 (No) — and 0 with a
 * note when the asset has no NFC tag. The proxy must forward the scanned value untouched.
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, GUIDs only.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Meter reading NFC tag check via UteamupMeterreadingRecord', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_meter_nfc';
  const TOOL = 'UteamupMeterreadingRecord';
  const ASSET_GUID = 'e5555555-5555-4555-8555-555555555555';
  const ATTRIBUTE_GUID = 'f6666666-6666-4666-8666-666666666666';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const args = scannedNfcValue => ({
    assetGuid: ASSET_GUID,
    request: { attributeDefinitionGuid: ATTRIBUTE_GUID, readingValue: 0, scannedNfcValue },
  });

  it('forwards the scanned tag value verbatim', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === TOOL;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });

    await sendRawRequest(BASE_URL, TOOL, args('04:A2:19:7C'));

    expect(captured.params.arguments.request.scannedNfcValue).toBe('04:A2:19:7C');
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
  });

  it('returns Yes (1) when the server matched the asset tag', async () => {
    const response = await call(TOOL, args('04:A2:19:7C'), successReply({ readingValue: 1, notes: null }));
    expect(JSON.parse(response.body.result.content[0].text).readingValue).toBe(1);
  });

  it('returns No (0) with the note when the asset has no NFC tag', async () => {
    const response = await call(
      TOOL,
      args('04:A2:19:7C'),
      successReply({ readingValue: 0, notes: 'NFC check: this asset has no NFC tag registered.' }),
    );
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.readingValue).toBe(0);
    expect(result.notes).toContain('no NFC tag registered');
  });

  const allTools = [{ name: TOOL, args: args('04:A2:19:7C') }];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
