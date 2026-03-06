/**
 * Contractor MCP tool tests
 *
 * Tests that Contractor MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupContractorProfileList(page, pageSize)
 *   UteamupContractorProfileGet(profileId)
 *   UteamupContractorAssignmentList(workOrderId)
 *   UteamupContractorAssign(model)
 *   UteamupContractorBidList(workOrderId)
 *   UteamupContractorBidAccept(bidId)
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Contractor MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_contractor';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockProfile = {
    id: 1,
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
    id: 1,
    workOrderId: 100,
    contractorProfileId: 1,
    contractorName: 'ProFix Contractors',
    status: 'Accepted',
    assignedAt: '2026-03-01T09:00:00Z',
    startedAt: '2026-03-01T10:00:00Z',
    completedAt: null
  };

  const mockBid = {
    id: 1,
    workOrderId: 100,
    contractorProfileId: 1,
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
    test('returns a single contractor profile by id', async () => {
      const response = await call(
        'UteamupContractorProfileGet',
        { profileId: 1 },
        successReply(mockProfile)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(1);
      expect(data.companyName).toBe('ProFix Contractors');
      expect(data.specializations).toContain('Electrical');
      expect(data.hourlyRate).toBe(85.00);
    });

    test('returns error when profile not found', async () => {
      const response = await call(
        'UteamupContractorProfileGet',
        { profileId: 99999 },
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
        { workOrderId: 100 },
        successReply([mockAssignment])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].workOrderId).toBe(100);
      expect(data[0].status).toBe('Accepted');
    });

    test('returns empty list when no contractors are assigned', async () => {
      const response = await call(
        'UteamupContractorAssignmentList',
        { workOrderId: 999 },
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
        { model: { workOrderId: 100, contractorProfileId: 1, notes: 'Urgent repair' } },
        successReply(mockAssignment)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.workOrderId).toBe(100);
      expect(data.contractorProfileId).toBe(1);
      expect(data.status).toBe('Accepted');
    });

    test('returns validation error when workOrderId is missing', async () => {
      const response = await call(
        'UteamupContractorAssign',
        { model: { contractorProfileId: 1 } },
        errorReply(-32602, 'WorkOrderId is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkOrderId');
    });

    test('returns validation error when contractorProfileId is invalid', async () => {
      const response = await call(
        'UteamupContractorAssign',
        { model: { workOrderId: 100, contractorProfileId: 0 } },
        errorReply(-32602, 'ContractorProfileId must be greater than 0')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ContractorProfileId');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupContractorBidList
  // ---------------------------------------------------------------------------
  describe('UteamupContractorBidList tool', () => {
    test('returns bids for a work order', async () => {
      const response = await call(
        'UteamupContractorBidList',
        { workOrderId: 100 },
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
        { workOrderId: 999 },
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
        { bidId: 1 },
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
        { bidId: 99999 },
        errorReply(-32000, 'Bid not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Bid not found');
    });

    test('returns error when bid is already accepted', async () => {
      const response = await call(
        'UteamupContractorBidAccept',
        { bidId: 1 },
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
    { name: 'UteamupContractorProfileGet', args: { profileId: 1 } },
    { name: 'UteamupContractorAssignmentList', args: { workOrderId: 100 } },
    { name: 'UteamupContractorAssign', args: { model: { workOrderId: 100, contractorProfileId: 1 } } },
    { name: 'UteamupContractorBidList', args: { workOrderId: 100 } },
    { name: 'UteamupContractorBidAccept', args: { bidId: 1 } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
