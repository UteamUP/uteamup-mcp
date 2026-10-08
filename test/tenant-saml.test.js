'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Tenant SAML configuration protocol', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_saml';
  const tenantGuid = '11111111-1111-4111-8111-111111111111';
  const body = { companyCode: 'iteggs', metadataUrl: 'https://login.microsoftonline.com/tenant/federationmetadata/2007-06/federationmetadata.xml?appid=application', enabled: false };
  const client = { clientId: 'web', redirectUri: 'https://dev.uteamup.com/auth/saml/callback', state: 'x'.repeat(43), codeChallenge: 'y'.repeat(43), codeChallengeMethod: 'S256' };
  const tools = [
    { name: 'uteamup_tenant_saml_get', args: { tenantGuid } },
    { name: 'uteamup_tenant_saml_update', args: { tenantGuid, body } },
    { name: 'uteamup_tenant_saml_test', args: { tenantGuid, body: client } }
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, accessToken, name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('reads the tenant connection and public setup URLs', async () => {
    const connection = { tenantGuid, companyCode: 'iteggs', enabled: false, version: 1, certificates: [], validatedAt: null, hasEntitlement: true, globalEnabled: false };
    const response = await call(tools[0].name, tools[0].args, successReply(connection));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(connection);
  });

  test('an unconfigured tenant returns the documented empty connection', async () => {
    const empty = { tenantGuid, connectionGuid: '00000000-0000-0000-0000-000000000000', version: 0, companyCode: '', certificates: [], enabled: false };
    const response = await call(tools[0].name, tools[0].args, successReply(empty));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test('forwards disabled metadata import without actor or internal tenant IDs', async () => {
    const response = await call(tools[1].name, tools[1].args, successReply({ tenantGuid, enabled: false, version: 1 }));
    expect(JSON.parse(response.body.result.content[0].text).enabled).toBe(false);
    expect(tools[1].args).not.toHaveProperty('userId');
    expect(tools[1].args).not.toHaveProperty('tenantId');
  });

  test('starts an owner-bound draft browser test with PKCE rather than returning a session', async () => {
    const start = { authenticationUrl: 'https://login.microsoftonline.com/tenant/saml2?SAMLRequest=request', expiresAt: '2026-10-08T16:00:00Z' };
    const response = await call(tools[2].name, tools[2].args, successReply(start));
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(start);
    expect(result).not.toHaveProperty('accessToken');
  });

  test.each(tools)('preserves bounded owner or cross-tenant denial for $name', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32000, 'SAML_CONFIGURATION_DENIED'));
    expect(response.body.error.message).toBe('SAML_CONFIGURATION_DENIED');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
