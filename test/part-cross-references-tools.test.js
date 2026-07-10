/**
 * Part cross-references MCP tools test (stock-reseller-catalog section 2).
 *
 * Three tools over a part's cross-references (the OEM/alternate/supersession/competitor
 * numbers it is known under): UteamupPartListCrossReferences, UteamupPartAddCrossReference,
 * UteamupPartDeleteCrossReference.
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, no real network. Identifiers are
 * GUIDs only — the proxy must forward them verbatim and never inject a userId/tenantId.
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

describe('Part cross-references MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_part_crossref';

  const PART_GUID = 'a1111111-1111-1111-1111-111111111111';
  const REF_GUID = 'b2222222-2222-2222-2222-222222222222';
  const RELATED_PART_GUID = 'c3333333-3333-3333-3333-333333333333';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  describe('UteamupPartListCrossReferences', () => {
    it('returns the cross-reference rows', async () => {
      const response = await call(
        'UteamupPartListCrossReferences',
        { partGuid: PART_GUID },
        successReply([
          { guid: REF_GUID, partGuid: PART_GUID, referenceType: 'Competitor', referenceNumber: 'COMP-42', manufacturer: 'Acme' },
        ]),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].referenceNumber).toBe('COMP-42');
      expect(data[0].referenceType).toBe('Competitor');
    });

    it('surfaces an empty list', async () => {
      const response = await call('UteamupPartListCrossReferences', { partGuid: PART_GUID }, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    it('forwards the part GUID verbatim (GUIDs only)', async () => {
      const captured = await captureCall('UteamupPartListCrossReferences', { partGuid: PART_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID });
    });
  });

  describe('UteamupPartAddCrossReference', () => {
    it('forwards the reference fields verbatim', async () => {
      const args = {
        partGuid: PART_GUID,
        referenceType: 'SupersededBy',
        referenceNumber: 'NEW-99',
        manufacturer: 'Bosch',
        relatedPartGuid: RELATED_PART_GUID,
        notes: 'replaces the old SKU',
      };
      const captured = await captureCall('UteamupPartAddCrossReference', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('returns the created cross-reference', async () => {
      const response = await call(
        'UteamupPartAddCrossReference',
        { partGuid: PART_GUID, referenceType: 'OEM', referenceNumber: 'OEM-1' },
        successReply({ guid: REF_GUID, partGuid: PART_GUID, referenceType: 'OEM', referenceNumber: 'OEM-1' }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(REF_GUID);
    });

    it('surfaces a duplicate conflict error without crashing the proxy', async () => {
      const response = await call(
        'UteamupPartAddCrossReference',
        { partGuid: PART_GUID, referenceType: 'OEM', referenceNumber: 'DUP' },
        {
          status: 200,
          body: { jsonrpc: '2.0', error: { code: -32000, message: 'A cross-reference with that type and number already exists' }, id: 1 },
        },
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });
  });

  describe('UteamupPartDeleteCrossReference', () => {
    it('returns true on delete', async () => {
      const response = await call(
        'UteamupPartDeleteCrossReference',
        { partGuid: PART_GUID, referenceGuid: REF_GUID },
        successReply(true),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });

    it('forwards both GUIDs verbatim', async () => {
      const captured = await captureCall('UteamupPartDeleteCrossReference', { partGuid: PART_GUID, referenceGuid: REF_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID, referenceGuid: REF_GUID });
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupPartListCrossReferences', { partGuid: PART_GUID }],
      ['UteamupPartAddCrossReference', { partGuid: PART_GUID, referenceType: 'OEM', referenceNumber: 'X' }],
      ['UteamupPartDeleteCrossReference', { partGuid: PART_GUID, referenceGuid: REF_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupPartListCrossReferences', args: { partGuid: PART_GUID } },
    { name: 'UteamupPartAddCrossReference', args: { partGuid: PART_GUID, referenceType: 'OEM', referenceNumber: 'X' } },
    { name: 'UteamupPartDeleteCrossReference', args: { partGuid: PART_GUID, referenceGuid: REF_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
