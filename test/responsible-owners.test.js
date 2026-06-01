/**
 * Responsible Owners MCP tool tests
 *
 * Tests that the two "Responsible Owners" MCP tool calls are correctly formed
 * as JSON-RPC 2.0 requests and that the MCP proxy properly handles successful,
 * empty-set (clear), and error responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupAssetSetResponsibleOwners(assetGuid, userIds)
 *   UteamupCodecatalogSetResponsibleOwners(codeCatalogEntryGuid, userIds)
 *
 * Identity convention: the entity ids (assetGuid / codeCatalogEntryGuid) are
 * Guids, while the responsible-owner user ids are ASP.NET Identity strings
 * (GUID-strings), matching every other user reference at the boundary.
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Responsible Owners MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_responsible_owners';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const assetGuid = '11111111-1111-1111-1111-111111111111';
  const codeGuid = '22222222-2222-2222-2222-222222222222';

  // ASP.NET Identity user ids are STRINGS (GUID-shaped), not typed Guids.
  const userIdA = 'aaaaaaaa-0000-0000-0000-000000000001';
  const userIdB = 'bbbbbbbb-0000-0000-0000-000000000002';

  const ownerList = [
    {
      userId: userIdA,
      fullName: 'Alice Owner',
      email: 'alice@example.com',
      jobTitle: 'Maintenance Lead',
      avatarUrl: 'https://cdn.example.com/a.png',
      assignedAtUtc: '2026-06-01T10:00:00Z'
    },
    {
      userId: userIdB,
      fullName: 'Bob Owner',
      email: 'bob@example.com',
      jobTitle: null,
      avatarUrl: null,
      assignedAtUtc: '2026-06-01T10:00:00Z'
    }
  ];

  // ---------------------------------------------------------------------------
  // UteamupAssetSetResponsibleOwners
  // ---------------------------------------------------------------------------
  describe('UteamupAssetSetResponsibleOwners tool', () => {
    test('sets responsible owners and returns the resolved owner list', async () => {
      const response = await call(
        'UteamupAssetSetResponsibleOwners',
        { assetGuid, userIds: [userIdA, userIdB] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(ownerList) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const owners = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(owners)).toBe(true);
      expect(owners).toHaveLength(2);
      expect(owners[0].userId).toBe(userIdA);
      expect(owners[0].fullName).toBe('Alice Owner');
      expect(typeof owners[0].userId).toBe('string');
    });

    test('empty userIds clears all owners (returns empty array)', async () => {
      const response = await call(
        'UteamupAssetSetResponsibleOwners',
        { assetGuid, userIds: [] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([]) }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      const owners = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(owners)).toBe(true);
      expect(owners).toHaveLength(0);
    });

    test('returns not-found error when the asset does not resolve in the tenant', async () => {
      const response = await call(
        'UteamupAssetSetResponsibleOwners',
        { assetGuid: '99999999-9999-9999-9999-999999999999', userIds: [userIdA] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Asset 99999999-9999-9999-9999-999999999999 not found.' },
            id: 3
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when Asset.Update is missing', async () => {
      const response = await call(
        'UteamupAssetSetResponsibleOwners',
        { assetGuid, userIds: [userIdA] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: Asset.Update required' },
            id: 4
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Asset.Update');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupCodecatalogSetResponsibleOwners
  // ---------------------------------------------------------------------------
  describe('UteamupCodecatalogSetResponsibleOwners tool', () => {
    test('sets responsible owners and returns the resolved owner list', async () => {
      const response = await call(
        'UteamupCodecatalogSetResponsibleOwners',
        { codeCatalogEntryGuid: codeGuid, userIds: [userIdA] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([ownerList[0]]) }] },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const owners = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(owners)).toBe(true);
      expect(owners).toHaveLength(1);
      expect(owners[0].userId).toBe(userIdA);
      expect(owners[0].email).toBe('alice@example.com');
    });

    test('empty userIds clears all owners (returns empty array)', async () => {
      const response = await call(
        'UteamupCodecatalogSetResponsibleOwners',
        { codeCatalogEntryGuid: codeGuid, userIds: [] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([]) }] },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      const owners = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(owners)).toBe(true);
      expect(owners).toHaveLength(0);
    });

    test('returns not-found error when the code entry does not resolve in the tenant', async () => {
      const response = await call(
        'UteamupCodecatalogSetResponsibleOwners',
        { codeCatalogEntryGuid: '99999999-9999-9999-9999-999999999999', userIds: [userIdA] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Code catalog entry 99999999-9999-9999-9999-999999999999 not found.' },
            id: 7
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when Coding.Update is missing', async () => {
      const response = await call(
        'UteamupCodecatalogSetResponsibleOwners',
        { codeCatalogEntryGuid: codeGuid, userIds: [userIdA] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: Coding.Update required' },
            id: 8
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Coding.Update');
    });
  });

  // ---------------------------------------------------------------------------
  // Argument round-trip — the proxy forwards args verbatim. Capturing nock is
  // registered FIRST so it intercepts before the helper's own interceptor; the
  // helper's mockReply is still required (its interceptor simply never fires).
  // ---------------------------------------------------------------------------
  describe('Argument round-trip', () => {
    test('UteamupAssetSetResponsibleOwners forwards assetGuid + userIds verbatim', async () => {
      let forwardedParams;
      nock(BASE_URL)
        .post('/mcp', (body) => {
          forwardedParams = body.params;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(ownerList) }] },
          id: 9
        }), { 'Content-Type': 'application/json' });

      await call(
        'UteamupAssetSetResponsibleOwners',
        { assetGuid, userIds: [userIdA, userIdB] },
        { status: 200, body: { jsonrpc: '2.0', result: {}, id: 9 } }
      );

      expect(forwardedParams).toBeDefined();
      expect(forwardedParams.name).toBe('UteamupAssetSetResponsibleOwners');
      expect(forwardedParams.arguments.assetGuid).toBe(assetGuid);
      expect(forwardedParams.arguments.userIds).toEqual([userIdA, userIdB]);
    });

    test('UteamupCodecatalogSetResponsibleOwners forwards codeCatalogEntryGuid + userIds verbatim', async () => {
      let forwardedParams;
      nock(BASE_URL)
        .post('/mcp', (body) => {
          forwardedParams = body.params;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify([ownerList[0]]) }] },
          id: 10
        }), { 'Content-Type': 'application/json' });

      await call(
        'UteamupCodecatalogSetResponsibleOwners',
        { codeCatalogEntryGuid: codeGuid, userIds: [userIdA] },
        { status: 200, body: { jsonrpc: '2.0', result: {}, id: 10 } }
      );

      expect(forwardedParams).toBeDefined();
      expect(forwardedParams.name).toBe('UteamupCodecatalogSetResponsibleOwners');
      expect(forwardedParams.arguments.codeCatalogEntryGuid).toBe(codeGuid);
      expect(forwardedParams.arguments.userIds).toEqual([userIdA]);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupAssetSetResponsibleOwners', args: { assetGuid, userIds: [userIdA] } },
    { name: 'UteamupCodecatalogSetResponsibleOwners', args: { codeCatalogEntryGuid: codeGuid, userIds: [userIdA] } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
