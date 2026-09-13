'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Reviewed project intake and requirement contracts', () => {
  const baseUrl = 'https://api.test.com';
  const projectGuid = '11111111-1111-4111-8111-111111111111';
  const intakeGuid = '22222222-2222-4222-8222-222222222222';
  const requestGuid = '33333333-3333-4333-8333-333333333333';
  const requirementGuid = '44444444-4444-4444-8444-444444444444';
  const stamp = '2026-09-13T10:11:12.123456Z';
  const draft = { sourceReviewChecks: [{ code: 'unmatchedSource', resolution: null }], rows: [
    { guid: requirementGuid, quantity: 2, salesValue: null, currencyGuid: null, allocations: [] }
  ], controlTotals: [], fieldMapping: { reference: 'Position' } };
  const requirement = { requestGuid, expectedUpdatedAt: stamp, deliverableGuid: intakeGuid,
    definition: { reference: 'UTIL-01', statement: 'Customer supplies process water', ownerUserGuid: null },
    evidence: {}, isRetired: false };
  const selected = { intakes: [{ intakeGuid, expectedUpdatedAt: stamp }], expectedProjectUpdatedAt: stamp,
    expectedBaselineGuid: '00000000-0000-0000-0000-000000000000' };
  const tools = [
    { name: 'UteamupProjectIntakesList', args: { projectGuid, page: 4, pageSize: 25 } },
    { name: 'UteamupProjectIntakeGet', args: { projectGuid, intakeGuid } },
    { name: 'UteamupProjectIntakeHistory', args: { projectGuid, intakeGuid, page: 3, pageSize: 10 } },
    { name: 'UteamupProjectIntakeSourcePreview', args: { projectGuid, model: { sourceDocumentVersionGuid: intakeGuid,
      sourceMapping: { worksheet: 'Quotation', headerRow: 2 }, fieldMapping: { Position: 'reference' } } } },
    { name: 'UteamupProjectIntakeCreate', args: { projectGuid, model: { requestGuid, kind: 'manual',
      sourceReference: 'Reviewed manual scope', sourceDocumentVersionGuid: null, draft } } },
    { name: 'UteamupProjectIntakeUpdate', args: { projectGuid, intakeGuid, model: { requestGuid, expectedUpdatedAt: stamp, draft } } },
    { name: 'UteamupProjectIntakeReview', args: { projectGuid, intakeGuid, model: { requestGuid,
      expectedUpdatedAt: stamp, reviewNote: 'Reconciled rows and exact source checks' } } },
    { name: 'UteamupProjectScopeApplyPreview', args: { projectGuid, model: selected } },
    { name: 'UteamupProjectScopeApply', args: { projectGuid, model: { ...selected, requestGuid,
      expectedReviewFingerprint: 'a'.repeat(64), baselineLabel: 'Approved scope', approvalNote: 'Two units share one quoted value' } } },
    { name: 'UteamupProjectRequirementsList', args: { projectGuid, deliverableGuid: intakeGuid, includeRetired: true, page: 5, pageSize: 50 } },
    { name: 'UteamupProjectRequirementHistory', args: { projectGuid, requirementGuid, page: 7, pageSize: 20 } },
    { name: 'UteamupProjectRequirementCreate', args: { projectGuid, model: requirement } },
    { name: 'UteamupProjectRequirementUpdate', args: { projectGuid, requirementGuid, model: requirement } }
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, 'test-token', name, args, reply, args);
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name keeps exact arguments under the owning model parameter', async ({ name, args }) => {
    const retained = { requestGuid, evidenceCompleteForViewer: false, sourceIntegrityVerified: null,
      discrepancies: [{ code: 'quantityMismatch', blocksApproval: true, expected: 2, actual: 1 }] };
    const response = await call(name, args, successReply(retained));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(retained);
    expect(nock.isDone()).toBe(true);
    expect(args).not.toHaveProperty('userId');
    expect(args).not.toHaveProperty('tenantId');
  });

  test.each(tools.filter(tool => /List|History$/.test(tool.name)))('$name retains an empty bounded page', async ({ name, args }) => {
    const page = { items: [], totalItems: 0, currentPage: args.page, pageSize: args.pageSize, totalPages: 0 };
    const response = await call(name, args, successReply(page));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(page);
  });

  test('requirement evidence omission and explicit clear remain different', async () => {
    const { evidence, ...preserved } = requirement;
    expect(evidence).toEqual({});
    for (const model of [preserved, requirement]) {
      const args = { projectGuid, requirementGuid, model };
      const response = await call('UteamupProjectRequirementUpdate', args, successReply({ revision: 2 }));
      expect(JSON.parse(response.body.result.content[0].text).revision).toBe(2);
    }
  });

  test.each(tools)('$name preserves owning validation and authorization errors', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32001, 'The exact reviewed scope changed or is unavailable'));
    expect(response.body.error.message).toBe('The exact reviewed scope changed or is unavailable');
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
