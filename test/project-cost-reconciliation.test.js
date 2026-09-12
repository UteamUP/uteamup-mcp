'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Project cost reconciliation evidence contracts', () => {
  const baseUrl = 'https://api.test.com';
  const projectGuid = 'aaaaaaaa-1111-2222-3333-444444444444';
  const sourceGuid = 'bbbbbbbb-1111-2222-3333-444444444444';
  afterEach(() => nock.cleanAll());

  test('retains null provenance and separate receipt evidence in previews', async () => {
    const preview = {
      source: { guid: sourceGuid, sourceGuid, amount: 100, currencyGuid: null },
      sourceFingerprint: 'A'.repeat(64), isSourceCurrent: true,
      previousDecisionGuid: null, latestDecision: null,
      receiptCandidates: [{ record: { amount: 200, currencyCode: 'EUR' }, fingerprint: 'B'.repeat(64), availableAmount: 150, isSourceCurrent: true }],
    };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectCostReconciliation',
      { projectGuid }, successReply([preview]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([preview]);
  });

  test('retains reviewed decision identity and stale status on replay', async () => {
    const model = {
      requestGuid: 'cccccccc-1111-2222-3333-444444444444', costRecordGuid: sourceGuid,
      sourceFingerprint: 'A'.repeat(64), previousDecisionGuid: null, outcome: 'Independent',
      currencyGuid: 'dddddddd-1111-2222-3333-444444444444', coveredAmount: 0,
      receiptCostRecordGuid: null, receiptFingerprint: null, reason: 'Reviewed against the invoice and stock issue.',
    };
    const decision = { ...model, guid: 'eeeeeeee-1111-2222-3333-444444444444', sourceGuid, projectGuid, isCurrent: false };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectCostReconcile',
      { projectGuid, model }, successReply(decision));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(decision);
  });
  test('preserves unknown direct plan inputs instead of filling them from subtree totals', async () => {
    const plan = { deliverableGuid: sourceGuid, currencyGuid: null, currencyCode: null,
      approvedSalesValue: null, approvedCostBudget: null, estimatedRemainingCost: null,
      workStatus: 'Draft', updatedAt: '2026-09-12T20:00:00Z' };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupProjectDeliverableCostPlanGet',
      { projectGuid, deliverableGuid: sourceGuid }, successReply(plan));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(plan);
  });
});
