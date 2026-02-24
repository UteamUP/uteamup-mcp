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
 *   UteamupLabourRateUpdateModifier(id, name, rateDefinitionType, rateValue, ...)
 *   UteamupLabourRateDeleteModifier(id)
 *
 * Pattern mirrors tenant-holidays.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');

describe('Labour Rate MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_labour_rate';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  // ---------------------------------------------------------------------------
  // Helper: send a JSON-RPC 2.0 tools/call to /mcp
  // ---------------------------------------------------------------------------
  function callMcpTool(toolName, toolArgs, mockReply) {
    nock(BASE_URL)
      .post('/mcp', body => body.method === 'tools/call' && body.params?.name === toolName)
      .reply(mockReply.status, JSON.stringify(mockReply.body), {
        'Content-Type': 'application/json'
      });

    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id: Math.floor(Math.random() * 10000)
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(request);
      const req = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch {
            resolve({ status: res.statusCode, body: responseData });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

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
      skillId: null, skillName: null, certificateId: null, certificateName: null,
      hourlyRate: 50.00, currencyId: 1, currencyCode: 'GBP', currencySymbol: '£',
      isActive: true
    },
    {
      id: 2, rateType: 1, roleId: null, roleName: null,
      skillId: 5, skillName: 'High Voltage', certificateId: null, certificateName: null,
      hourlyRate: 65.00, currencyId: 1, currencyCode: 'GBP', currencySymbol: '£',
      isActive: true
    }
  ];

  const modifier = {
    id: 10,
    name: 'Weekend Surcharge',
    description: '1.5x rate on weekends',
    daysOfWeekMask: 65,  // Sun=1 + Sat=64
    startTime: null, endTime: null,
    appliesToHolidays: false,
    scopeType: null, scopeRoleId: null, scopeRoleName: null,
    scopeSkillId: null, scopeSkillName: null,
    scopeCertificateId: null, scopeCertificateName: null,
    rateDefinitionType: 0,  // Multiplier
    rateValue: 1.5,
    currencyId: null, currencyCode: null, currencySymbol: null,
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
      const response = await callMcpTool(
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

      const response = await callMcpTool(
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
      const response = await callMcpTool(
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
      const response = await callMcpTool(
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

    test('returns 403 when LaborCost.All permission is missing', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateGetRules',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: LaborCost.All required' },
            id: 5
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('LaborCost.All');
    });

    test('returns empty array when no rules are configured', async () => {
      const response = await callMcpTool(
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
      const response = await callMcpTool(
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
      const response = await callMcpTool(
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

      const response = await callMcpTool(
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

      const response = await callMcpTool(
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
      const response = await callMcpTool(
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
      const response = await callMcpTool(
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
      const response = await callMcpTool(
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

      const response = await callMcpTool(
        'UteamupLabourRateUpdateModifier',
        {
          id: 10,
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

    test('returns error for invalid id (0)', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateUpdateModifier',
        { id: 0, name: 'Test', rateDefinitionType: 0, rateValue: 1.5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id must be greater than 0' },
            id: 15
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Id must be greater than 0');
    });

    test('returns error when modifier not found', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateUpdateModifier',
        { id: 99999, name: 'Test', rateDefinitionType: 0, rateValue: 1.5 },
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
      const response = await callMcpTool(
        'UteamupLabourRateDeleteModifier',
        { id: 10 },
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

    test('returns error for non-existent modifier id', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateDeleteModifier',
        { id: 99999999 },
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

    test('returns error for invalid id (0)', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateDeleteModifier',
        { id: 0 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id must be greater than 0' },
            id: 19
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Id must be greater than 0');
    });

    test('returns 403 when LaborCost.All permission is missing', async () => {
      const response = await callMcpTool(
        'UteamupLabourRateDeleteModifier',
        { id: 10 },
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
});
