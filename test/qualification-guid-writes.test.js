'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// Proxy wire contracts only. Real actor/tenant/permission and own-renewal checks
// are covered by the Backend MyQualificationCommandTests source.
describe('Current-user qualification GUID write tools', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'test_qualification_token';
  const heldGuid = '11111111-1111-4111-8111-111111111111';
  const catalogGuid = '22222222-2222-4222-8222-222222222222';
  const proofGuid = '33333333-3333-4333-8333-333333333333';
  const tools = [
    { name: 'UteamupMySkillAdd', args: { model: { skillGuid: catalogGuid, proficiencyLevel: 2, yearsOfExperience: 0, notes: null } } },
    { name: 'UteamupMySkillUpdate', args: { userSkillGuid: heldGuid, model: { proficiencyLevel: 3, yearsOfExperience: 0, notes: 'Current experience' } } },
    { name: 'UteamupMyCertificateUpdate', args: { userCertificateGuid: heldGuid, model: { certificateNumber: 'CERT-2', documentGuid: null } } },
    { name: 'UteamupMyCertificateRenew', args: { userCertificateGuid: heldGuid, model: { newExpirationDate: '2027-10-18T00:00:00Z', newDocumentGuid: proofGuid } } },
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, token, name, args, reply, args);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name retains GUID-only arguments and the returned observed identity', async ({ name, args }) => {
    const observed = { externalGuid: heldGuid, skillGuid: catalogGuid, documentGuid: proofGuid };
    const response = await call(name, args, successReply(observed));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(observed);
    for (const key of ['tenantGuid', 'userId', 'skillId', 'certificateId', 'documentId', 'newDocumentId']) {
      expect(args).not.toHaveProperty(key);
      expect(args.model).not.toHaveProperty(key);
    }
    expect(nock.isDone()).toBe(true);
  });

  test.each([{}, { documentGuid: null }, { documentGuid: proofGuid }])('preserves exact proof intent %j', async model => {
    const args = { userCertificateGuid: heldGuid, model };
    const response = await call('UteamupMyCertificateUpdate', args, successReply({ externalGuid: heldGuid }));
    expect(response.status).toBe(200);
    expect(nock.isDone()).toBe(true);
  });

  test('surfaces own-only renewal denial without converting it into a success', async () => {
    const response = await call('UteamupMyCertificateRenew', tools[3].args,
      errorReply(-32603, 'Only the current user\'s certificate can be renewed by this tool.'));
    expect(response.body.error.message).toContain('current user');
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
