/**
 * Report template and schedule MCP tools.
 *
 * Backend tools: MCP/Tools/ReportTemplateTools.cs, ten methods, each requiring Report.Export. The
 * five schedule tools also need a plan that includes Scheduled Report Delivery. [McpServerTool] sets
 * no Name, so the SDK exposes each method snake-cased (UteamupReportTemplateList becomes
 * uteamup_report_template_list), and that is the name the handlers record metrics under.
 *
 * The proxy is generic, so these tests prove that arguments and the success, empty and error shapes
 * pass through the /mcp JSON-RPC contract unchanged, and that no tool asks for a tenant or user
 * identity: both come from the API key on the backend.
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const https = require('https');
const nock = require('nock');
const {
  callMcpTool,
  sendRawRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Report template and schedule MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_report_template_schedule';
  const TEMPLATE_GUID = '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';
  const SCHEDULE_GUID = '8e7d6c5b-4a39-4281-9f0e-1d2c3b4a5968';
  const OWNER_GUID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
  const MEMBER_GUID = 'd4c3b2a1-f6e5-4d7c-9b8a-7f6e5d4c3b2a';
  const RUN_GUID = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0';
  const RECIPIENT_GUID = 'a9b8c7d6-e5f4-4a3b-8c2d-1e0f9a8b7c6d';
  const MAX_MCP_FILE_BYTES = 10485760;
  const PLAN_FEATURE = 'Scheduled Report Delivery';

  // Method name (as the spec names the tool) → the snake-cased name the SDK puts on the wire.
  const WIRE = {
    UteamupReportTemplateList: 'uteamup_report_template_list',
    UteamupReportTemplateGet: 'uteamup_report_template_get',
    UteamupReportTemplatePreview: 'uteamup_report_template_preview',
    UteamupReportTemplateExport: 'uteamup_report_template_export',
    UteamupReportTemplateDelete: 'uteamup_report_template_delete',
    UteamupReportScheduleList: 'uteamup_report_schedule_list',
    UteamupReportScheduleGet: 'uteamup_report_schedule_get',
    UteamupReportScheduleSetActive: 'uteamup_report_schedule_set_active',
    UteamupReportScheduleSendTest: 'uteamup_report_schedule_send_test',
    UteamupReportScheduleDelete: 'uteamup_report_schedule_delete',
  };

  const templateListArgs = { scope: 'mine', search: 'pump', page: 2, pageSize: 25 };
  const templateArgs = { templateGuid: TEMPLATE_GUID };
  const exportArgs = { templateGuid: TEMPLATE_GUID, format: 'xlsx' };
  const scheduleListArgs = { search: 'weekly', isActive: true, mineOnly: true, page: 1, pageSize: 10 };
  const scheduleArgs = { scheduleGuid: SCHEDULE_GUID };
  const pauseArgs = { scheduleGuid: SCHEDULE_GUID, isActive: false };

  // One entry per tool, so the matrix and the shared describe blocks cover all ten exactly once.
  const tools = [
    { name: WIRE.UteamupReportTemplateList, args: templateListArgs },
    { name: WIRE.UteamupReportTemplateGet, args: templateArgs },
    { name: WIRE.UteamupReportTemplatePreview, args: templateArgs },
    { name: WIRE.UteamupReportTemplateExport, args: exportArgs },
    { name: WIRE.UteamupReportTemplateDelete, args: templateArgs },
    { name: WIRE.UteamupReportScheduleList, args: scheduleListArgs },
    { name: WIRE.UteamupReportScheduleGet, args: scheduleArgs },
    { name: WIRE.UteamupReportScheduleSetActive, args: pauseArgs },
    { name: WIRE.UteamupReportScheduleSendTest, args: scheduleArgs },
    { name: WIRE.UteamupReportScheduleDelete, args: scheduleArgs },
  ];

  const scheduleToolNames = tools.map(tool => tool.name).filter(name => name.startsWith('uteamup_report_schedule_'));

  // Identity is the API key's user and tenant on the backend, never a tool argument.
  const FORBIDDEN_IDENTITY_KEYS = ['tenantGuid', 'tenantId', 'userId', 'ownerUserId'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // An integer id would leak an enumerable identifier; timeZoneId is an IANA name, not an id.
  const isIntegerIdKey = key => /Id$/.test(key) && key !== 'timeZoneId';

  // callMcpTool only replies when the forwarded arguments deep-equal toolArgs, so a reply proves the
  // proxy neither dropped, renamed nor added an argument.
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, toolArgs);

  // The SDK returns a handler's McpException as an isError tool result, prefixed with the tool name.
  const toolError = (toolName, text) => ({
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `An error occurred invoking '${toolName}': ${text}` }],
        isError: true,
      },
      id: 1,
    },
  });

  const resultOf = response => JSON.parse(response.body.result.content[0].text);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });

    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  const collectKeys = value => {
    if (Array.isArray(value)) return value.flatMap(collectKeys);
    if (!value || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([key, nested]) => [key, ...collectKeys(nested)]);
  };

  const template = {
    templateGuid: TEMPLATE_GUID,
    name: 'Pump maintenance cost by month',
    description: 'Monthly cost and time for pump work',
    dataset: 'WorkReportSummary',
    isShared: true,
    definition: {
      periodPreset: 'LastMonth',
      filters: { searchText: 'pump', minCost: 10 },
      columns: ['period', 'reportCount', 'totalCost'],
      sortBy: 'period',
      sortDescending: false,
      groupBy: 'month',
    },
    ownerUserGuid: OWNER_GUID,
    ownerName: 'Ada Planner',
    isOwner: true,
    canEdit: true,
    activeScheduleCount: 1,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-20T08:00:00Z',
  };

  const scheduleSummary = {
    scheduleGuid: SCHEDULE_GUID,
    name: 'Weekly pump costs',
    templateGuid: TEMPLATE_GUID,
    templateName: template.name,
    format: 'xlsx',
    frequency: 'Weekly',
    dayOfWeek: 'Monday',
    timeOfDay: '07:00',
    timeZoneId: 'Atlantic/Reykjavik',
    isActive: true,
    pauseReason: 'None',
    nextRunAtUtc: '2026-09-28T07:00:00Z',
    lastRunAtUtc: '2026-09-21T07:00:00Z',
    lastRunStatus: 'Succeeded',
    recipientCount: 3,
    externalRecipientCount: 1,
    ownerUserGuid: OWNER_GUID,
    ownerName: 'Ada Planner',
    isOwner: true,
    canEdit: true,
  };

  const schedule = {
    ...scheduleSummary,
    recipients: [
      {
        recipientGuid: RECIPIENT_GUID,
        kind: 'Member',
        userGuid: MEMBER_GUID,
        displayName: 'Bjorn Tech',
        email: 'bjorn@example.com',
        isUnsubscribed: false,
      },
    ],
    recentRuns: [
      {
        runGuid: RUN_GUID,
        scheduledForUtc: '2026-09-21T07:00:00Z',
        isTest: false,
        status: 'Succeeded',
        rowCount: 12,
        fileName: 'weekly-pump-costs-2026-09-21.xlsx',
        fileSizeBytes: 18432,
        recipientCount: 3,
        sentCount: 3,
        suppressedCount: 0,
        failedCount: 0,
        completedAtUtc: '2026-09-21T07:00:05Z',
      },
    ],
  };

  const page = (data, pageNumber = 1, pageSize = 50) => ({
    data,
    totalRecords: data.length,
    page: pageNumber,
    pageSize,
    totalPages: data.length === 0 ? 0 : 1,
  });

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('the tool matrix covers all ten tools exactly once, by their snake-cased wire names', () => {
    expect(tools).toHaveLength(10);
    expect(new Set(tools.map(tool => tool.name))).toEqual(new Set(Object.values(WIRE)));
    for (const name of Object.values(WIRE)) {
      expect(name).toMatch(/^uteamup_report_(template|schedule)_[a-z_]+$/);
    }
  });

  describe('UteamupReportTemplateList', () => {
    test('success: returns a page of templates the caller can see', async () => {
      const response = await call(
        WIRE.UteamupReportTemplateList,
        templateListArgs,
        successReply(page([template], 2, 25)),
      );

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].templateGuid).toBe(TEMPLATE_GUID);
      expect(result.data[0].ownerUserGuid).toBe(OWNER_GUID);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
      expect(result.data[0]).not.toHaveProperty('id');
      expect(result.data[0]).not.toHaveProperty('ownerUserId');
    });

    test('empty: a caller with no templates gets an empty page, not an error', async () => {
      const response = await call(WIRE.UteamupReportTemplateList, {}, successReply(page([])));

      expect(response.body.error).toBeUndefined();
      const result = resultOf(response);
      expect(result.data).toEqual([]);
      expect(result.totalRecords).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    test('error: an unknown scope round-trips the backend validation error', async () => {
      const args = { scope: 'everyone' };

      const response = await call(
        WIRE.UteamupReportTemplateList,
        args,
        errorReply(-32602, "scope must be 'all', 'mine' or 'shared'. (Parameter 'scope')"),
      );

      expect(response.body.result).toBeUndefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain("(Parameter 'scope')");
    });

    test('error: a key without Report.Export round-trips the permission error', async () => {
      const response = await call(
        WIRE.UteamupReportTemplateList,
        templateListArgs,
        errorReply(-32000, 'Permission denied: Report.Export required'),
      );

      expect(response.body.error).toEqual({ code: -32000, message: 'Permission denied: Report.Export required' });
    });
  });

  describe('UteamupReportTemplateGet', () => {
    test('success: returns the template definition with GUID identities only', async () => {
      const response = await call(WIRE.UteamupReportTemplateGet, templateArgs, successReply(template));

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result).toEqual(template);
      expect(result.definition.columns).toEqual(['period', 'reportCount', 'totalCost']);
      for (const key of collectKeys(result)) {
        expect(isIntegerIdKey(key)).toBe(false);
      }
    });

    test('empty: a template with no description, filters or columns round-trips without them', async () => {
      const bare = {
        templateGuid: TEMPLATE_GUID,
        name: 'All reports',
        dataset: 'WorkReports',
        isShared: false,
        definition: { periodPreset: 'ThisMonth', sortDescending: true },
        ownerUserGuid: OWNER_GUID,
        ownerName: 'Ada Planner',
        isOwner: true,
        canEdit: true,
        activeScheduleCount: 0,
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
      };

      const response = await call(WIRE.UteamupReportTemplateGet, templateArgs, successReply(bare));

      const result = resultOf(response);
      expect(result).toEqual(bare);
      expect(result).not.toHaveProperty('description');
      expect(result.definition).not.toHaveProperty('columns');
      expect(result.activeScheduleCount).toBe(0);
    });

    test('error: a template outside the tenant or another user\'s private template is not found', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplateGet,
        `Report template with GUID ${TEMPLATE_GUID} not found.`,
      );

      const response = await call(WIRE.UteamupReportTemplateGet, templateArgs, reply);

      expect(response.body.error).toBeUndefined();
      expect(response.body.result).toEqual(reply.body.result);
      expect(response.body.result.content[0].text).toContain('not found');
    });
  });

  describe('UteamupReportTemplatePreview', () => {
    const preview = {
      columns: [
        { key: 'period', label: 'Period' },
        { key: 'totalCost', label: 'Total cost' },
      ],
      rows: [
        { period: '2026-08', totalCost: '1250.75' },
        { period: '2026-09', totalCost: null },
      ],
      totalRowCount: 2,
      truncated: false,
      periodStartUtc: '2026-08-01T00:00:00Z',
      periodEndExclusiveUtc: '2026-10-01T00:00:00Z',
      periodLabel: '2026-08-01..2026-09-30',
    };

    test('success: returns columns, formatted rows and the resolved period', async () => {
      const response = await call(WIRE.UteamupReportTemplatePreview, templateArgs, successReply(preview));

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result.columns.map(column => column.key)).toEqual(['period', 'totalCost']);
      expect(result.rows[0].totalCost).toBe('1250.75');
      expect(result.rows[1].totalCost).toBeNull();
      expect(result.periodLabel).toBe('2026-08-01..2026-09-30');
      expect(result.truncated).toBe(false);
    });

    test('success: a preview capped at 50 rows says it is truncated', async () => {
      const rows = Array.from({ length: 50 }, (_, index) => ({ period: `row-${index}`, totalCost: '1.00' }));

      const response = await call(
        WIRE.UteamupReportTemplatePreview,
        templateArgs,
        successReply({ ...preview, rows, totalRowCount: 180, truncated: true }),
      );

      const result = resultOf(response);
      expect(result.rows).toHaveLength(50);
      expect(result.totalRowCount).toBe(180);
      expect(result.truncated).toBe(true);
    });

    test('empty: a period with no matching reports keeps the columns and returns no rows', async () => {
      const response = await call(
        WIRE.UteamupReportTemplatePreview,
        templateArgs,
        successReply({ ...preview, rows: [], totalRowCount: 0 }),
      );

      const result = resultOf(response);
      expect(result.columns).toHaveLength(2);
      expect(result.rows).toEqual([]);
      expect(result.totalRowCount).toBe(0);
    });

    test('error: an invisible template round-trips as not found', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplatePreview,
        `Report template with GUID ${TEMPLATE_GUID} not found.`,
      );

      const response = await call(WIRE.UteamupReportTemplatePreview, templateArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
    });
  });

  describe('UteamupReportTemplateExport', () => {
    const XLSX_BASE64 = Buffer.from('PK\u0003\u0004 workbook').toString('base64');
    const CSV_HEADER_ONLY = Buffer.from('Period,Total cost\n').toString('base64');

    test('success: returns the file as base64 with its name, type and size', async () => {
      const file = {
        fileName: 'pump-maintenance-cost-by-month.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentBase64: XLSX_BASE64,
        sizeBytes: Buffer.from(XLSX_BASE64, 'base64').length,
      };

      const response = await call(WIRE.UteamupReportTemplateExport, exportArgs, successReply(file));

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result).toEqual(file);
      expect(Buffer.from(result.contentBase64, 'base64').subarray(0, 2).toString()).toBe('PK');
      expect(result.sizeBytes).toBeLessThanOrEqual(MAX_MCP_FILE_BYTES);
    });

    test('empty: a period with no rows exports a header-only CSV', async () => {
      const args = { templateGuid: TEMPLATE_GUID, format: 'csv' };
      const file = {
        fileName: 'pump-maintenance-cost-by-month.csv',
        contentType: 'text/csv',
        contentBase64: CSV_HEADER_ONLY,
        sizeBytes: 18,
      };

      const response = await call(WIRE.UteamupReportTemplateExport, args, successReply(file));

      const csv = Buffer.from(resultOf(response).contentBase64, 'base64').toString();
      expect(csv.trim().split('\n')).toEqual(['Period,Total cost']);
    });

    test('error: a file over 10 MB round-trips as a tool error stating its size and the cap', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplateExport,
        `The file is 12000000 bytes; an MCP tool returns at most ${MAX_MCP_FILE_BYTES}. `
          + 'Download it from the web app or the CLI instead.',
      );

      const response = await call(WIRE.UteamupReportTemplateExport, exportArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('12000000 bytes');
      expect(response.body.result.content[0].text).toContain(String(MAX_MCP_FILE_BYTES));
    });

    test('error: too many matching rows round-trip the coded ExportTooLarge refusal', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplateExport,
        'ExportTooLarge: More than 10000 reports match. Narrow the filters.',
      );

      const response = await call(WIRE.UteamupReportTemplateExport, exportArgs, reply);

      expect(response.body.result.content[0].text).toContain('ExportTooLarge: ');
    });

    test('error: an unsupported format round-trips the validation error', async () => {
      const args = { templateGuid: TEMPLATE_GUID, format: 'docx' };

      const response = await call(
        WIRE.UteamupReportTemplateExport,
        args,
        errorReply(-32602, "format must be csv, xlsx or pdf. (Parameter 'format')"),
      );

      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain("(Parameter 'format')");
    });
  });

  describe('UteamupReportTemplateDelete', () => {
    test('success: deleting a template returns true', async () => {
      const response = await call(WIRE.UteamupReportTemplateDelete, templateArgs, successReply(true));

      expect(nock.isDone()).toBe(true);
      expect(resultOf(response)).toBe(true);
    });

    test('empty: a tool result with no content blocks is forwarded, not a crash', async () => {
      const reply = { status: 200, body: { jsonrpc: '2.0', result: { content: [] }, id: 1 } };

      const response = await call(WIRE.UteamupReportTemplateDelete, templateArgs, reply);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(response.body.result.content).toEqual([]);
    });

    test('error: a template that schedules still use round-trips the conflict with the count', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplateDelete,
        'This template is used by 2 schedule(s). Delete or change those schedules first.',
      );

      const response = await call(WIRE.UteamupReportTemplateDelete, templateArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('used by 2 schedule(s)');
    });

    test('error: a template that is already gone round-trips as not found', async () => {
      const reply = toolError(
        WIRE.UteamupReportTemplateDelete,
        `Report template with GUID ${TEMPLATE_GUID} not found.`,
      );

      const response = await call(WIRE.UteamupReportTemplateDelete, templateArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
    });
  });

  describe('UteamupReportScheduleList', () => {
    test('success: summaries carry recipient counts and never a recipient email', async () => {
      const response = await call(
        WIRE.UteamupReportScheduleList,
        scheduleListArgs,
        successReply(page([scheduleSummary], 1, 10)),
      );

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result.data[0].scheduleGuid).toBe(SCHEDULE_GUID);
      expect(result.data[0].recipientCount).toBe(3);
      expect(result.data[0].externalRecipientCount).toBe(1);
      expect(collectKeys(result)).not.toContain('email');
      expect(collectKeys(result)).not.toContain('recipients');
    });

    test('empty: a tenant with no schedules gets an empty page', async () => {
      const response = await call(WIRE.UteamupReportScheduleList, {}, successReply(page([])));

      const result = resultOf(response);
      expect(result.data).toEqual([]);
      expect(result.totalRecords).toBe(0);
    });

    test('error: a pageSize over 100 round-trips the paging validation error', async () => {
      const args = { pageSize: 101 };

      const response = await call(
        WIRE.UteamupReportScheduleList,
        args,
        errorReply(-32602, "pageSize must be between 1 and 100. (Parameter 'pageSize')"),
      );

      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain("(Parameter 'pageSize')");
    });
  });

  describe('UteamupReportScheduleGet', () => {
    test('success: returns recipients and recent runs keyed by GUID', async () => {
      const response = await call(WIRE.UteamupReportScheduleGet, scheduleArgs, successReply(schedule));

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result).toEqual(schedule);
      expect(result.recipients[0].userGuid).toMatch(UUID);
      expect(result.recentRuns[0].runGuid).toBe(RUN_GUID);
      for (const key of collectKeys(result)) {
        expect(isIntegerIdKey(key)).toBe(false);
      }
    });

    test('empty: a new schedule has no runs yet and no last run', async () => {
      const { lastRunAtUtc: _lastRun, lastRunStatus: _lastStatus, ...fresh } = schedule;
      const neverRun = { ...fresh, recentRuns: [] };

      const response = await call(WIRE.UteamupReportScheduleGet, scheduleArgs, successReply(neverRun));

      const result = resultOf(response);
      expect(result.recentRuns).toEqual([]);
      expect(result).not.toHaveProperty('lastRunAtUtc');
      expect(result).not.toHaveProperty('lastRunStatus');
    });

    test('error: a colleague\'s schedule without Report.All is not found', async () => {
      const reply = toolError(
        WIRE.UteamupReportScheduleGet,
        `Report schedule with GUID ${SCHEDULE_GUID} not found.`,
      );

      const response = await call(WIRE.UteamupReportScheduleGet, scheduleArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
      expect(response.body.result.content[0].text).toContain('not found');
    });
  });

  describe('UteamupReportScheduleSetActive', () => {
    test('success: pausing returns the schedule paused by hand', async () => {
      const paused = { ...schedule, isActive: false, pauseReason: 'Manual' };
      delete paused.nextRunAtUtc;

      const response = await call(WIRE.UteamupReportScheduleSetActive, pauseArgs, successReply(paused));

      expect(nock.isDone()).toBe(true);
      const result = resultOf(response);
      expect(result.isActive).toBe(false);
      expect(result.pauseReason).toBe('Manual');
      expect(result).not.toHaveProperty('nextRunAtUtc');
    });

    test('success: resuming returns an active schedule with its next run from now', async () => {
      const resumeArgs = { scheduleGuid: SCHEDULE_GUID, isActive: true };

      const response = await call(WIRE.UteamupReportScheduleSetActive, resumeArgs, successReply(schedule));

      const result = resultOf(response);
      expect(result.isActive).toBe(true);
      expect(result.pauseReason).toBe('None');
      expect(result.nextRunAtUtc).toBe('2026-09-28T07:00:00Z');
    });

    test('empty: pausing an already paused schedule returns it unchanged', async () => {
      const paused = { ...schedule, isActive: false, pauseReason: 'Manual', recentRuns: [] };

      const first = await call(WIRE.UteamupReportScheduleSetActive, pauseArgs, successReply(paused));
      const second = await call(WIRE.UteamupReportScheduleSetActive, pauseArgs, successReply(paused));

      expect(resultOf(second)).toEqual(resultOf(first));
    });

    test('error: resuming for an owner who lost Report.Export round-trips the conflict', async () => {
      const resumeArgs = { scheduleGuid: SCHEDULE_GUID, isActive: true };
      const reply = toolError(
        WIRE.UteamupReportScheduleSetActive,
        'The schedule owner can no longer view and export reports. Edit the schedule to take it over, then resume it.',
      );

      const response = await call(WIRE.UteamupReportScheduleSetActive, resumeArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('can no longer view and export reports');
    });
  });

  describe('UteamupReportScheduleSendTest', () => {
    test('success: returns the test run and the caller\'s own address', async () => {
      const result = { runGuid: RUN_GUID, status: 'Succeeded', sentTo: 'ada@example.com' };

      const response = await call(WIRE.UteamupReportScheduleSendTest, scheduleArgs, successReply(result));

      expect(nock.isDone()).toBe(true);
      expect(resultOf(response)).toEqual(result);
      expect(resultOf(response).runGuid).toMatch(UUID);
    });

    test('empty: a test of a report with no rows still sends and succeeds', async () => {
      const result = { runGuid: RUN_GUID, status: 'Succeeded', sentTo: 'ada@example.com' };

      const response = await call(WIRE.UteamupReportScheduleSendTest, scheduleArgs, successReply(result));

      expect(response.body.error).toBeUndefined();
      expect(resultOf(response).status).toBe('Succeeded');
    });

    test('error: an unconfirmed caller email round-trips the refusal', async () => {
      const reply = toolError(
        WIRE.UteamupReportScheduleSendTest,
        'Confirm your email address before sending a test.',
      );

      const response = await call(WIRE.UteamupReportScheduleSendTest, scheduleArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toMatch(/Confirm your email address before sending a test\.$/);
    });

    test('error: a caller who turned off scheduled report emails is refused', async () => {
      const reply = toolError(
        WIRE.UteamupReportScheduleSendTest,
        'You have turned off scheduled report emails in your notification settings.',
      );

      const response = await call(WIRE.UteamupReportScheduleSendTest, scheduleArgs, reply);

      expect(response.body.result.content[0].text).toContain('turned off scheduled report emails');
    });
  });

  describe('UteamupReportScheduleDelete', () => {
    test('success: deleting a schedule returns true', async () => {
      const response = await call(WIRE.UteamupReportScheduleDelete, scheduleArgs, successReply(true));

      expect(nock.isDone()).toBe(true);
      expect(resultOf(response)).toBe(true);
    });

    test('empty: a tool result with no content blocks is forwarded, not a crash', async () => {
      const reply = { status: 200, body: { jsonrpc: '2.0', result: { content: [] }, id: 1 } };

      const response = await call(WIRE.UteamupReportScheduleDelete, scheduleArgs, reply);

      expect(response.body.error).toBeUndefined();
      expect(response.body.result.content).toEqual([]);
    });

    test('error: another user\'s schedule round-trips as not found', async () => {
      const reply = toolError(
        WIRE.UteamupReportScheduleDelete,
        `Report schedule with GUID ${SCHEDULE_GUID} not found.`,
      );

      const response = await call(WIRE.UteamupReportScheduleDelete, scheduleArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
    });
  });

  describe('plan gate on the schedule tools', () => {
    test('covers exactly the five schedule tools', () => {
      expect(scheduleToolNames).toHaveLength(5);
    });

    test.each(tools.filter(tool => scheduleToolNames.includes(tool.name)))(
      '$name round-trips the plan refusal naming Scheduled Report Delivery',
      async ({ name, args }) => {
        const message = `The tenant's plan does not include ${PLAN_FEATURE}.`;

        const response = await call(name, args, errorReply(-32000, message));

        expect(response.body.result).toBeUndefined();
        expect(response.body.error).toEqual({ code: -32000, message });
      },
    );
  });

  describe('argument round-trip', () => {
    test.each(tools)('$name forwards its arguments verbatim', async ({ name, args }) => {
      const captured = await captureCall(name, args);

      expect(captured.method).toBe('tools/call');
      expect(captured.params).toEqual({ name, arguments: args });
    });

    test.each([
      [WIRE.UteamupReportTemplateGet, 'templateGuid'],
      [WIRE.UteamupReportTemplatePreview, 'templateGuid'],
      [WIRE.UteamupReportTemplateExport, 'templateGuid'],
      [WIRE.UteamupReportTemplateDelete, 'templateGuid'],
      [WIRE.UteamupReportScheduleGet, 'scheduleGuid'],
      [WIRE.UteamupReportScheduleSetActive, 'scheduleGuid'],
      [WIRE.UteamupReportScheduleSendTest, 'scheduleGuid'],
      [WIRE.UteamupReportScheduleDelete, 'scheduleGuid'],
    ])('%s keeps %s a GUID string', async (name, key) => {
      const { args } = tools.find(tool => tool.name === name);

      const captured = await captureCall(name, args);

      expect(typeof captured.params.arguments[key]).toBe('string');
      expect(captured.params.arguments[key]).toMatch(UUID);
    });

    test.each([true, false])('isActive = %s is forwarded as a JSON boolean', async isActive => {
      const args = { scheduleGuid: SCHEDULE_GUID, isActive };

      const captured = await captureCall(WIRE.UteamupReportScheduleSetActive, args);

      expect(captured.params.arguments.isActive).toBe(isActive);
    });

    test.each(['csv', 'xlsx', 'pdf'])('format = %s is forwarded unchanged', async format => {
      const args = { templateGuid: TEMPLATE_GUID, format };

      const response = await call(WIRE.UteamupReportTemplateExport, args, successReply({ fileName: `r.${format}` }));

      expect(nock.isDone()).toBe(true);
      expect(resultOf(response).fileName).toBe(`r.${format}`);
    });

    // The backend accepts the scope in any letter case, so the proxy must not normalise it.
    test.each(['all', 'mine', 'shared', 'MINE', 'Shared'])('scope = %s is forwarded with its case intact', async scope => {
      const captured = await captureCall(WIRE.UteamupReportTemplateList, { scope });

      expect(captured.params.arguments).toEqual({ scope });
    });

    test.each([
      [WIRE.UteamupReportTemplateList],
      [WIRE.UteamupReportScheduleList],
    ])('%s forwards page and pageSize as integers', async name => {
      const args = { page: 3, pageSize: 100 };

      const captured = await captureCall(name, args);

      expect(captured.params.arguments).toEqual(args);
      expect(Number.isInteger(captured.params.arguments.page)).toBe(true);
      expect(Number.isInteger(captured.params.arguments.pageSize)).toBe(true);
    });

    test('schedule list forwards the isActive filter and mineOnly', async () => {
      const args = { isActive: false, mineOnly: true };

      const captured = await captureCall(WIRE.UteamupReportScheduleList, args);

      expect(captured.params.arguments).toEqual(args);
    });
  });

  describe('identity regression guards', () => {
    const guidSchema = { type: 'string', format: 'uuid' };
    const pageSchema = { type: 'integer', default: 1 };
    const pageSizeSchema = { type: 'integer', default: 50 };

    // The input schemas the backend's ReportTemplateTools signatures produce.
    const discoveryTools = [
      {
        name: WIRE.UteamupReportTemplateList,
        inputSchema: {
          type: 'object',
          properties: {
            scope: { type: ['string', 'null'], default: null },
            search: { type: ['string', 'null'], default: null },
            page: pageSchema,
            pageSize: pageSizeSchema,
          },
        },
      },
      {
        name: WIRE.UteamupReportTemplateGet,
        inputSchema: { type: 'object', properties: { templateGuid: guidSchema }, required: ['templateGuid'] },
      },
      {
        name: WIRE.UteamupReportTemplatePreview,
        inputSchema: { type: 'object', properties: { templateGuid: guidSchema }, required: ['templateGuid'] },
      },
      {
        name: WIRE.UteamupReportTemplateExport,
        inputSchema: {
          type: 'object',
          properties: { templateGuid: guidSchema, format: { type: 'string', default: 'csv' } },
          required: ['templateGuid'],
        },
      },
      {
        name: WIRE.UteamupReportTemplateDelete,
        inputSchema: { type: 'object', properties: { templateGuid: guidSchema }, required: ['templateGuid'] },
      },
      {
        name: WIRE.UteamupReportScheduleList,
        inputSchema: {
          type: 'object',
          properties: {
            search: { type: ['string', 'null'], default: null },
            isActive: { type: ['boolean', 'null'], default: null },
            mineOnly: { type: 'boolean', default: false },
            page: pageSchema,
            pageSize: pageSizeSchema,
          },
        },
      },
      {
        name: WIRE.UteamupReportScheduleGet,
        inputSchema: { type: 'object', properties: { scheduleGuid: guidSchema }, required: ['scheduleGuid'] },
      },
      {
        name: WIRE.UteamupReportScheduleSetActive,
        inputSchema: {
          type: 'object',
          properties: { scheduleGuid: guidSchema, isActive: { type: 'boolean' } },
          required: ['scheduleGuid', 'isActive'],
        },
      },
      {
        name: WIRE.UteamupReportScheduleSendTest,
        inputSchema: { type: 'object', properties: { scheduleGuid: guidSchema }, required: ['scheduleGuid'] },
      },
      {
        name: WIRE.UteamupReportScheduleDelete,
        inputSchema: { type: 'object', properties: { scheduleGuid: guidSchema }, required: ['scheduleGuid'] },
      },
    ];

    const sendToolsList = () => new Promise((resolve, reject) => {
      const payload = JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 94 });
      const request = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(payload),
        },
        rejectUnauthorized: false,
      }, response => {
        let responseData = '';
        response.on('data', chunk => { responseData += chunk; });
        response.on('end', () => resolve(JSON.parse(responseData)));
      });
      request.on('error', reject);
      request.write(payload);
      request.end();
    });

    const listTools = async () => {
      nock(BASE_URL)
        .post('/mcp', body => body.method === 'tools/list')
        .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { tools: discoveryTools }, id: 94 }), {
          'Content-Type': 'application/json',
        });
      const response = await sendToolsList();
      return response.result.tools;
    };

    test('tools/list exposes all ten tools with their schemas unchanged', async () => {
      const listed = await listTools();

      expect(listed).toEqual(discoveryTools);
      expect(listed.map(tool => tool.name).sort()).toEqual(tools.map(tool => tool.name).sort());
    });

    test.each(FORBIDDEN_IDENTITY_KEYS)('no tool schema carries %s', async forbidden => {
      const listed = await listTools();

      for (const tool of listed) {
        expect(Object.keys(tool.inputSchema.properties)).not.toContain(forbidden);
        expect(collectKeys(tool.inputSchema)).not.toContain(forbidden);
      }
    });

    test('every identifier argument in the schemas is a GUID, never an integer id', async () => {
      const listed = await listTools();

      for (const tool of listed) {
        for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
          expect(isIntegerIdKey(key)).toBe(false);
          if (key.endsWith('Guid')) {
            expect(schema).toEqual(guidSchema);
          }
        }
      }
    });

    test('schema properties match the arguments each tool is called with', async () => {
      const listed = await listTools();

      for (const { name, args } of tools) {
        const { properties } = listed.find(tool => tool.name === name).inputSchema;
        for (const key of Object.keys(args)) {
          expect(Object.keys(properties)).toContain(key);
        }
      }
    });

    test.each(tools)('$name forwards no tenant or user identity argument', async ({ name, args }) => {
      const captured = await captureCall(name, args);

      for (const forbidden of FORBIDDEN_IDENTITY_KEYS) {
        expect(captured.params.arguments).not.toHaveProperty(forbidden);
      }
    });
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
