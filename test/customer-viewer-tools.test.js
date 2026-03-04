/**
 * Customer Viewer Extension MCP tool tests
 *
 * Tests that Customer Viewer MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupExtensionCustomerViewerList(page?, pageSize?, query?)
 *   UteamupExtensionCustomerViewerStats()
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Customer Viewer Extension MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_customer_viewer';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const customerList = [
    { id: 1, name: 'Acme Corp', type: 'Enterprise', email: 'info@acme.com', phoneNumber: '+1-555-0100', isActive: true, isCostCenter: false, hourlyRate: 150, currencyCode: 'USD' },
    { id: 2, name: 'Small Biz LLC', type: 'Small Business', email: 'hello@smallbiz.com', phoneNumber: '+1-555-0200', isActive: true, isCostCenter: true, hourlyRate: 75, currencyCode: 'USD' }
  ];

  const paginatedCustomerList = {
    items: customerList,
    totalCount: 42,
    page: 1,
    pageSize: 25,
    totalPages: 2,
    hasNext: true,
    hasPrevious: false
  };

  const customerStats = {
    totalCustomers: 42,
    activeCustomers: 38,
    inactiveCustomers: 4,
    costCenterCustomers: 12,
    byType: { 'Enterprise': 15, 'Small Business': 20, 'Government': 7 },
    averageHourlyRate: 95.5
  };

  // ---------------------------------------------------------------------------
  // UteamupExtensionCustomerViewerList
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionCustomerViewerList tool', () => {
    test('returns customer list with pagination', async () => {
      const response = await call(
        'UteamupExtensionCustomerViewerList',
        { page: 1, pageSize: 25 },
        successReply(paginatedCustomerList)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(2);
      expect(data.totalCount).toBe(42);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(25);
      expect(data.totalPages).toBe(2);
      expect(data.hasNext).toBe(true);
      expect(data.hasPrevious).toBe(false);
      expect(data.items[0].name).toBe('Acme Corp');
      expect(data.items[0].type).toBe('Enterprise');
      expect(data.items[1].name).toBe('Small Biz LLC');
      expect(data.items[1].isCostCenter).toBe(true);
    });

    test('returns customer list filtered by search query', async () => {
      const filteredResult = {
        items: [customerList[0]],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false
      };

      const response = await call(
        'UteamupExtensionCustomerViewerList',
        { query: 'Acme', page: 1, pageSize: 25 },
        successReply(filteredResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe('Acme Corp');
      expect(data.totalCount).toBe(1);
    });

    test('returns empty result when no matches', async () => {
      const emptyResult = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
      };

      const response = await call(
        'UteamupExtensionCustomerViewerList',
        { query: 'nonexistent_xyz_987' },
        successReply(emptyResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(0);
      expect(data.totalCount).toBe(0);
      expect(data.totalPages).toBe(0);
    });

    test('returns error when extension not installed', async () => {
      const response = await call(
        'UteamupExtensionCustomerViewerList',
        { page: 1 },
        errorReply(-32602, 'Extension com.uteamup.customer-viewer is not installed on this tenant')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('not installed');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupExtensionCustomerViewerStats
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionCustomerViewerStats tool', () => {
    test('returns customer statistics', async () => {
      const response = await call(
        'UteamupExtensionCustomerViewerStats',
        {},
        successReply(customerStats)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCustomers).toBe(42);
      expect(data.activeCustomers).toBe(38);
      expect(data.inactiveCustomers).toBe(4);
      expect(data.costCenterCustomers).toBe(12);
      expect(data.byType).toEqual({ 'Enterprise': 15, 'Small Business': 20, 'Government': 7 });
      expect(data.averageHourlyRate).toBe(95.5);
    });

    test('returns error when extension not installed', async () => {
      const response = await call(
        'UteamupExtensionCustomerViewerStats',
        {},
        errorReply(-32602, 'Extension com.uteamup.customer-viewer is not installed on this tenant')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('not installed');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance (all tools)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupExtensionCustomerViewerList', args: { page: 1, pageSize: 25 } },
    { name: 'UteamupExtensionCustomerViewerStats', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);

  // ---------------------------------------------------------------------------
  // 401 Unauthorized (all tools)
  // ---------------------------------------------------------------------------
  describe401Unauthorized(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // 503 Service Unavailable (all tools)
  // ---------------------------------------------------------------------------
  describe503ServiceUnavailable(BASE_URL, allTools);
});
