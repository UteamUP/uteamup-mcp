/**
 * Contractor MCP tool tests
 *
 * Tests that Contractor MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupContractorProfileList(page, pageSize)
 *   UteamupContractorProfileGet(profileGuid)
 *   UteamupContractorAssignmentList(workOrderGuid)
 *   UteamupContractorAssign(model)
 *   UteamupContractorBidList(workOrderGuid)
 *   UteamupContractorBidAccept(bidGuid)
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Contractor MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_contractor';
  const PROFILE_GUID = '11111111-1111-1111-1111-111111111111';
  const WORK_ORDER_GUID = '22222222-2222-2222-2222-222222222222';
  const ASSIGNMENT_GUID = '33333333-3333-3333-3333-333333333333';
  const BID_GUID = '44444444-4444-4444-4444-444444444444';
  const MISSING_GUID = '99999999-9999-9999-9999-999999999999';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockProfile = {
    externalGuid: PROFILE_GUID,
    companyName: 'ProFix Contractors',
    contactEmail: 'info@profix.com',
    contactPhone: '+1-555-0100',
    specializations: ['Electrical', 'HVAC'],
    hourlyRate: 85.00,
    currencyCode: 'USD',
    rating: 4.7,
    isActive: true,
    createdAt: '2026-01-15T08:00:00Z'
  };

  const mockProfileList = {
    items: [mockProfile],
    totalCount: 1,
    page: 1,
    pageSize: 10
  };

  const mockAssignment = {
    externalGuid: ASSIGNMENT_GUID,
    workOrderGuid: WORK_ORDER_GUID,
    contractorProfileGuid: PROFILE_GUID,
    contractorName: 'ProFix Contractors',
    status: 'Accepted',
    assignedAt: '2026-03-01T09:00:00Z',
    startedAt: '2026-03-01T10:00:00Z',
    completedAt: null
  };

  const mockBid = {
    externalGuid: BID_GUID,
    workOrderGuid: WORK_ORDER_GUID,
    contractorProfileGuid: PROFILE_GUID,
    contractorName: 'ProFix Contractors',
    bidAmount: 500.00,
    currencyCode: 'USD',
    estimatedHours: 6,
    notes: 'Can start immediately',
    status: 'Pending',
    submittedAt: '2026-03-01T08:00:00Z'
  };

  const mockBidList = [mockBid];

  // ---------------------------------------------------------------------------
  // UteamupContractorProfileList
  // ---------------------------------------------------------------------------
  describe('UteamupContractorProfileList tool', () => {
    test('returns paginated contractor profiles', async () => {
      const response = await call(
        'UteamupContractorProfileList',
        { page: 1, pageSize: 10 },
        successReply(mockProfileList)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(data.items[0].companyName).toBe('ProFix Contractors');
    });

    test('returns empty list when no profiles exist', async () => {
      const emptyList = { items: [], totalCount: 0, page: 1, pageSize: 10 };

      const response = await call(
        'UteamupContractorProfileList',
        { page: 1, pageSize: 10 },
        successReply(emptyList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(0);
      expect(data.totalCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorProfileGet
  // ---------------------------------------------------------------------------
  describe('UteamupContractorProfileGet tool', () => {
    test('returns a single contractor profile by public GUID', async () => {
      const response = await call(
        'UteamupContractorProfileGet',
        { profileGuid: PROFILE_GUID },
        successReply(mockProfile)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.externalGuid).toBe(PROFILE_GUID);
      expect(data.companyName).toBe('ProFix Contractors');
      expect(data.specializations).toContain('Electrical');
      expect(data.hourlyRate).toBe(85.00);
    });

    test('returns error when profile not found', async () => {
      const response = await call(
        'UteamupContractorProfileGet',
        { profileGuid: MISSING_GUID },
        errorReply(-32000, 'Contractor profile not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Contractor profile not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorAssignmentList
  // ---------------------------------------------------------------------------
  describe('UteamupContractorAssignmentList tool', () => {
    test('returns assignments for a work order', async () => {
      const response = await call(
        'UteamupContractorAssignmentList',
        { workOrderGuid: WORK_ORDER_GUID },
        successReply([mockAssignment])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].workOrderGuid).toBe(WORK_ORDER_GUID);
      expect(data[0].status).toBe('Accepted');
    });

    test('returns empty list when no contractors are assigned', async () => {
      const response = await call(
        'UteamupContractorAssignmentList',
        { workOrderGuid: MISSING_GUID },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorAssign
  // ---------------------------------------------------------------------------
  describe('UteamupContractorAssign tool', () => {
    test('assigns a contractor to a work order successfully', async () => {
      const response = await call(
        'UteamupContractorAssign',
        { model: { workOrderGuid: WORK_ORDER_GUID, contractorProfileGuid: PROFILE_GUID, notes: 'Urgent repair' } },
        successReply(mockAssignment)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.workOrderGuid).toBe(WORK_ORDER_GUID);
      expect(data.contractorProfileGuid).toBe(PROFILE_GUID);
      expect(data.status).toBe('Accepted');
    });

    test('returns validation error when workOrderGuid is missing', async () => {
      const response = await call(
        'UteamupContractorAssign',
        { model: { contractorProfileGuid: PROFILE_GUID } },
        errorReply(-32602, 'WorkOrderGuid is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkOrderGuid');
    });

    test('returns validation error when contractorProfileGuid is invalid', async () => {
      const response = await call(
        'UteamupContractorAssign',
        { model: { workOrderGuid: WORK_ORDER_GUID, contractorProfileGuid: '00000000-0000-0000-0000-000000000000' } },
        errorReply(-32602, 'ContractorProfileGuid is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ContractorProfileGuid');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorBidList
  // ---------------------------------------------------------------------------
  describe('UteamupContractorBidList tool', () => {
    test('returns bids for a work order', async () => {
      const response = await call(
        'UteamupContractorBidList',
        { workOrderGuid: WORK_ORDER_GUID },
        successReply(mockBidList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].bidAmount).toBe(500.00);
      expect(data[0].status).toBe('Pending');
    });

    test('returns empty list when no bids exist', async () => {
      const response = await call(
        'UteamupContractorBidList',
        { workOrderGuid: MISSING_GUID },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorBidAccept
  // ---------------------------------------------------------------------------
  describe('UteamupContractorBidAccept tool', () => {
    test('accepts a bid successfully', async () => {
      const acceptedBid = { ...mockBid, status: 'Accepted', acceptedAt: '2026-03-01T12:00:00Z' };

      const response = await call(
        'UteamupContractorBidAccept',
        { bidGuid: BID_GUID },
        successReply(acceptedBid)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('Accepted');
      expect(data.acceptedAt).toBeDefined();
    });

    test('returns error when bid not found', async () => {
      const response = await call(
        'UteamupContractorBidAccept',
        { bidGuid: MISSING_GUID },
        errorReply(-32000, 'Bid not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Bid not found');
    });

    test('returns error when bid is already accepted', async () => {
      const response = await call(
        'UteamupContractorBidAccept',
        { bidGuid: BID_GUID },
        errorReply(-32000, 'Bid has already been accepted')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already been accepted');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupContractorProfileList', args: { page: 1, pageSize: 10 } },
    { name: 'UteamupContractorProfileGet', args: { profileGuid: PROFILE_GUID } },
    { name: 'UteamupContractorAssignmentList', args: { workOrderGuid: WORK_ORDER_GUID } },
    { name: 'UteamupContractorAssign', args: { model: { workOrderGuid: WORK_ORDER_GUID, contractorProfileGuid: PROFILE_GUID } } },
    { name: 'UteamupContractorBidList', args: { workOrderGuid: WORK_ORDER_GUID } },
    { name: 'UteamupContractorBidAccept', args: { bidGuid: BID_GUID } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
