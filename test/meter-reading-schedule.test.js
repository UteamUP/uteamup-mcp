/**
 * Meter Reading Schedule MCP tool tests
 *
 * Verifies that the MeterReadingSchedule MCP tools form valid JSON-RPC 2.0
 * requests and that the MCP proxy correctly relays successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupMeterscheduleCreateByGuid(assetGuid, attributeDefinitionGuid, intervalSeconds, ...)  [preferred]
 *   UteamupMeterscheduleCreate(assetId, attributeDefinitionId, intervalSeconds, ...)            [Obsolete shim]
 *   UteamupMeterscheduleGetOverdue()
 *   UteamupMeterscheduleComplianceSummary(assetId?)
 *   UteamupMeterscheduleRecordWorkorder(workorderId, attributeDefinitionId, readingValue, ...)
 *
 * Pattern mirrors labour-rate.test.js: nock-mocked HTTPS responses simulating
 * what the backend `/mcp` POST returns to the proxy.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Meter Reading Schedule MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_meter_reading_schedule';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // -------------------------------------------------------------------------
  // Shared fixtures
  // -------------------------------------------------------------------------
  const ASSET_GUID = '11111111-2222-3333-4444-555555555555';
  const ATTR_GUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const createdSchedule = {
    id: 7,
    guid: '99999999-8888-7777-6666-555555555555',
    assetGuid: ASSET_GUID,
    assetId: 42,
    attributeDefinitionGuid: ATTR_GUID,
    attributeDefinitionId: 5,
    intervalSeconds: 86400,
    scheduleLabel: 'Daily Odometer Check',
    autoCreateWorkorder: true,
    isActive: true,
    isOverdue: false
  };

  const overdueScheduleList = [
    {
      id: 7,
      guid: '99999999-8888-7777-6666-555555555555',
      assetGuid: ASSET_GUID,
      assetId: 42,
      attributeDefinitionGuid: ATTR_GUID,
      attributeDefinitionId: 5,
      intervalSeconds: 86400,
      isActive: true,
      isOverdue: true,
      overdueBySeconds: 3600
    }
  ];

  const complianceSummary = {
    totalAssets: 5,
    compliantCount: 3,
    overdueCount: 1,
    criticalCount: 1,
    compliancePercentage: 60.0,
    items: [],
    totalCount: 5,
    page: 1,
    pageSize: 50
  };

  const workorderMeterReading = {
    id: 123,
    workorderId: 789,
    attributeDefinitionId: 5,
    readingValue: 45230,
    isCompleted: true
  };

  const SCHEDULE_GUID = '99999999-8888-7777-6666-555555555555';
  const TEMPLATE_GUID = 'cccccccc-dddd-eeee-ffff-000000000000';
  const createdWorkorder = {
    workorderGuid: '12121212-3434-5656-7878-909090909090',
    ticketId: 'MET-0000000042',
    name: 'Trip Count reading — SEL-751'
  };

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleCreateByGuid — preferred Guid-keyed variant
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleCreateByGuid tool', () => {
    test('creates a schedule with Guid identifiers', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateByGuid',
        {
          assetGuid: ASSET_GUID,
          attributeDefinitionGuid: ATTR_GUID,
          intervalSeconds: 86400,
          scheduleLabel: 'Daily Odometer Check'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(createdSchedule) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(schedule.assetGuid).toBe(ASSET_GUID);
      expect(schedule.attributeDefinitionGuid).toBe(ATTR_GUID);
      expect(schedule.intervalSeconds).toBe(86400);
      expect(schedule.guid).toBeDefined();
    });

    test('creates a weekly calendar-anchored schedule (recurrence args relayed)', async () => {
      const weeklySchedule = {
        ...createdSchedule,
        intervalSeconds: 0,
        recurrenceType: 'weekly',
        daysOfWeek: [1, 4],
        scheduleLabel: 'Weekly switchgear check'
      };

      const response = await call(
        'UteamupMeterscheduleCreateByGuid',
        {
          assetGuid: ASSET_GUID,
          attributeDefinitionGuid: ATTR_GUID,
          intervalSeconds: 0,
          recurrenceType: 'weekly',
          daysOfWeek: [1, 4],
          scheduleLabel: 'Weekly switchgear check'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(weeklySchedule) }] },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(schedule.recurrenceType).toBe('weekly');
      expect(schedule.daysOfWeek).toEqual([1, 4]);
      expect(schedule.intervalSeconds).toBe(0);
    });

    test('creates a yearly schedule with month + when-in-month', async () => {
      const yearlySchedule = {
        ...createdSchedule,
        intervalSeconds: 0,
        recurrenceType: 'yearly',
        monthOfYear: 3,
        dayOfMonthMode: 'firstWorkday'
      };

      const response = await call(
        'UteamupMeterscheduleCreateByGuid',
        {
          assetGuid: ASSET_GUID,
          attributeDefinitionGuid: ATTR_GUID,
          intervalSeconds: 0,
          recurrenceType: 'yearly',
          monthOfYear: 3,
          dayOfMonthMode: 'firstWorkday'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(yearlySchedule) }] },
            id: 14
          }
        }
      );

      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(schedule.recurrenceType).toBe('yearly');
      expect(schedule.monthOfYear).toBe(3);
      expect(schedule.dayOfMonthMode).toBe('firstWorkday');
    });

    test('rejects an interval below 5 minutes (300 seconds)', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateByGuid',
        {
          assetGuid: ASSET_GUID,
          attributeDefinitionGuid: ATTR_GUID,
          intervalSeconds: 60
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'IntervalSeconds must be at least 300 (5 minutes)' },
            id: 2
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('300');
    });

    test('returns 403 when MeterReading.Create permission is missing', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateByGuid',
        {
          assetGuid: ASSET_GUID,
          attributeDefinitionGuid: ATTR_GUID,
          intervalSeconds: 86400
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: MeterReading.Create required' },
            id: 3
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('MeterReading.Create');
    });
  });

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleCreate — deprecation shim (int-keyed)
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleCreate (deprecated int variant)', () => {
    test('still routes through the proxy for legacy int callers', async () => {
      const response = await call(
        'UteamupMeterscheduleCreate',
        {
          assetId: 42,
          attributeDefinitionId: 5,
          intervalSeconds: 86400
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(createdSchedule) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(schedule.id).toBe(7);
      expect(schedule.assetId).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleGetOverdue
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleGetOverdue tool', () => {
    test('returns the list of overdue schedules', async () => {
      const response = await call(
        'UteamupMeterscheduleGetOverdue',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(overdueScheduleList) }] },
            id: 5
          }
        }
      );

      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(1);
      expect(list[0].isOverdue).toBe(true);
      expect(list[0].overdueBySeconds).toBe(3600);
    });

    test('returns an empty array when no schedules are overdue', async () => {
      const response = await call(
        'UteamupMeterscheduleGetOverdue',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 6
          }
        }
      );

      const list = JSON.parse(response.body.result.content[0].text);
      expect(list).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleComplianceSummary
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleComplianceSummary tool', () => {
    test('returns tenant-wide compliance summary when no assetId is supplied', async () => {
      const response = await call(
        'UteamupMeterscheduleComplianceSummary',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(complianceSummary) }] },
            id: 7
          }
        }
      );

      const summary = JSON.parse(response.body.result.content[0].text);
      expect(summary.totalAssets).toBe(5);
      expect(summary.compliancePercentage).toBe(60.0);
    });
  });

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleRecordWorkorder
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleRecordWorkorder tool', () => {
    test('records a meter reading inside a workorder context', async () => {
      const response = await call(
        'UteamupMeterscheduleRecordWorkorder',
        {
          workorderId: 789,
          attributeDefinitionId: 5,
          readingValue: 45230,
          notes: 'Recorded during PM service'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workorderMeterReading) }] },
            id: 8
          }
        }
      );

      const reading = JSON.parse(response.body.result.content[0].text);
      expect(reading.workorderId).toBe(789);
      expect(reading.readingValue).toBe(45230);
      expect(reading.isCompleted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // UteamupMeterscheduleCreateWorkorder — force-create a workorder from a schedule
  // -------------------------------------------------------------------------
  describe('UteamupMeterscheduleCreateWorkorder tool', () => {
    test('force-creates a generic MET workorder (no template)', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateWorkorder',
        { scheduleGuid: SCHEDULE_GUID, useScheduleTemplate: false },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(createdWorkorder) }] },
            id: 9
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const wo = JSON.parse(response.body.result.content[0].text);
      expect(wo.workorderGuid).toBeDefined();
      expect(wo.ticketId).toMatch(/^MET-/);
    });

    test('seeds the workorder from an explicit template Guid', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateWorkorder',
        { scheduleGuid: SCHEDULE_GUID, useScheduleTemplate: true, workorderTemplateGuid: TEMPLATE_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ ...createdWorkorder, ticketId: 'WT-7', name: 'From Template' }) }] },
            id: 10
          }
        }
      );

      const wo = JSON.parse(response.body.result.content[0].text);
      expect(wo.name).toBe('From Template');
    });

    test('returns an error when the schedule Guid is unknown', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateWorkorder',
        { scheduleGuid: '00000000-0000-0000-0000-000000000000' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Meter reading schedule not found in tenant.' },
            id: 11
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns 403 when WorkOrder.Create permission is missing', async () => {
      const response = await call(
        'UteamupMeterscheduleCreateWorkorder',
        { scheduleGuid: SCHEDULE_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Permission denied: WorkOrder.Create required' },
            id: 12
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkOrder.Create');
    });
  });

  // -------------------------------------------------------------------------
  // JSON-RPC 2.0 + 401 + 503 compliance helpers (every tool MUST cover these)
  // -------------------------------------------------------------------------
  const allTools = [
    {
      name: 'UteamupMeterscheduleCreateByGuid',
      args: { assetGuid: ASSET_GUID, attributeDefinitionGuid: ATTR_GUID, intervalSeconds: 86400 }
    },
    {
      name: 'UteamupMeterscheduleCreate',
      args: { assetId: 42, attributeDefinitionId: 5, intervalSeconds: 86400 }
    },
    { name: 'UteamupMeterscheduleGetOverdue', args: {} },
    { name: 'UteamupMeterscheduleComplianceSummary', args: {} },
    {
      name: 'UteamupMeterscheduleRecordWorkorder',
      args: { workorderId: 789, attributeDefinitionId: 5, readingValue: 45230 }
    },
    {
      name: 'UteamupMeterscheduleCreateWorkorder',
      args: { scheduleGuid: SCHEDULE_GUID }
    }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
