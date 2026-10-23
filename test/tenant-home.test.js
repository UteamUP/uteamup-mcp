/**
 * UteamUP Home tenant MCP tool tests
 *
 * Tools under test:
 *   UteamupTenantGetMyTenants()                       — carries tenantKind
 *   UteamupTenantCreate(model)                        — forwards tenantKind
 *   UteamupTenantTransferOwnership(newOwnerUserGuid)
 *   UteamupTenantHomeMembershipSet(userGuid, body)
 *   UteamupTenantHomeChildrenList() / Add(body) / Remove(childGuid)
 *
 * The tenant always comes from the Bearer token, so none of the Home tools take a tenant argument.
 */

'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamUP Home tenant MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_tenant_home';
  const TENANT_GUID = '31000000-0000-0000-0000-000000000001';
  const MEMBER_GUID = '31000000-0000-0000-0000-000000000002';
  const APARTMENT_GUID = '31000000-0000-0000-0000-000000000003';
  const CHILD_GUID = '31000000-0000-0000-0000-000000000004';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (name, args, reply) => callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, reply);
  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  describe('tenantKind', () => {
    test('my tenants show which are households, housing associations and businesses', async () => {
      const tenants = [
        { guid: TENANT_GUID, name: 'Heimilið', tenantKind: 'household' },
        { guid: '31000000-0000-0000-0000-000000000009', name: 'Verkstæðið ehf.', tenantKind: 'business' },
      ];

      const response = await call('UteamupTenantGetMyTenants', {}, successReply(tenants));

      expect(resultOf(response).map((tenant) => tenant.tenantKind)).toEqual(['household', 'business']);
    });

    test('create forwards tenantKind verbatim', async () => {
      const args = { model: { name: 'Húsfélagið Laugavegi 1', tenantKind: 'housingAssociation', billingCountryCode: 'IS', taxIdentifier: '5502691239' } };

      const response = await callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupTenantCreate', args,
        successReply({ success: true, tenantGuid: TENANT_GUID }), args);

      expect(resultOf(response).tenantGuid).toBe(TENANT_GUID);
    });
  });

  describe('UteamupTenantTransferOwnership', () => {
    test('transfers to a member by user GUID', async () => {
      const response = await call(
        'UteamupTenantTransferOwnership',
        { newOwnerUserGuid: MEMBER_GUID },
        successReply({ success: true, message: 'Tenant owner changed', newOwnerId: 'member-id' }),
      );

      expect(response.status).toBe(200);
      expect(resultOf(response).success).toBe(true);
    });

    test('a refusal from the backend round-trips as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupTenantTransferOwnership',
        { newOwnerUserGuid: MEMBER_GUID },
        errorReply(-32000, 'User must be a member of the tenant before becoming the owner'),
      );

      expect(response.body.error.message).toContain('member of the tenant');
    });
  });

  describe('UteamupTenantHomeMembershipSet', () => {
    test('sets a guest end date and a resident apartment', async () => {
      const body = { accessEndsAt: '2026-11-01T12:00:00Z', residenceLocationGuid: APARTMENT_GUID };

      const response = await call(
        'UteamupTenantHomeMembershipSet',
        { userGuid: MEMBER_GUID, body },
        successReply({ userGuid: MEMBER_GUID, ...body }),
      );

      expect(resultOf(response)).toEqual({ userGuid: MEMBER_GUID, ...body });
    });

    test('an unknown member comes back empty', async () => {
      const response = await call(
        'UteamupTenantHomeMembershipSet',
        { userGuid: MEMBER_GUID, body: {} },
        successReply(null),
      );

      expect(resultOf(response)).toBeNull();
    });

    test('a business tenant is refused by the backend', async () => {
      const response = await call(
        'UteamupTenantHomeMembershipSet',
        { userGuid: MEMBER_GUID, body: { accessEndsAt: '2026-11-01T12:00:00Z' } },
        errorReply(-32000, 'Home membership settings exist only for households and housing associations'),
      );

      expect(response.body.error.message).toContain('households');
    });
  });

  test('regression guard: the Home tools never take a tenant argument', () => {
    const toolArgs = {
      UteamupTenantTransferOwnership: { newOwnerUserGuid: MEMBER_GUID },
      UteamupTenantHomeMembershipSet: { userGuid: MEMBER_GUID, body: {} },
    };

    for (const args of Object.values(toolArgs)) {
      expect(Object.keys(args)).not.toEqual(expect.arrayContaining(['tenantGuid']));
      expect(Object.keys(args)).not.toEqual(expect.arrayContaining(['tenantId']));
    }
  });

  describe('household children', () => {
    test('add sends the name and birth year and returns the child by GUID', async () => {
      const args = { body: { name: 'Sóla', birthYear: 2019 } };

      const response = await callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupTenantHomeChildrenAdd', args,
        successReply({ guid: CHILD_GUID, name: 'Sóla', birthYear: 2019 }), args);

      expect(resultOf(response)).toEqual({ guid: CHILD_GUID, name: 'Sóla', birthYear: 2019 });
    });

    test('list returns the children', async () => {
      const response = await call('UteamupTenantHomeChildrenList', {}, successReply([{ guid: CHILD_GUID, name: 'Ari' }]));

      expect(resultOf(response).map((child) => child.name)).toEqual(['Ari']);
    });

    test('remove takes only the child GUID', async () => {
      const response = await call('UteamupTenantHomeChildrenRemove', { childGuid: CHILD_GUID }, successReply(true));

      expect(resultOf(response)).toBe(true);
    });

    test('a housing association is refused by the backend', async () => {
      const response = await call('UteamupTenantHomeChildrenAdd', { body: { name: 'Ari' } },
        errorReply(-32000, 'home.children.notHousehold: only a household records children.'));

      expect(response.body.error.message).toContain('notHousehold');
    });
  });

  const tools = [
    { name: 'UteamupTenantTransferOwnership', args: { newOwnerUserGuid: MEMBER_GUID } },
    { name: 'UteamupTenantHomeMembershipSet', args: { userGuid: MEMBER_GUID, body: {} } },
    { name: 'UteamupTenantHomeChildrenList', args: {} },
    { name: 'UteamupTenantHomeChildrenAdd', args: { body: { name: 'Ari' } } },
    { name: 'UteamupTenantHomeChildrenRemove', args: { childGuid: CHILD_GUID } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
