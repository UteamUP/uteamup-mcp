/**
 * Vendor Portal MCP tool tests
 *
 * Tests that Vendor Portal MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupVendorAnalyticsDashboard(vendorId)
 *   UteamupVendorAnalyticsLeaderboard(top)
 *   UteamupVendorComplianceSummary(vendorId)
 *   UteamupVendorComplianceDocumentList(vendorId)
 *   UteamupVendorComplianceExpiring(daysAhead)
 *   UteamupVendorMessageSend(model)
 *   UteamupVendorMessageList(vendorId, page, pageSize)
 *   UteamupVendorMessageUnreadCount(vendorId)
 *   UteamupVendorMatchVendors(model)
 *   UteamupVendorMatchGet(workOrderId)
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Vendor Portal MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_vendor_portal';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockDashboard = {
    vendorId: 1,
    vendorName: 'Acme Services',
    activeWorkOrders: 12,
    completedWorkOrders: 85,
    averageResponseTime: '2.5 hours',
    averageCompletionTime: '4.2 hours',
    overallRating: 4.7,
    revenueThisMonth: 12500.00,
    revenueLastMonth: 11800.00,
    complianceScore: 95,
    pendingBids: 3
  };

  const mockLeaderboardEntry = {
    rank: 1,
    vendorId: 1,
    vendorName: 'Acme Services',
    overallScore: 95.2,
    completedWorkOrders: 85,
    averageRating: 4.7,
    complianceScore: 98
  };

  const mockComplianceSummary = {
    vendorId: 1,
    overallStatus: 'Compliant',
    totalDocuments: 15,
    validDocuments: 14,
    expiredDocuments: 1,
    expiringDocuments: 2,
    lastAuditDate: '2026-02-15T00:00:00Z',
    nextAuditDate: '2026-05-15T00:00:00Z'
  };

  const mockComplianceDocument = {
    id: 1,
    vendorId: 1,
    documentName: 'General Liability Insurance',
    documentType: 'Insurance',
    status: 'Valid',
    issuedDate: '2026-01-01T00:00:00Z',
    expiryDate: '2027-01-01T00:00:00Z',
    uploadedAt: '2026-01-05T10:00:00Z'
  };

  const mockMessage = {
    id: 1,
    vendorId: 1,
    senderId: 'user-guid-123',
    senderName: 'John Smith',
    subject: 'Work Order Update',
    body: 'The scheduled maintenance has been moved to next week.',
    isRead: false,
    sentAt: '2026-03-01T14:00:00Z'
  };

  const mockMessageList = {
    items: [mockMessage],
    totalCount: 1,
    page: 1,
    pageSize: 10
  };

  const mockMatchResult = {
    workOrderId: 100,
    matches: [
      {
        vendorId: 1,
        vendorName: 'Acme Services',
        matchScore: 92,
        matchReasons: ['Specialization match', 'High rating', 'Available'],
        estimatedCost: 450.00,
        estimatedResponseTime: '1 hour'
      },
      {
        vendorId: 2,
        vendorName: 'BetaFix Inc',
        matchScore: 78,
        matchReasons: ['Specialization match', 'Good rating'],
        estimatedCost: 520.00,
        estimatedResponseTime: '3 hours'
      }
    ]
  };

  // ---------------------------------------------------------------------------
  // UteamupVendorAnalyticsDashboard
  // ---------------------------------------------------------------------------
  describe('UteamupVendorAnalyticsDashboard tool', () => {
    test('returns analytics dashboard for a vendor', async () => {
      const response = await call(
        'UteamupVendorAnalyticsDashboard',
        { vendorId: 1 },
        successReply(mockDashboard)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.vendorName).toBe('Acme Services');
      expect(data.activeWorkOrders).toBe(12);
      expect(data.overallRating).toBe(4.7);
      expect(data.complianceScore).toBe(95);
    });

    test('returns error when vendor not found', async () => {
      const response = await call(
        'UteamupVendorAnalyticsDashboard',
        { vendorId: 99999 },
        errorReply(-32000, 'Vendor not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Vendor not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorAnalyticsLeaderboard
  // ---------------------------------------------------------------------------
  describe('UteamupVendorAnalyticsLeaderboard tool', () => {
    test('returns top vendors leaderboard', async () => {
      const response = await call(
        'UteamupVendorAnalyticsLeaderboard',
        { top: 10 },
        successReply([mockLeaderboardEntry])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].rank).toBe(1);
      expect(data[0].overallScore).toBe(95.2);
    });

    test('returns empty leaderboard when no vendors exist', async () => {
      const response = await call(
        'UteamupVendorAnalyticsLeaderboard',
        { top: 10 },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorComplianceSummary
  // ---------------------------------------------------------------------------
  describe('UteamupVendorComplianceSummary tool', () => {
    test('returns compliance summary for a vendor', async () => {
      const response = await call(
        'UteamupVendorComplianceSummary',
        { vendorId: 1 },
        successReply(mockComplianceSummary)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallStatus).toBe('Compliant');
      expect(data.totalDocuments).toBe(15);
      expect(data.expiredDocuments).toBe(1);
    });

    test('returns error when vendor not found', async () => {
      const response = await call(
        'UteamupVendorComplianceSummary',
        { vendorId: 99999 },
        errorReply(-32000, 'Vendor not found')
      );

      expect(response.body.error).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorComplianceDocumentList
  // ---------------------------------------------------------------------------
  describe('UteamupVendorComplianceDocumentList tool', () => {
    test('returns compliance documents for a vendor', async () => {
      const response = await call(
        'UteamupVendorComplianceDocumentList',
        { vendorId: 1 },
        successReply([mockComplianceDocument])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].documentName).toBe('General Liability Insurance');
      expect(data[0].status).toBe('Valid');
    });

    test('returns empty list when no documents exist', async () => {
      const response = await call(
        'UteamupVendorComplianceDocumentList',
        { vendorId: 999 },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorComplianceExpiring
  // ---------------------------------------------------------------------------
  describe('UteamupVendorComplianceExpiring tool', () => {
    test('returns documents expiring within specified days', async () => {
      const expiringDoc = {
        ...mockComplianceDocument,
        id: 2,
        documentName: 'Workers Comp Insurance',
        expiryDate: '2026-03-15T00:00:00Z',
        daysUntilExpiry: 9
      };

      const response = await call(
        'UteamupVendorComplianceExpiring',
        { daysAhead: 30 },
        successReply([expiringDoc])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].daysUntilExpiry).toBe(9);
    });

    test('returns empty list when no documents are expiring', async () => {
      const response = await call(
        'UteamupVendorComplianceExpiring',
        { daysAhead: 7 },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorMessageSend
  // ---------------------------------------------------------------------------
  describe('UteamupVendorMessageSend tool', () => {
    test('sends a message to a vendor successfully', async () => {
      const response = await call(
        'UteamupVendorMessageSend',
        { model: { vendorId: 1, subject: 'Work Order Update', body: 'Maintenance moved to next week.' } },
        successReply(mockMessage)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.subject).toBe('Work Order Update');
      expect(data.vendorId).toBe(1);
    });

    test('returns validation error when subject is missing', async () => {
      const response = await call(
        'UteamupVendorMessageSend',
        { model: { vendorId: 1, body: 'Some message' } },
        errorReply(-32602, 'Subject is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Subject');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorMessageList
  // ---------------------------------------------------------------------------
  describe('UteamupVendorMessageList tool', () => {
    test('returns paginated messages for a vendor', async () => {
      const response = await call(
        'UteamupVendorMessageList',
        { vendorId: 1, page: 1, pageSize: 10 },
        successReply(mockMessageList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(data.items[0].subject).toBe('Work Order Update');
    });

    test('returns empty list when no messages exist', async () => {
      const emptyList = { items: [], totalCount: 0, page: 1, pageSize: 10 };

      const response = await call(
        'UteamupVendorMessageList',
        { vendorId: 999, page: 1, pageSize: 10 },
        successReply(emptyList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorMessageUnreadCount
  // ---------------------------------------------------------------------------
  describe('UteamupVendorMessageUnreadCount tool', () => {
    test('returns unread message count for a vendor', async () => {
      const response = await call(
        'UteamupVendorMessageUnreadCount',
        { vendorId: 1 },
        successReply({ vendorId: 1, unreadCount: 5 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.unreadCount).toBe(5);
      expect(data.vendorId).toBe(1);
    });

    test('returns zero when no unread messages', async () => {
      const response = await call(
        'UteamupVendorMessageUnreadCount',
        { vendorId: 1 },
        successReply({ vendorId: 1, unreadCount: 0 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.unreadCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorMatchVendors
  // ---------------------------------------------------------------------------
  describe('UteamupVendorMatchVendors tool', () => {
    test('returns matched vendors for criteria', async () => {
      const response = await call(
        'UteamupVendorMatchVendors',
        { model: { workOrderId: 100, specializations: ['Electrical'], maxBudget: 1000 } },
        successReply(mockMatchResult)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.matches).toHaveLength(2);
      expect(data.matches[0].matchScore).toBe(92);
      expect(data.matches[0].vendorName).toBe('Acme Services');
    });

    test('returns error when no matching vendors found', async () => {
      const response = await call(
        'UteamupVendorMatchVendors',
        { model: { workOrderId: 100, specializations: ['Nuclear'], maxBudget: 10 } },
        errorReply(-32000, 'No matching vendors found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No matching vendors found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorMatchGet
  // ---------------------------------------------------------------------------
  describe('UteamupVendorMatchGet tool', () => {
    test('returns existing match results for a work order', async () => {
      const response = await call(
        'UteamupVendorMatchGet',
        { workOrderId: 100 },
        successReply(mockMatchResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.workOrderId).toBe(100);
      expect(data.matches).toHaveLength(2);
    });

    test('returns error when no match exists for work order', async () => {
      const response = await call(
        'UteamupVendorMatchGet',
        { workOrderId: 99999 },
        errorReply(-32000, 'No vendor match found for this work order')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No vendor match found');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupVendorAnalyticsDashboard', args: { vendorId: 1 } },
    { name: 'UteamupVendorAnalyticsLeaderboard', args: { top: 10 } },
    { name: 'UteamupVendorComplianceSummary', args: { vendorId: 1 } },
    { name: 'UteamupVendorComplianceDocumentList', args: { vendorId: 1 } },
    { name: 'UteamupVendorComplianceExpiring', args: { daysAhead: 30 } },
    { name: 'UteamupVendorMessageSend', args: { model: { vendorId: 1, subject: 'Test', body: 'Test message' } } },
    { name: 'UteamupVendorMessageList', args: { vendorId: 1, page: 1, pageSize: 10 } },
    { name: 'UteamupVendorMessageUnreadCount', args: { vendorId: 1 } },
    { name: 'UteamupVendorMatchVendors', args: { model: { workOrderId: 100, specializations: ['Electrical'] } } },
    { name: 'UteamupVendorMatchGet', args: { workOrderId: 100 } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
