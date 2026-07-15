/** GUID-only customer portal user MCP proxy contract tests. */

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

describe('customer portal user MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_customer_portal_user';
  const userExternalGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const customerExternalGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const tenantGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const createModel = {
    customerExternalGuid,
    email: 'portal@example.com',
    isActive: true,
    canViewProjects: true,
    canRequestWork: true,
    canApproveWorkorders: false,
    canTrackFleet: false,
    canSendMessages: true,
    canRateJobs: true,
  };

  const updateModel = {
    isActive: false,
    canViewProjects: true,
    canRequestWork: true,
    canApproveWorkorders: false,
    canTrackFleet: false,
    canSendMessages: true,
    canRateJobs: true,
  };

  const userResponse = {
    externalGuid: userExternalGuid,
    tenantGuid,
    customerExternalGuid,
    customerName: 'Example Customer',
    email: 'portal@example.com',
    isActive: true,
    lastLoginAt: null,
    canViewProjects: true,
    canRequestWork: true,
    canApproveWorkorders: false,
    canTrackFleet: false,
    canSendMessages: true,
    canRateJobs: true,
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
    ['UteamupCustomerPortalUserList', {}, [userResponse]],
    ['UteamupCustomerPortalUserGet', { userExternalGuid }, userResponse],
    ['UteamupCustomerPortalUserCreate', { model: createModel }, userResponse],
    [
      'UteamupCustomerPortalUserUpdate',
      { userExternalGuid, model: updateModel },
      { ...userResponse, isActive: false },
    ],
    ['UteamupCustomerPortalUserDelete', { userExternalGuid }, true],
  ])('%s preserves its GUID contract', async (toolName, args, data) => {
    const result = await call(toolName, args, data);
    expect(result).toEqual(data);
    expect(JSON.stringify(result)).not.toMatch(
      /\"(?:id|tenantId|customerId)\"/,
    );
  });

  const errorTools = [
    { name: 'UteamupCustomerPortalUserList', args: {} },
    { name: 'UteamupCustomerPortalUserGet', args: { userExternalGuid } },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
