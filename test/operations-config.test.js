'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Operations configuration and work order usage MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'operations-config-token';
  const templateGuid = '2b7f0c1e-4a51-4d0b-9c4f-6f8f7c1d2e31';
  const prefixGuid = '5c3d9e2a-7b14-4e8f-a1c6-0d2b3f4a5e62';
  const usageGuid = '8e1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a74';
  const workorderGuid = '3f2a7c52-9e8c-4a0c-8d71-8f5aa4b6f112';
  const toolGuid = '11111111-1111-4111-8111-111111111111';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  describe('inspection templates', () => {
    test('lists templates with public GUIDs only', async () => {
      const response = await call(
        'uteamup_inspection_template_list', {},
        successReply([{ externalGuid: templateGuid, name: 'Pre-trip', isSystemTemplate: true }]), {},
      );

      const [template] = parse(response);
      expect(template.externalGuid).toBe(templateGuid);
      expect(template).not.toHaveProperty('id');
    });

    test('returns an empty list when the tenant has no templates', async () => {
      const response = await call('uteamup_inspection_template_list', {}, successReply([]), {});
      expect(parse(response)).toEqual([]);
    });

    test('gets one template by GUID', async () => {
      const args = { templateGuid };
      const response = await call(
        'uteamup_inspection_template_get', args,
        successReply({ externalGuid: templateGuid, name: 'Pre-trip', items: [] }), args,
      );

      expect(parse(response).items).toEqual([]);
    });
  });

  describe('work order prefixes', () => {
    test('forwards includeInactive verbatim', async () => {
      const args = { includeInactive: true };
      const response = await call(
        'uteamup_workorder_prefix_list', args,
        successReply([{ guid: prefixGuid, prefix: 'INC', isActive: false }]), args,
      );

      expect(parse(response)[0].prefix).toBe('INC');
    });

    test('gets one prefix by GUID', async () => {
      const args = { prefixGuid };
      const response = await call(
        'uteamup_workorder_prefix_get', args, successReply({ guid: prefixGuid, prefix: 'PRE' }), args,
      );

      expect(parse(response).guid).toBe(prefixGuid);
    });

    test('preserves not-found errors for prefixes outside the tenant', async () => {
      const response = await call(
        'uteamup_workorder_prefix_get', { prefixGuid },
        errorReply(-32602, 'not_found: The work order prefix was not found in the current tenant.'),
      );

      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('current tenant');
    });
  });

  describe('work order tool usage', () => {
    test('forwards paging arguments verbatim', async () => {
      const args = { page: 2, pageSize: 50 };
      const response = await call(
        'uteamup_workorder_tool_usage_list', args,
        successReply({ items: [], currentPage: 2, pageSize: 50, totalItems: 0, totalPages: 0 }), args,
      );

      expect(parse(response).items).toEqual([]);
    });

    test('updates a record with the full body and no tenant or user scope arguments', async () => {
      const args = {
        usageGuid, workorderGuid, toolGuid,
        startTime: '2026-11-01T08:00:00Z', durationMinutes: 90, rateType: 'Hourly', rentalRate: 40,
      };
      const response = await call(
        'uteamup_workorder_tool_usage_update', args,
        successReply({ guid: usageGuid, workorderGuid, toolGuid, totalCost: 60 }), args,
      );

      expect(parse(response).totalCost).toBe(60);
      expect(args).not.toHaveProperty('tenantId');
      expect(args).not.toHaveProperty('tenantGuid');
    });

    test('preserves validation errors', async () => {
      const response = await call(
        'uteamup_workorder_tool_usage_list', { page: 1, pageSize: 500 },
        errorReply(-32602, 'invalid_argument: page must be at least 1 and pageSize between 1 and 100.'),
      );

      expect(response.body.error.message).toContain('pageSize');
    });
  });

  describe('work order energy usage', () => {
    test('updates a record and forwards the enum as sent', async () => {
      const args = { usageGuid, workorderGuid, utilityType: 'electricity', consumption: 120.5, unit: 'kWh' };
      const response = await call(
        'uteamup_workorder_energy_usage_update', args,
        successReply({ guid: usageGuid, workorderGuid, utilityType: 'electricity', consumption: 120.5 }), args,
      );

      expect(parse(response).utilityType).toBe('electricity');
    });

    test('gets one record by GUID', async () => {
      const args = { usageGuid };
      const response = await call(
        'uteamup_workorder_energy_usage_get', args, successReply({ guid: usageGuid }), args,
      );

      expect(parse(response).guid).toBe(usageGuid);
    });
  });

  describe('location tags', () => {
    test('looks up a tag by its scanned value', async () => {
      const args = { tagId: 'NFC-04A1B2' };
      const response = await call(
        'uteamup_location_nfc_tag_get_by_tag_id', args,
        successReply({ externalGuid: toolGuid, tagId: 'NFC-04A1B2', locationName: 'Pump house' }), args,
      );

      expect(parse(response).locationName).toBe('Pump house');
    });

    test('returns an empty list when no tags are registered', async () => {
      const response = await call('uteamup_location_nfc_tag_list', {}, successReply([]), {});
      expect(parse(response)).toEqual([]);
    });
  });

  const tools = [
    { name: 'uteamup_inspection_template_list', args: {} },
    { name: 'uteamup_inspection_template_get', args: { templateGuid } },
    { name: 'uteamup_workorder_prefix_list', args: { includeInactive: false } },
    { name: 'uteamup_workorder_prefix_get', args: { prefixGuid } },
    { name: 'uteamup_workorder_tool_usage_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_workorder_tool_usage_get', args: { usageGuid } },
    {
      name: 'uteamup_workorder_tool_usage_update',
      args: { usageGuid, workorderGuid, toolGuid, startTime: '2026-11-01T08:00:00Z' },
    },
    { name: 'uteamup_workorder_energy_usage_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_workorder_energy_usage_get', args: { usageGuid } },
    {
      name: 'uteamup_workorder_energy_usage_update',
      args: { usageGuid, workorderGuid, utilityType: 'water', consumption: 3 },
    },
    { name: 'uteamup_location_nfc_tag_list', args: {} },
    { name: 'uteamup_location_nfc_tag_get_by_tag_id', args: { tagId: 'QR-1' } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
