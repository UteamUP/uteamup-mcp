'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Exact scoped gate submissions', () => {
  const baseUrl = 'https://api.test.com';
  const projectGuid = 'aaaaaaaa-1111-2222-3333-444444444444';
  const stageGuid = 'bbbbbbbb-1111-2222-3333-444444444444';
  const submissionGuid = 'cccccccc-1111-2222-3333-444444444444';
  afterEach(() => nock.cleanAll());

  test('keeps unavailable evidence distinct from a permitted approval', async () => {
    const review = { reviewFingerprint: 'a'.repeat(64), sourcesPermitApproval: false,
      snapshot: { stageGuid, criteria: [{ deliverableGuid: submissionGuid, status: 'unavailable', evidence: { isMet: null } }] },
      blockers: [{ code: 'criterion', deliverableGuid: submissionGuid, criterionGuid: stageGuid }] };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectGateSubmissionPreview',
      { projectGuid, stageGuid, model: { requestGuid: submissionGuid, expectedProcessRevisionGuid: projectGuid,
        deliverableGuids: [submissionGuid], authorityUserGuid: stageGuid, criteria: [] } }, successReply(review));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(review);
  });

  test('preserves exact submission identities and explicit customer publication', async () => {
    const model = { requestGuid: submissionGuid, expectedReviewFingerprint: 'a'.repeat(64),
      expectedProcessRevisionGuid: projectGuid, deliverableGuids: [submissionGuid], authorityUserGuid: stageGuid,
      acceptanceKind: 'signed', proposedOutcome: 'conditionallyApproved', publishCustomerReview: true,
      customerContactGuid: projectGuid, conditionObligationGuids: [stageGuid], exceptions: [],
      criteria: [{ criterionGuid: stageGuid, deliverableGuid: submissionGuid, isMet: true,
        documentVersionGuids: [projectGuid], inspectionTestExecutionGuids: [submissionGuid] }] };
    const retained = { isSummary: false, submissionGuid, reviewFingerprint: model.expectedReviewFingerprint,
      signatureRequirementGuids: [projectGuid, stageGuid], isCompleteForViewer: true };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectGateSubmissionSubmit',
      { projectGuid, stageGuid, model }, successReply(retained));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(retained);
  });

  test('does not turn redacted history into an empty complete review', async () => {
    const hidden = { isSummary: false, submissionGuid, snapshot: null, signatureRequirementGuids: [],
      isCompleteForViewer: false, unavailableSections: ['documents', 'testExecutions'] };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectGateSubmissionGet',
      { projectGuid, stageGuid, submissionGuid }, successReply(hidden));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(hidden);
  });
});
