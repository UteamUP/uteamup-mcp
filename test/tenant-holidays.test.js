/**
 * Tenant Holidays MCP tool tests
 *
 * Tests that tenant holiday MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupTenantHolidayListByYear(year)
 *   UteamupTenantHolidayCreate(date, name, isNational, countryCode, isRecurringAnnually)
 *   UteamupTenantHolidayUpdate(id, name, isActive)
 *   UteamupTenantHolidayDelete(id)
 *   UteamupTenantHolidayImport(year, countryCode)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Tenant Holidays MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_tenant_holidays';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const holiday = {
    id: 1,
    date: '2026-12-25T00:00:00Z',
    name: 'Christmas Day',
    isNational: true,
    countryCode: 'IS',
    isRecurringAnnually: true,
    isActive: true,
    source: 'Manual'
  };

  const importedHoliday = { ...holiday, source: 'AutoImported' };

  const importResult = {
    imported: 12,
    skipped: 0,
    year: 2026,
    countryCode: 'IS',
    holidays: [
      { date: '2026-01-01T00:00:00Z', name: "New Year's Day", isNational: true },
      { date: '2026-12-25T00:00:00Z', name: 'Christmas Day', isNational: true }
    ]
  };

  // ---------------------------------------------------------------------------
  // UteamupTenantHolidayListByYear
  // ---------------------------------------------------------------------------
  describe('UteamupTenantHolidayListByYear tool', () => {
    test('returns list of holidays for the given year', async () => {
      const mockHolidays = [
        holiday,
        {
          id: 2,
          date: '2026-01-01T00:00:00Z',
          name: "New Year's Day",
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true,
          isActive: true,
          source: 'AutoImported'
        }
      ];

      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockHolidays) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const holidays = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(holidays)).toBe(true);
      expect(holidays.length).toBe(2);
      expect(holidays[0].id).toBe(1);
      expect(holidays[0].name).toBe('Christmas Day');
    });

    test('returns empty array when no holidays exist for the year', async () => {
      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2099 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const holidays = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(holidays)).toBe(true);
      expect(holidays.length).toBe(0);
    });

    test('different years return different holiday sets', async () => {
      const holidays2025 = [
        { id: 10, date: '2025-12-25T00:00:00Z', name: 'Christmas Day', isNational: true, source: 'AutoImported' }
      ];
      const holidays2026 = [
        { id: 11, date: '2026-12-25T00:00:00Z', name: 'Christmas Day', isNational: true, source: 'AutoImported' },
        { id: 12, date: '2026-06-17T00:00:00Z', name: 'National Day', isNational: true, source: 'Manual' }
      ];

      // Call for 2025
      const response2025 = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2025 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holidays2025) }] },
            id: 3
          }
        }
      );

      const result2025 = JSON.parse(response2025.body.result.content[0].text);
      expect(result2025.length).toBe(1);
      expect(result2025[0].date).toBe('2025-12-25T00:00:00Z');

      // Call for 2026
      const response2026 = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holidays2026) }] },
            id: 4
          }
        }
      );

      const result2026 = JSON.parse(response2026.body.result.content[0].text);
      expect(result2026.length).toBe(2);
      expect(result2026[1].name).toBe('National Day');
    });

    test('request includes year in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 5
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupTenantHolidayListByYear',
          arguments: { year: 2026 }
        },
        id: 5
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.year).toBe(2026);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(6);
    });

    test('returns holidays including both national and manual source entries', async () => {
      const mixedHolidays = [
        { ...holiday, source: 'AutoImported' },
        { ...holiday, id: 3, name: 'Company Anniversary', isNational: false, source: 'Manual' }
      ];

      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mixedHolidays) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      const holidays = JSON.parse(response.body.result.content[0].text);
      const nationalHoliday = holidays.find(h => h.isNational === true);
      const manualHoliday = holidays.find(h => h.source === 'Manual');
      expect(nationalHoliday).toBeDefined();
      expect(manualHoliday).toBeDefined();
    });

    test('returns 401 when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupTenantHolidayListByYear', arguments: { year: 2026 } },
          id: 8
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(statusCode).toBe(401);
    });

    test('returns permission error when TenantHoliday.Read permission is missing', async () => {
      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: TenantHoliday.Read required'
            },
            id: 9
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('TenantHoliday.Read');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTenantHolidayCreate
  // ---------------------------------------------------------------------------
  describe('UteamupTenantHolidayCreate tool', () => {
    test('successfully creates a new holiday with all fields', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-12-25',
          name: 'Christmas Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holiday) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.id).toBe(1);
      expect(created.name).toBe('Christmas Day');
      expect(created.isNational).toBe(true);
      expect(created.countryCode).toBe('IS');
      expect(created.isRecurringAnnually).toBe(true);
      expect(created.isActive).toBe(true);
      expect(created.source).toBe('Manual');
    });

    test('returns error when creating a holiday on a date that already exists', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-12-25',
          name: 'Christmas Day Duplicate',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: "A holiday already exists on date '2026-12-25'"
            },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
      expect(response.body.error.message).toContain('2026-12-25');
    });

    test('returns error for invalid date format', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '25-12-2026',
          name: 'Christmas Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Date must be a valid date string in YYYY-MM-DD format'
            },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('returns permission error when TenantHoliday.Create permission is missing', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-12-25',
          name: 'Christmas Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: TenantHoliday.Create required'
            },
            id: 13
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('TenantHoliday.Create');
    });

    test('created holiday has source field set to Manual', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-06-17',
          name: 'National Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  id: 5,
                  date: '2026-06-17T00:00:00Z',
                  name: 'National Day',
                  isNational: true,
                  countryCode: 'IS',
                  isRecurringAnnually: true,
                  isActive: true,
                  source: 'Manual'
                })
              }]
            },
            id: 14
          }
        }
      );

      expect(response.status).toBe(200);
      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.source).toBe('Manual');
    });

    test('isRecurringAnnually is stored correctly when set to true', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-01-01',
          name: "New Year's Day",
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  id: 6,
                  date: '2026-01-01T00:00:00Z',
                  name: "New Year's Day",
                  isNational: true,
                  countryCode: 'IS',
                  isRecurringAnnually: true,
                  isActive: true,
                  source: 'Manual'
                })
              }]
            },
            id: 15
          }
        }
      );

      expect(response.status).toBe(200);
      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.isRecurringAnnually).toBe(true);
    });

    test('request includes all create fields in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(holiday) }] },
          id: 16
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupTenantHolidayCreate',
          arguments: {
            date: '2026-12-25',
            name: 'Christmas Day',
            isNational: true,
            countryCode: 'IS',
            isRecurringAnnually: true
          }
        },
        id: 16
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.date).toBe('2026-12-25');
      expect(capturedBody.params.arguments.name).toBe('Christmas Day');
      expect(capturedBody.params.arguments.isNational).toBe(true);
      expect(capturedBody.params.arguments.countryCode).toBe('IS');
      expect(capturedBody.params.arguments.isRecurringAnnually).toBe(true);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-12-25',
          name: 'Christmas Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holiday) }] },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(17);
    });

    test('national holiday has isNational set to true', async () => {
      const nationalHoliday = {
        id: 20,
        date: '2026-06-17T00:00:00Z',
        name: 'National Day',
        isNational: true,
        countryCode: 'IS',
        isRecurringAnnually: true,
        isActive: true,
        source: 'Manual'
      };

      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-06-17',
          name: 'National Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(nationalHoliday) }] },
            id: 18
          }
        }
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.isNational).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTenantHolidayUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupTenantHolidayUpdate tool', () => {
    test('successfully updates the name of an existing holiday', async () => {
      const updatedHoliday = { ...holiday, name: 'Updated Name' };

      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Updated Name', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updatedHoliday) }] },
            id: 20
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.id).toBe(1);
      expect(updated.name).toBe('Updated Name');
      expect(updated.isActive).toBe(true);
    });

    test('returns error when holiday with given id is not found', async () => {
      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 999999, name: 'Does Not Exist', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Holiday 999999 not found'
            },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('successfully sets isActive to false to deactivate a holiday', async () => {
      const deactivatedHoliday = { ...holiday, isActive: false };

      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Christmas Day', isActive: false },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(deactivatedHoliday) }] },
            id: 22
          }
        }
      );

      expect(response.status).toBe(200);
      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.isActive).toBe(false);
    });

    test('returns permission error when TenantHoliday.Update permission is missing', async () => {
      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Updated Name', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: TenantHoliday.Update required'
            },
            id: 23
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('TenantHoliday.Update');
    });

    test('request includes id, name, and isActive in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(holiday) }] },
          id: 24
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupTenantHolidayUpdate',
          arguments: { id: 1, name: 'Updated Name', isActive: true }
        },
        id: 24
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.id).toBe(1);
      expect(capturedBody.params.arguments.name).toBe('Updated Name');
      expect(capturedBody.params.arguments.isActive).toBe(true);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Christmas Day', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holiday) }] },
            id: 25
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(25);
    });

    test('updated holiday preserves unchanged fields', async () => {
      const updatedHoliday = { ...holiday, name: 'Updated Christmas Day' };

      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Updated Christmas Day', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updatedHoliday) }] },
            id: 26
          }
        }
      );

      const updated = JSON.parse(response.body.result.content[0].text);
      // Fields not passed in the update should be preserved
      expect(updated.isNational).toBe(holiday.isNational);
      expect(updated.countryCode).toBe(holiday.countryCode);
      expect(updated.isRecurringAnnually).toBe(holiday.isRecurringAnnually);
    });

    test('reactivating a holiday sets isActive back to true', async () => {
      const reactivatedHoliday = { ...holiday, isActive: true };

      const response = await call(
        'UteamupTenantHolidayUpdate',
        { id: 1, name: 'Christmas Day', isActive: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(reactivatedHoliday) }] },
            id: 27
          }
        }
      );

      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.isActive).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTenantHolidayDelete
  // ---------------------------------------------------------------------------
  describe('UteamupTenantHolidayDelete tool', () => {
    test('successfully deletes an existing holiday', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ success: true, id: 1 }) }] },
            id: 30
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
    });

    test('returns error when holiday with given id is not found', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: 999999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Holiday 999999 not found'
            },
            id: 31
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when TenantHoliday.Delete permission is missing', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: TenantHoliday.Delete required'
            },
            id: 32
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('TenantHoliday.Delete');
    });

    test('request includes id in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ success: true, id: 5 }) }] },
          id: 33
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupTenantHolidayDelete',
          arguments: { id: 5 }
        },
        id: 33
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.id).toBe(5);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ success: true, id: 1 }) }] },
            id: 34
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(34);
    });

    test('deleting an auto-imported holiday succeeds the same as a manual one', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: 2 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ success: true, id: 2 }) }] },
            id: 35
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.success).toBe(true);
    });

    test('returns 401 when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupTenantHolidayDelete', arguments: { id: 1 } },
          id: 36
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(statusCode).toBe(401);
    });

    test('returns error when attempting to delete a holiday with negative id', async () => {
      const response = await call(
        'UteamupTenantHolidayDelete',
        { id: -1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Id must be a positive integer'
            },
            id: 37
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('positive integer');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTenantHolidayImport
  // ---------------------------------------------------------------------------
  describe('UteamupTenantHolidayImport tool', () => {
    test('fresh import: all 12 holidays imported, 0 skipped', async () => {
      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(importResult) }] },
            id: 40
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.imported).toBe(12);
      expect(result.skipped).toBe(0);
      expect(result.year).toBe(2026);
      expect(result.countryCode).toBe('IS');
      expect(Array.isArray(result.holidays)).toBe(true);
      expect(result.holidays.length).toBeGreaterThan(0);
    });

    test('partial import: some holidays already exist — imported=9, skipped=3', async () => {
      const partialImportResult = {
        imported: 9,
        skipped: 3,
        year: 2026,
        countryCode: 'IS',
        holidays: [
          { date: '2026-01-01T00:00:00Z', name: "New Year's Day", isNational: true },
          { date: '2026-12-25T00:00:00Z', name: 'Christmas Day', isNational: true }
        ]
      };

      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(partialImportResult) }] },
            id: 41
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.imported).toBe(9);
      expect(result.skipped).toBe(3);
    });

    test('returns error for invalid country code', async () => {
      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'XX' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: "Invalid country code 'XX'"
            },
            id: 42
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain("Invalid country code 'XX'");
    });

    test('all already up to date: imported=0, skipped=12', async () => {
      const allSkippedResult = {
        imported: 0,
        skipped: 12,
        year: 2026,
        countryCode: 'IS',
        holidays: []
      };

      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(allSkippedResult) }] },
            id: 43
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(12);
    });

    test('imported holidays have source set to AutoImported', async () => {
      const importResultWithSources = {
        ...importResult,
        holidays: [
          { ...importedHoliday, id: 100, date: '2026-01-01T00:00:00Z', name: "New Year's Day" },
          { ...importedHoliday, id: 101, date: '2026-12-25T00:00:00Z', name: 'Christmas Day' }
        ]
      };

      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(importResultWithSources) }] },
            id: 44
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      result.holidays.forEach(h => {
        expect(h.source).toBe('AutoImported');
      });
    });

    test('request includes year and countryCode in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(importResult) }] },
          id: 45
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupTenantHolidayImport',
          arguments: { year: 2026, countryCode: 'IS' }
        },
        id: 45
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.year).toBe(2026);
      expect(capturedBody.params.arguments.countryCode).toBe('IS');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(importResult) }] },
            id: 46
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(46);
    });

    test('result contains imported and skipped counts plus holidays array', async () => {
      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'IS' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(importResult) }] },
            id: 47
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(typeof result.imported).toBe('number');
      expect(typeof result.skipped).toBe('number');
      expect(Array.isArray(result.holidays)).toBe(true);
      expect(result.imported + result.skipped).toBeGreaterThan(0);
    });

    test('import for a different country code produces a different set of holidays', async () => {
      const deImportResult = {
        imported: 14,
        skipped: 0,
        year: 2026,
        countryCode: 'DE',
        holidays: [
          { date: '2026-10-03T00:00:00Z', name: 'German Unity Day', isNational: true },
          { date: '2026-12-25T00:00:00Z', name: 'Christmas Day', isNational: true }
        ]
      };

      const response = await call(
        'UteamupTenantHolidayImport',
        { year: 2026, countryCode: 'DE' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(deImportResult) }] },
            id: 48
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.countryCode).toBe('DE');
      expect(result.imported).toBe(14);
      const germanUnity = result.holidays.find(h => h.name === 'German Unity Day');
      expect(germanUnity).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupTenantHolidayListByYear', args: { year: 2026 } },
    { name: 'UteamupTenantHolidayCreate', args: { date: '2026-12-25', name: 'Christmas Day', isNational: true, countryCode: 'IS', isRecurringAnnually: true } },
    { name: 'UteamupTenantHolidayUpdate', args: { id: 1, name: 'Updated Name', isActive: true } },
    { name: 'UteamupTenantHolidayDelete', args: { id: 1 } },
    { name: 'UteamupTenantHolidayImport', args: { year: 2026, countryCode: 'IS' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // National vs Manual source field correctness
  // ---------------------------------------------------------------------------
  describe('National vs manual holiday source field', () => {
    test('auto-imported national holiday has source AutoImported', async () => {
      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify([
                  { ...importedHoliday, id: 100 },
                  { ...holiday, id: 101, source: 'Manual' }
                ])
              }]
            },
            id: 70
          }
        }
      );

      const holidays = JSON.parse(response.body.result.content[0].text);
      const autoImported = holidays.find(h => h.id === 100);
      const manual = holidays.find(h => h.id === 101);

      expect(autoImported.source).toBe('AutoImported');
      expect(manual.source).toBe('Manual');
    });

    test('manually created holiday has source Manual regardless of isNational flag', async () => {
      const manualNational = {
        id: 200,
        date: '2026-06-17T00:00:00Z',
        name: 'National Day',
        isNational: true,
        countryCode: 'IS',
        isRecurringAnnually: true,
        isActive: true,
        source: 'Manual'
      };

      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-06-17',
          name: 'National Day',
          isNational: true,
          countryCode: 'IS',
          isRecurringAnnually: true
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(manualNational) }] },
            id: 71
          }
        }
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.isNational).toBe(true);
      expect(created.source).toBe('Manual');
    });
  });

  // ---------------------------------------------------------------------------
  // Recurring annually flag correctness
  // ---------------------------------------------------------------------------
  describe('isRecurringAnnually flag', () => {
    test('national holidays created with isRecurringAnnually=true retain the flag', async () => {
      const recurringHoliday = {
        id: 300,
        date: '2026-12-25T00:00:00Z',
        name: 'Christmas Day',
        isNational: true,
        countryCode: 'IS',
        isRecurringAnnually: true,
        isActive: true,
        source: 'AutoImported'
      };

      const response = await call(
        'UteamupTenantHolidayListByYear',
        { year: 2026 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([recurringHoliday]) }] },
            id: 80
          }
        }
      );

      const holidays = JSON.parse(response.body.result.content[0].text);
      expect(holidays[0].isRecurringAnnually).toBe(true);
    });

    test('non-recurring one-off company holiday has isRecurringAnnually=false', async () => {
      const oneOffHoliday = {
        id: 301,
        date: '2026-07-04T00:00:00Z',
        name: 'Company Picnic Day',
        isNational: false,
        countryCode: null,
        isRecurringAnnually: false,
        isActive: true,
        source: 'Manual'
      };

      const response = await call(
        'UteamupTenantHolidayCreate',
        {
          date: '2026-07-04',
          name: 'Company Picnic Day',
          isNational: false,
          countryCode: null,
          isRecurringAnnually: false
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(oneOffHoliday) }] },
            id: 81
          }
        }
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.isRecurringAnnually).toBe(false);
      expect(created.isNational).toBe(false);
    });
  });
});
