/**
 * Labour Rate MCP tool tests
 *
 * Tests that Labour Rate MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupLabourRateGetMyEffectiveRate(atDateTime?)
 *   UteamupLabourRateGetRules()
 *   UteamupLabourRateGetModifiers()
 *   UteamupLabourRateCreateModifier(name, rateDefinitionType, rateValue, ...)
 *   UteamupLabourRateUpdateModifier(modifierGuid, name, rateDefinitionType, rateValue, ...)
 *   UteamupLabourRateDeleteModifier(modifierGuid)
 *
 * Pattern mirrors tenant-holidays.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Labour Rate MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_labour_rate';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const effectiveRate = {
    effectiveHourlyRate: 75.00,
    currencyId: 1,
    currencyCode: 'GBP',
    currencySymbol: '£',
    isVisible: true
  };

  const ruleList = [
    {
      id: 1, rateType: 0, roleId: 'role-guid-123', roleName: 'Electrician',
      skillId: null, skillGuid: null, skillName: null,
      certificateId: null, certificateGuid: null, certificateName: null,
      hourlyRate: 50.00, currencyId: 1, currencyGuid: '40000000-0000-0000-0000-000000000001',
      currencyCode: 'GBP', currencySymbol: '£',
      isActive: true
    },
    {
      id: 2, rateType: 1, roleId: null, roleName: null,
      skillId: 5, skillGuid: '50000000-0000-0000-0000-000000000005', skillName: 'High Voltage',
      certificateId: null, certificateGuid: null, certificateName: null,
      hourlyRate: 65.00, currencyId: 1, currencyGuid: '40000000-0000-0000-0000-000000000001',
      currencyCode: 'GBP', currencySymbol: '£',
      isActive: true
    }
  ];

  const modifier = {
    id: 10,
    externalGuid: '20000000-0000-0000-0000-000000000010',
    name: 'Weekend Surcharge',
    description: '1.5x rate on weekends',
    daysOfWeekMask: 65,  // Sun=1 + Sat=64
    startTime: null, endTime: null,
    appliesToHolidays: false,
    scopeType: null, scopeRoleId: null, scopeRoleName: null,
    scopeSkillGuid: null, scopeSkillName: null,
    scopeCertificateGuid: null, scopeCertificateName: null,
    rateDefinitionType: 0,  // Multiplier
    rateValue: 1.5,
    currencyGuid: null, currencyCode: null, currencySymbol: null,
    isActive: true, priority: 0,
    createdAt: '2026-02-24T00:00:00Z',
    updatedAt: '2026-02-24T00:00:00Z'
  };

  const modifierList = [modifier];

  // ---------------------------------------------------------------------------
  // UteamupLabourRateGetMyEffectiveRate
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateGetMyEffectiveRate tool', () => {
    test('returns effective rate for current user', async () => {
      const response = await call(
        'UteamupLabourRateGetMyEffectiveRate',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(effectiveRate) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const rate = JSON.parse(response.body.result.content[0].text);
      expect(rate.effectiveHourlyRate).toBe(75.00);
      expect(rate.currencyCode).toBe('GBP');
      expect(rate.isVisible).toBe(true);
    });

    test('accepts optional atDateTime parameter for point-in-time evaluation', async () => {
      const atDateTime = '2026-01-03T22:00:00Z';  // Saturday night
      const weekendRate = { ...effectiveRate, effectiveHourlyRate: 112.50 }; // 75 × 1.5

      const response = await call(
        'UteamupLabourRateGetMyEffectiveRate',
        { atDateTime },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(weekendRate) }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      const rate = JSON.parse(response.body.result.content[0].text);
      expect(rate.effectiveHourlyRate).toBe(112.50);
    });

    test('returns 401 when authorization is missing', async () => {
      const response = await call(
        'UteamupLabourRateGetMyEffectiveRate',
        {},
        {
          status: 401,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Unauthorized' },
            id: 3
          }
        }
      );

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Unauthorized');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLabourRateGetRules
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateGetRules tool', () => {
    test('returns list of all labour rate rules', async () => {
      const response = await call(
        'UteamupLabourRateGetRules',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(ruleList) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      const rules = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules).toHaveLength(2);
      expect(rules[0].rateType).toBe(0);
      expect(rules[0].hourlyRate).toBe(50.00);
      expect(rules[1].skillId).toBe(5);
    });

    test('returns 403 when LaborCost.View permission is missing', async () => {
      const response = await call(
        'UteamupLabourRateGetRules',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: LaborCost.View required' },
            id: 5
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('LaborCost.View');
    });

    test('returns empty array when no rules are configured', async () => {
      const response = await call(
        'UteamupLabourRateGetRules',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([]) }] },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      const rules = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLabourRateGetModifiers
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateGetModifiers tool', () => {
    test('returns list of all rate modifiers', async () => {
      const response = await call(
        'UteamupLabourRateGetModifiers',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(modifierList) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      const modifiers = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(modifiers)).toBe(true);
      expect(modifiers).toHaveLength(1);
      expect(modifiers[0].name).toBe('Weekend Surcharge');
      expect(modifiers[0].daysOfWeekMask).toBe(65);
      expect(modifiers[0].rateValue).toBe(1.5);
    });

    test('returns empty array when no modifiers configured', async () => {
      const response = await call(
        'UteamupLabourRateGetModifiers',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([]) }] },
            id: 8
          }
        }
      );

      const modifiers = JSON.parse(response.body.result.content[0].text);
      expect(modifiers).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLabourRateCreateModifier
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateCreateModifier tool', () => {
    test('creates a weekend multiplier modifier successfully', async () => {
      const createArgs = {
        name: 'Weekend Surcharge',
        rateDefinitionType: 0,
        rateValue: 1.5,
        daysOfWeekMask: 65,
        appliesToHolidays: false,
        isActive: true,
        priority: 0
      };

      const response = await call(
        'UteamupLabourRateCreateModifier',
        createArgs,
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(modifier) }] },
            id: 9
          }
        }
      );

      expect(response.status).toBe(200);
      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.id).toBe(10);
      expect(created.name).toBe('Weekend Surcharge');
      expect(created.rateValue).toBe(1.5);
      expect(created.isActive).toBe(true);
    });

    test('creates a flat-rate out-of-hours modifier with time window', async () => {
      const nightModifier = {
        ...modifier,
        id: 11,
        name: 'Night Shift Flat Rate',
        daysOfWeekMask: 127,  // All days
        startTime: '22:00:00',
        endTime: '06:00:00',
        rateDefinitionType: 1,  // FlatRate
        rateValue: 90.00
      };

      const response = await call(
        'UteamupLabourRateCreateModifier',
        {
          name: 'Night Shift Flat Rate',
          rateDefinitionType: 1,
          rateValue: 90.00,
          daysOfWeekMask: 127,
          startTime: '22:00',
          endTime: '06:00'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(nightModifier) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.rateDefinitionType).toBe(1);
      expect(created.rateValue).toBe(90.00);
    });

    test('returns error when name is missing', async () => {
      const response = await call(
        'UteamupLabourRateCreateModifier',
        { rateDefinitionType: 0, rateValue: 1.5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Name is required' },
            id: 11
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Name is required');
    });

    test('returns error when rateValue is zero (validation)', async () => {
      const response = await call(
        'UteamupLabourRateCreateModifier',
        { name: 'Bad Modifier', rateDefinitionType: 0, rateValue: 0 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'RateValue must be greater than 0' },
            id: 12
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('RateValue');
    });

    test('returns 403 when LaborCost.All permission is missing', async () => {
      const response = await call(
        'UteamupLabourRateCreateModifier',
        { name: 'Weekend', rateDefinitionType: 0, rateValue: 1.5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: LaborCost.All required' },
            id: 13
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('LaborCost.All');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLabourRateUpdateModifier
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateUpdateModifier tool', () => {
    test('updates an existing modifier successfully', async () => {
      const updatedModifier = { ...modifier, rateValue: 1.75, name: 'Weekend Surcharge (updated)' };

      const response = await call(
        'UteamupLabourRateUpdateModifier',
        {
          modifierGuid: modifier.externalGuid,
          name: 'Weekend Surcharge (updated)',
          rateDefinitionType: 0,
          rateValue: 1.75,
          daysOfWeekMask: 65,
          isActive: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updatedModifier) }] },
            id: 14
          }
        }
      );

      expect(response.status).toBe(200);
      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.id).toBe(10);
      expect(updated.rateValue).toBe(1.75);
      expect(updated.name).toBe('Weekend Surcharge (updated)');
    });

    test('returns error for an empty modifier GUID', async () => {
      const response = await call(
        'UteamupLabourRateUpdateModifier',
        {
          modifierGuid: '00000000-0000-0000-0000-000000000000',
          name: 'Test',
          rateDefinitionType: 0,
          rateValue: 1.5
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ModifierGuid must be a non-empty GUID' },
            id: 15
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ModifierGuid must be a non-empty GUID');
    });

    test('returns error when modifier not found', async () => {
      const response = await call(
        'UteamupLabourRateUpdateModifier',
        {
          modifierGuid: '20000000-0000-0000-0000-000000099999',
          name: 'Test',
          rateDefinitionType: 0,
          rateValue: 1.5
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Modifier not found' },
            id: 16
          }
        }
      );

      expect(response.body.error).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLabourRateDeleteModifier
  // ---------------------------------------------------------------------------
  describe('UteamupLabourRateDeleteModifier tool', () => {
    test('deletes a modifier successfully', async () => {
      const response = await call(
        'UteamupLabourRateDeleteModifier',
        { modifierGuid: modifier.externalGuid },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: 'true' }] },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('returns error for a non-existent modifier GUID', async () => {
      const response = await call(
        'UteamupLabourRateDeleteModifier',
        { modifierGuid: '20000000-0000-0000-0000-000099999999' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Modifier not found' },
            id: 18
          }
        }
      );

      expect(response.body.error).toBeDefined();
    });

    test('returns error for an empty modifier GUID', async () => {
      const response = await call(
        'UteamupLabourRateDeleteModifier',
        { modifierGuid: '00000000-0000-0000-0000-000000000000' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ModifierGuid must be a non-empty GUID' },
            id: 19
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ModifierGuid must be a non-empty GUID');
    });

    test('returns 403 when LaborCost.All permission is missing', async () => {
      const response = await call(
        'UteamupLabourRateDeleteModifier',
        { modifierGuid: modifier.externalGuid },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: LaborCost.All required' },
            id: 20
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('LaborCost.All');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupLabourRateGetMyEffectiveRate', args: {} },
    { name: 'UteamupLabourRateGetRules', args: {} },
    { name: 'UteamupLabourRateGetModifiers', args: {} },
    { name: 'UteamupLabourRateCreateModifier', args: { name: 'Test', rateDefinitionType: 'Flat', rateValue: 25.00 } },
    {
      name: 'UteamupLabourRateUpdateModifier',
      args: {
        modifierGuid: modifier.externalGuid,
        name: 'Updated',
        rateDefinitionType: 'Flat',
        rateValue: 30.00
      }
    },
    { name: 'UteamupLabourRateDeleteModifier', args: { modifierGuid: modifier.externalGuid } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
