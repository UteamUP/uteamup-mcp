'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Tenant SAML verified domain configuration', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_saml_domains';
  const tenantGuid = '11111111-1111-4111-8111-111111111111';
  const domainGuid = '22222222-2222-4222-8222-222222222222';
  const tools = [
    { name: 'uteamup_tenant_saml_domain_list', args: { tenantGuid } },
    { name: 'uteamup_tenant_saml_domain_register', args: { tenantGuid, body: { domain: 'iteggs.com' } } },
    { name: 'uteamup_tenant_saml_domain_verify', args: { tenantGuid, domainGuid } },
    { name: 'uteamup_tenant_saml_domain_disable', args: { tenantGuid, domainGuid } }
  ];
  const domain = { domainGuid, domain: 'iteggs.com', enabled: false, isVerified: false, verifiedAt: null,
    txtRecordName: '_uteamup-verify.iteggs.com', txtRecordValue: 'dns-proof' };
  const call = (name, args, reply) => callMcpTool(baseUrl, accessToken, name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists public domain GUIDs and DNS challenges without internal identifiers', async () => {
    const response = await call(tools[0].name, tools[0].args, successReply([domain]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([domain]);
  });

  test('an unconfigured tenant has an empty domain list', async () => {
    const response = await call(tools[0].name, tools[0].args, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('registration remains disabled before DNS proof', async () => {
    const response = await call(tools[1].name, tools[1].args, successReply(domain));
    expect(JSON.parse(response.body.result.content[0].text).enabled).toBe(false);
    expect(tools[1].args.body).toEqual({ domain: 'iteggs.com' });
  });

  test('verification and disable forward both scoped GUIDs', async () => {
    const verified = { ...domain, enabled: true, isVerified: true, verifiedAt: '2026-10-08T00:00:00Z' };
    const response = await call(tools[2].name, tools[2].args, successReply(verified));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(verified);
    const disabled = await call(tools[3].name, tools[3].args, successReply(true));
    expect(JSON.parse(disabled.body.result.content[0].text)).toBe(true);
  });

  test.each(tools)('preserves owner and cross-tenant denial for $name', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32000, 'SAML_CONFIGURATION_FORBIDDEN'));
    expect(response.body.error.message).toBe('SAML_CONFIGURATION_FORBIDDEN');
  });

  test('DNS verification failure stays bounded and does not suggest activation', async () => {
    const response = await call(tools[2].name, tools[2].args, errorReply(-32000, 'SAML_DOMAIN_VERIFICATION_FAILED'));
    expect(response.body.error.message).toBe('SAML_DOMAIN_VERIFICATION_FAILED');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
