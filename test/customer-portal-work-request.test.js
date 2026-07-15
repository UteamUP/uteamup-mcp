/** GUID-only customer portal work request MCP proxy contract tests. */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('customer portal work request MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_customer_portal_work_request';
  const workRequestGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const portalUserGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const customerGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const tenantGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const createModel = {
    customerPortalUserExternalGuid: portalUserGuid,
    customerExternalGuid: customerGuid,
    description: 'Air conditioning stopped',
    priorityHint: 2,
  };

  const responseModel = {
    externalGuid: workRequestGuid,
    tenantGuid,
    customerPortalUserExternalGuid: portalUserGuid,
    portalUserEmail: 'portal@example.com',
    customerExternalGuid: customerGuid,
    customerName: 'Example Customer',
    description: 'Air conditioning stopped',
    priorityHint: 2,
    requestedAt: '2026-07-15T10:00:00Z',
    status: 0,
    convertedToWorkorderGuid: null,
    reviewedByUserGuid: null,
    reviewedByName: null,
    reviewNotes: null,
    createdAt: '2026-07-15T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );

    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it.each([
    ['UteamupCustomerPortalWorkRequestList', { portalUserGuid }, [responseModel]],
    ['UteamupCustomerPortalWorkRequestGet', { workRequestGuid }, responseModel],
    ['UteamupCustomerPortalWorkRequestCreate', { model: createModel }, responseModel],
    [
      'UteamupCustomerPortalWorkRequestStatusUpdate',
      { workRequestGuid, model: { status: 2, reviewNotes: 'Approved' } },
      { ...responseModel, status: 2, reviewNotes: 'Approved' },
    ],
  ])('%s preserves its GUID contract', async (toolName, args, data) => {
    const result = await call(toolName, args, data);
    expect(result).toEqual(data);
    expect(JSON.stringify(result)).not.toMatch(
      /"(?:id|tenantId|customerPortalUserId|customerId|convertedToWorkorderId|reviewedByUserId)"/,
    );
  });

  const errorTools = [
    { name: 'UteamupCustomerPortalWorkRequestList', args: {} },
    { name: 'UteamupCustomerPortalWorkRequestGet', args: { workRequestGuid } },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
