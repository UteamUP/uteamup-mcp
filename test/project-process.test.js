'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Explicit project process contracts', () => {
  const baseUrl = 'https://api.test.com';
  const projectGuid = 'aaaaaaaa-1111-2222-3333-444444444444';
  const requestGuid = 'bbbbbbbb-1111-2222-3333-444444444444';
  afterEach(() => nock.cleanAll());

  test('keeps a legacy project distinct from an adopted process', async () => {
    const current = { projectGuid, projectUpdatedAt: '2026-09-13T00:00:00Z', revision: null,
      definition: null, isCurrent: true, isCompleteForViewer: true };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectProcessGet', { projectGuid }, successReply(current));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(current);
  });

  test('retains exact review identity, uppercase gate code and configured exception policy', async () => {
    const model = { requestGuid, expectedProjectUpdatedAt: '2026-09-13T00:00:00Z',
      expectedProcessRevisionGuid: '00000000-0000-0000-0000-000000000000', reason: 'Reviewed authority and evidence',
      definition: { profile: 'general', steps: [{ stageGuid: null, step: 'scope', name: 'Scope and baseline',
        gate: { code: 'G1', authorityUserGuid: projectGuid, customerContactGuid: null,
          requireIndependentApprover: true, allowIndependenceException: false, allowConditionalRelease: false,
          requireSignature: false, delegations: [], criteria: [{ criterionGuid: null, key: 'approved-scope',
            label: 'Approved scope', isRequired: true, evidenceKind: 'approvedScope', allowException: false }] } }] },
      expectedReviewFingerprint: 'A'.repeat(64) };
    const recorded = { projectGuid, revision: { revisionGuid: requestGuid, revision: 1 }, isCurrent: true };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectProcessAdopt', { projectGuid, model }, successReply(recorded));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(recorded);
  });

  test('does not turn redacted history into complete current rules', async () => {
    const historical = { projectGuid, revision: { revisionGuid: requestGuid, sourceTemplateProjectGuid: null,
      sourceTemplateRevisionGuid: null, sourceTemplateReadable: false }, isCurrent: false, isCompleteForViewer: false };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectProcessRevision',
      { projectGuid, revisionGuid: requestGuid }, successReply(historical));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(historical);
  });
});
