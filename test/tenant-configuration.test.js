'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');

describe('Tenant industry and module configuration MCP tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_tenant_configuration';
  const primaryGuid = '11111111-1111-1111-1111-111111111111';
  const constructionGuid = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (name, args, reply) =>
    callMcpTool(baseUrl, accessToken, name, args, reply);

  test('gets primary and additional industry profiles without a tenant-id argument', async () => {
    const selection = {
      primaryIndustryProfileGuid: primaryGuid,
      additionalIndustryProfileGuids: [constructionGuid],
    };

    const response = await call(
      'UteamupTenantIndustryProfilesGet',
      {},
      successReply(selection),
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(selection);
  });

  test('replaces the complete additional-industry GUID set', async () => {
    const response = await call(
      'UteamupTenantAdditionalIndustryProfilesSet',
      { additionalIndustryProfileGuids: [constructionGuid] },
      successReply({
        primaryIndustryProfileGuid: primaryGuid,
        additionalIndustryProfileGuids: [constructionGuid],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.additionalIndustryProfileGuids).toEqual([constructionGuid]);
  });

  test('lists plan-bounded module-family state', async () => {
    const modules = [{
      key: 'fleet',
      name: 'Fleet management',
      description: 'Fleet surfaces',
      isAvailableInPlan: true,
      isEnabled: false,
      featureNames: ['Fleet Dashboard', 'Fleet Drivers'],
    }];

    const response = await call(
      'UteamupTenantModulesGet',
      {},
      successReply(modules),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result[0]).toMatchObject({ key: 'fleet', isEnabled: false });
  });

  test('sets one module family and preserves JSON-RPC errors', async () => {
    const success = await call(
      'UteamupTenantModuleSet',
      { familyKey: 'fleet', isEnabled: false },
      successReply({ key: 'fleet', isAvailableInPlan: true, isEnabled: false }),
    );
    expect(JSON.parse(success.body.result.content[0].text).isEnabled).toBe(false);

    const failure = await call(
      'UteamupTenantModuleSet',
      { familyKey: 'unknown', isEnabled: true },
      errorReply(-32000, 'Module family not found'),
    );
    expect(failure.body.error.message).toContain('Module family not found');
  });
});
