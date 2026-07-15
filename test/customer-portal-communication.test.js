/** GUID-only customer portal message and rating MCP proxy contracts. */

'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('customer portal communication MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_customer_portal_communication';
  const portalUserGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workorderGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const recipientGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const tenantGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const messageModel = {
    toUserGuid: recipientGuid,
    workorderGuid,
    projectGuid: null,
    content: 'Please call before arrival',
  };
  const messageResponse = {
    externalGuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    tenantGuid,
    fromCustomerPortalUserExternalGuid: portalUserGuid,
    ...messageModel,
    sentAt: '2026-07-15T10:00:00Z',
    isRead: false,
    createdAt: '2026-07-15T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  };
  const ratingModel = { workorderGuid, rating: 5, comment: 'Excellent service' };
  const ratingResponse = {
    externalGuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    tenantGuid,
    customerPortalUserExternalGuid: portalUserGuid,
    ...ratingModel,
    ratedAt: '2026-07-15T10:00:00Z',
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
    ['UteamupCustomerPortalMessageList', { portalUserGuid }, [messageResponse]],
    ['UteamupCustomerPortalMessageCreate', { portalUserGuid, model: messageModel }, messageResponse],
    ['UteamupCustomerPortalJobRatingList', { portalUserGuid }, [ratingResponse]],
    ['UteamupCustomerPortalJobRatingCreate', { portalUserGuid, model: ratingModel }, ratingResponse],
  ])('%s preserves GUID-only identities', async (toolName, args, data) => {
    const result = await call(toolName, args, data);
    expect(result).toEqual(data);
    expect(JSON.stringify(result)).not.toMatch(
      /"(?:id|tenantId|portalUserId|customerPortalUserId|toUserId|workorderId|projectId)"/,
    );
  });

  const errorTools = [
    { name: 'UteamupCustomerPortalMessageList', args: { portalUserGuid } },
    { name: 'UteamupCustomerPortalJobRatingList', args: { portalUserGuid } },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
