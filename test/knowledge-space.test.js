/**
 * Knowledge Space MCP tool tests
 *
 * Tests that Knowledge Space MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupKnowledgeSpaceList()
 *   UteamupKnowledgeSpaceGet(spaceGuid)
 *   UteamupKnowledgeSpaceCreate(model)
 *   UteamupKnowledgeSpaceUpdate(spaceGuid, model)
 *   UteamupKnowledgeSpaceDelete(spaceGuid)
 *   UteamupKnowledgeSpaceUsage(spaceGuid)
 *   UteamupKnowledgeSpaceListMembers(spaceGuid)
 *   UteamupKnowledgeSpaceAddMember(spaceGuid, model)
 *
 * Pattern mirrors maintenance-analytics-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend. All identifiers are GUIDs.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Knowledge Space MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_knowledgespace';
  const SPACE_GUID = '3e1cd135-07d1-46ff-8f5f-549da5390e78';
  const USER_GUID = 'a1b2c3d4-e5f6-47a8-89b0-c1d2e3f4a5b6';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockSpace = {
    guid: SPACE_GUID,
    name: 'Operations Manual',
    slug: 'operations-manual',
    description: 'Standard operating procedures',
    iconName: 'BookOpenIcon',
    displayOrder: 1,
    isSystem: false,
    isReadOnly: false,
    isActive: true,
    requiredPermission: null,
    myRole: 2,
    canEdit: true,
    canManage: true,
    pageCount: 12,
    tenantGuid: '11111111-1111-1111-1111-111111111111'
  };

  const mockUsage = {
    spaceCount: 3,
    maxSpaces: 10,
    pageCount: 12,
    maxPagesPerSpace: 100,
    maxSubPagesPerPage: 50,
    planName: 'Professional'
  };

  const mockMember = {
    userGuid: USER_GUID,
    displayName: 'Jane Tech',
    email: 'jane@example.com',
    role: 1
  };

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceList
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceList tool', () => {
    test('returns visible spaces successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceList',
        {},
        successReply([mockSpace])
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].guid).toBe(SPACE_GUID);
      expect(data[0].name).toBe('Operations Manual');
      expect(data[0].pageCount).toBe(12);
    });

    test('returns empty list when no spaces visible', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceList',
        {},
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('returns error when permission denied', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceList',
        {},
        errorReply(-32000, 'Permission denied: KnowledgeArticle.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceGet
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceGet tool', () => {
    test('returns a single space by GUID', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceGet',
        { spaceGuid: SPACE_GUID },
        successReply(mockSpace)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(SPACE_GUID);
      expect(data.canManage).toBe(true);
      expect(data.myRole).toBe(2);
    });

    test('returns error when space not found', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceGet',
        { spaceGuid: SPACE_GUID },
        errorReply(-32000, 'Knowledge space not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceCreate
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceCreate tool', () => {
    test('creates a space successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceCreate',
        { model: { name: 'Safety Guides', description: 'EHS docs', iconName: 'ShieldCheckIcon' } },
        successReply({ ...mockSpace, name: 'Safety Guides', description: 'EHS docs' })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.name).toBe('Safety Guides');
      expect(data.guid).toBe(SPACE_GUID);
    });

    test('returns error when plan space cap exceeded', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceCreate',
        { model: { name: 'Overflow Space' } },
        errorReply(-32000, 'plan_limit_exceeded')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('plan_limit_exceeded');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceUpdate tool', () => {
    test('updates a space successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceUpdate',
        { spaceGuid: SPACE_GUID, model: { name: 'Renamed Space', isActive: false } },
        successReply({ ...mockSpace, name: 'Renamed Space', isActive: false })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.name).toBe('Renamed Space');
      expect(data.isActive).toBe(false);
    });

    test('returns error when updating a system space', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceUpdate',
        { spaceGuid: SPACE_GUID, model: { name: 'Nope' } },
        errorReply(-32000, 'System spaces are not editable')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not editable');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceDelete
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceDelete tool', () => {
    test('deletes an empty space successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceDelete',
        { spaceGuid: SPACE_GUID },
        successReply(true)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });

    test('returns error when space is not empty', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceDelete',
        { spaceGuid: SPACE_GUID },
        errorReply(-32000, 'Space is not empty')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not empty');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceUsage
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceUsage tool', () => {
    test('returns usage stats successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceUsage',
        { spaceGuid: SPACE_GUID },
        successReply(mockUsage)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.spaceCount).toBe(3);
      expect(data.maxSpaces).toBe(10);
      expect(data.pageCount).toBe(12);
      expect(data.planName).toBe('Professional');
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceUsage',
        { spaceGuid: SPACE_GUID },
        errorReply(-32000, 'Failed to compute usage')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('usage');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceListMembers
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceListMembers tool', () => {
    test('returns members successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceListMembers',
        { spaceGuid: SPACE_GUID },
        successReply([mockMember])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].userGuid).toBe(USER_GUID);
      expect(data[0].role).toBe(1);
    });

    test('returns empty list when no members', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceListMembers',
        { spaceGuid: SPACE_GUID },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeSpaceAddMember
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeSpaceAddMember tool', () => {
    test('adds a member successfully', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceAddMember',
        { spaceGuid: SPACE_GUID, model: { userGuid: USER_GUID, role: 1 } },
        successReply(mockMember)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.userGuid).toBe(USER_GUID);
      expect(data.role).toBe(1);
      expect(data.email).toBe('jane@example.com');
    });

    test('returns error when member user not found', async () => {
      const response = await call(
        'UteamupKnowledgeSpaceAddMember',
        { spaceGuid: SPACE_GUID, model: { userGuid: USER_GUID, role: 0 } },
        errorReply(-32000, 'User not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupKnowledgeSpaceList', args: {} },
    { name: 'UteamupKnowledgeSpaceGet', args: { spaceGuid: SPACE_GUID } },
    { name: 'UteamupKnowledgeSpaceCreate', args: { model: { name: 'X' } } },
    { name: 'UteamupKnowledgeSpaceUpdate', args: { spaceGuid: SPACE_GUID, model: { name: 'Y' } } },
    { name: 'UteamupKnowledgeSpaceDelete', args: { spaceGuid: SPACE_GUID } },
    { name: 'UteamupKnowledgeSpaceUsage', args: { spaceGuid: SPACE_GUID } },
    { name: 'UteamupKnowledgeSpaceListMembers', args: { spaceGuid: SPACE_GUID } },
    { name: 'UteamupKnowledgeSpaceAddMember', args: { spaceGuid: SPACE_GUID, model: { userGuid: USER_GUID, role: 0 } } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
