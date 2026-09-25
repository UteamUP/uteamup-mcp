'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Work report output MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'work-report-output-token';
  const WORKORDER_GUID = '7b7fbd71-4ecf-4c3e-9e36-b87d447ab117';
  const REPORT_GUID = '9c1a5b4e-1f7d-4b2a-8c3e-5d6f7a8b9c0d';
  const REPORTER_GUID = '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
  const IDEMPOTENCY_KEY = '5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f';

  // callMcpTool only replies when the forwarded arguments deep-equal these objects, so every
  // round-trip below proves the proxy forwards the arguments verbatim.
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, toolArgs);

  // The MCP SDK returns a handler's McpException as an isError tool result, prefixed with the executor name.
  const toolError = (executor, text) => ({
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `An error occurred invoking '${executor}': ${text}` }],
        isError: true,
      },
      id: 1,
    },
  });

  const pdfArgs = { reportGuid: REPORT_GUID, includeCosts: false };
  const workorderPdfArgs = { workorderGuid: WORKORDER_GUID, includeCosts: true };
  const exportArgs = {
    filters: {
      workorderGuidFilter: WORKORDER_GUID,
      primaryReporterGuidFilter: REPORTER_GUID,
      reportDateFrom: '2026-09-01T00:00:00Z',
      reportDateTo: '2026-09-30T00:00:00Z',
      nameFilter: 'seal',
      workorderStatusFilter: 3,
      minCostIncurred: 10,
      maxCostIncurred: 5000,
      format: 'csv',
    },
  };
  const sendArgs = {
    idempotencyKey: IDEMPOTENCY_KEY,
    reportGuid: REPORT_GUID,
    request: {
      recipients: ['customer@example.com', 'outside@example.org'],
      message: 'Here is the report for the pump seal job.',
      includeCosts: false,
      publishToPortal: true,
      allowExternalRecipients: true,
      confirm: true,
    },
  };
  const finalizeArgs = { reportGuid: REPORT_GUID };

  // "%PDF-1.7\n" encoded, standing in for the rendered report.
  const PDF_BASE64 = Buffer.from('%PDF-1.7\n').toString('base64');

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  describe('UteamupWorkReportPdf', () => {
    test('returns the PDF as base64 with its file name, type and size', async () => {
      const file = {
        fileName: 'work-report-WO-1042.pdf',
        contentType: 'application/pdf',
        contentBase64: PDF_BASE64,
        sizeBytes: 9,
      };

      const response = await call('UteamupWorkReportPdf', pdfArgs, successReply(file));

      expect(nock.isDone()).toBe(true);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result).toEqual(file);
      expect(Buffer.from(result.contentBase64, 'base64').toString()).toMatch(/^%PDF-/);
      expect(result.sizeBytes).toBeLessThanOrEqual(10485760);
    });

    test('forwards the report GUID and includeCosts = false verbatim', async () => {
      const response = await call('UteamupWorkReportPdf', pdfArgs, successReply({ contentBase64: PDF_BASE64 }));

      expect(nock.isDone()).toBe(true);
      expect(response.body.error).toBeUndefined();
      expect(pdfArgs).toEqual({ reportGuid: REPORT_GUID, includeCosts: false });
    });

    test('an unknown report round-trips as a not-found tool error', async () => {
      const reply = toolError('uteamup_work_report_pdf', `Report with GUID ${REPORT_GUID} not found.`);

      const response = await call('UteamupWorkReportPdf', pdfArgs, reply);

      expect(response.body.error).toBeUndefined();
      expect(response.body.result).toEqual(reply.body.result);
      expect(response.body.result.content[0].text).toContain('not found');
    });

    test('a PDF over 10 MB round-trips as a tool error naming the cap', async () => {
      const reply = toolError(
        'uteamup_work_report_pdf',
        'The PDF is 12000000 bytes; an MCP tool returns at most 10485760. Download it from the web app or the CLI instead.',
      );

      const response = await call('UteamupWorkReportPdf', pdfArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('10485760');
    });

    test('a 403 for a Report.View-only key round-trips as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupWorkReportPdf',
        pdfArgs,
        errorReply(-32000, 'Permission denied: Report.Export required'),
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeUndefined();
      expect(response.body.error).toEqual({ code: -32000, message: 'Permission denied: Report.Export required' });
    });
  });

  describe('UteamupWorkReportWorkorderPdf', () => {
    test('returns the workorder PDF as base64', async () => {
      const file = {
        fileName: 'workorder-reports-WO-1042.pdf',
        contentType: 'application/pdf',
        contentBase64: PDF_BASE64,
        sizeBytes: 9,
      };

      const response = await call('UteamupWorkReportWorkorderPdf', workorderPdfArgs, successReply(file));

      expect(nock.isDone()).toBe(true);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.contentType).toBe('application/pdf');
      expect(Buffer.from(result.contentBase64, 'base64').toString()).toMatch(/^%PDF-/);
      expect(result).not.toHaveProperty('workorderId');
    });

    test('a workorder without visible reports round-trips the NoReports refusal', async () => {
      const reply = toolError(
        'uteamup_work_report_workorder_pdf',
        'NoReports: This workorder has no reports you can see.',
      );

      const response = await call('UteamupWorkReportWorkorderPdf', workorderPdfArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('NoReports: ');
    });

    test('an unknown workorder round-trips as a not-found tool error', async () => {
      const reply = toolError(
        'uteamup_work_report_workorder_pdf',
        `Workorder with GUID ${WORKORDER_GUID} not found.`,
      );

      const response = await call('UteamupWorkReportWorkorderPdf', workorderPdfArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
    });
  });

  describe('UteamupWorkReportExport', () => {
    test('returns the CSV text with its file name and type', async () => {
      const csv = 'Report date,Workorder,Ticket,Description,Cost\n2026-09-20,Pump seal,WO-1042,Replaced the pump seal,120.25\n';
      const file = { fileName: 'reports.csv', contentType: 'text/csv', content: csv };

      const response = await call('UteamupWorkReportExport', exportArgs, successReply(file));

      expect(nock.isDone()).toBe(true);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.fileName).toBe('reports.csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.content.split('\n')[0]).toContain('Report date');
      expect(result.content).toContain('WO-1042');
      expect(result).not.toHaveProperty('contentBase64');
    });

    test('forwards the filter object verbatim, GUID filters included', async () => {
      const expected = JSON.parse(JSON.stringify(exportArgs));

      const response = await call('UteamupWorkReportExport', exportArgs, successReply({ content: '' }));

      expect(nock.isDone()).toBe(true);
      expect(response.body.error).toBeUndefined();
      expect(exportArgs).toEqual(expected);
      expect(exportArgs.filters.workorderGuidFilter).toBe(WORKORDER_GUID);
    });

    test('an empty filter result returns a header-only CSV', async () => {
      const file = { fileName: 'reports.csv', contentType: 'text/csv', content: 'Report date,Workorder\n' };

      const response = await call('UteamupWorkReportExport', exportArgs, successReply(file));

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.content.trim().split('\n')).toHaveLength(1);
    });

    test('too many matching rows round-trip the ExportTooLarge refusal', async () => {
      const reply = toolError(
        'uteamup_work_report_export',
        'ExportTooLarge: More than 10000 reports match. Narrow the filters.',
      );

      const response = await call('UteamupWorkReportExport', exportArgs, reply);

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('ExportTooLarge: ');
    });

    test('a 403 for a Report.View-only key round-trips as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupWorkReportExport',
        exportArgs,
        errorReply(-32000, 'Permission denied: Report.Export required'),
      );

      expect(response.body.result).toBeUndefined();
      expect(response.body.error.code).toBe(-32000);
      expect(response.body.error.message).toBe('Permission denied: Report.Export required');
    });
  });

  describe('UteamupWorkReportSend', () => {
    const sendResult = {
      reportGuid: REPORT_GUID,
      recipientCount: 2,
      externalRecipientCount: 1,
      publishedToPortalAt: '2026-09-25T10:00:00Z',
      finalizedAt: '2026-09-25T10:00:00Z',
      replayed: false,
    };

    test('forwards the idempotency key, confirm and the external-recipient opt-in verbatim', async () => {
      const expected = JSON.parse(JSON.stringify(sendArgs));

      const response = await call('UteamupWorkReportSend', sendArgs, successReply(sendResult));

      expect(nock.isDone()).toBe(true);
      expect(sendArgs).toEqual(expected);
      expect(sendArgs.idempotencyKey).toBe(IDEMPOTENCY_KEY);
      expect(sendArgs.request.confirm).toBe(true);
      expect(sendArgs.request.allowExternalRecipients).toBe(true);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result).toEqual(sendResult);
    });

    test('a retried send returns the first result with replayed = true', async () => {
      const response = await call(
        'UteamupWorkReportSend',
        sendArgs,
        successReply({ ...sendResult, replayed: true }),
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.replayed).toBe(true);
      expect(result.reportGuid).toBe(REPORT_GUID);
    });

    test('confirm = false round-trips the backend validation error', async () => {
      const unconfirmed = { ...sendArgs, request: { ...sendArgs.request, confirm: false } };

      const response = await call(
        'UteamupWorkReportSend',
        unconfirmed,
        errorReply(-32602, 'confirm must be true: sending finalizes the report and cannot be undone (Parameter \'confirm\')'),
      );

      expect(nock.isDone()).toBe(true);
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('confirm must be true');
    });

    test('unconfirmed external recipients round-trip the refusal with their addresses', async () => {
      const reply = toolError(
        'uteamup_work_report_send',
        'ExternalRecipientsUnconfirmed: Confirm the external recipients before sending. '
          + 'Details: {"ExternalRecipients":["outside@example.org"]}',
      );

      const response = await call('UteamupWorkReportSend', sendArgs, reply);

      const { text } = response.body.result.content[0];
      expect(text).toContain('ExternalRecipientsUnconfirmed: ');
      expect(text).toContain('outside@example.org');
    });

    test('a reused idempotency key round-trips idempotency.key-reused', async () => {
      const reply = toolError(
        'uteamup_work_report_send',
        'idempotency.key-reused: The Idempotency-Key was already used for a different request.',
      );

      const response = await call('UteamupWorkReportSend', sendArgs, reply);

      expect(response.body.result.content[0].text).toContain('idempotency.key-reused: ');
    });

    test('an unknown report round-trips as a not-found tool error', async () => {
      const reply = toolError('uteamup_work_report_send', `Report with GUID ${REPORT_GUID} not found.`);

      const response = await call('UteamupWorkReportSend', sendArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
    });

    test('the send rate limit round-trips with its retry delay', async () => {
      const reply = toolError(
        'uteamup_work_report_send',
        'Report send rate limit exceeded. Try again in 42 seconds.',
      );

      const response = await call('UteamupWorkReportSend', sendArgs, reply);

      expect(response.body.result.content[0].text).toMatch(/Try again in 42 seconds\.$/);
    });

    test('a 403 for a Report.View-only key round-trips as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupWorkReportSend',
        sendArgs,
        errorReply(-32000, 'Permission denied: Report.Export required'),
      );

      expect(response.body.result).toBeUndefined();
      expect(response.body.error).toEqual({ code: -32000, message: 'Permission denied: Report.Export required' });
    });
  });

  describe('UteamupWorkReportFinalize', () => {
    test('returns the finalized report', async () => {
      const report = {
        guid: REPORT_GUID,
        description: 'Replaced the pump seal',
        primaryReporterGuid: REPORTER_GUID,
        isFinalized: true,
        finalizedAt: '2026-09-25T10:00:00Z',
        finalizedByName: 'Ada Tech',
        finalizationSource: 'manual',
      };

      const response = await call('UteamupWorkReportFinalize', finalizeArgs, successReply(report));

      expect(nock.isDone()).toBe(true);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.guid).toBe(REPORT_GUID);
      expect(result.isFinalized).toBe(true);
      expect(result.finalizationSource).toBe('manual');
      expect(result).not.toHaveProperty('id');
    });

    test('an unknown report round-trips as a not-found tool error', async () => {
      const reply = toolError('uteamup_work_report_finalize', `Report with GUID ${REPORT_GUID} not found.`);

      const response = await call('UteamupWorkReportFinalize', finalizeArgs, reply);

      expect(response.body.result).toEqual(reply.body.result);
      expect(response.body.result.content[0].text).toContain('not found');
    });

    test('a key without Report.Update round-trips the permission error', async () => {
      const response = await call(
        'UteamupWorkReportFinalize',
        finalizeArgs,
        errorReply(-32000, 'Permission denied: Report.Update required'),
      );

      expect(response.body.error.message).toBe('Permission denied: Report.Update required');
    });
  });

  const tools = [
    { name: 'UteamupWorkReportPdf', args: pdfArgs },
    { name: 'UteamupWorkReportWorkorderPdf', args: workorderPdfArgs },
    { name: 'UteamupWorkReportExport', args: exportArgs },
    { name: 'UteamupWorkReportSend', args: sendArgs },
    { name: 'UteamupWorkReportFinalize', args: finalizeArgs },
  ];

  test('the tool matrix covers every work report output tool exactly once', () => {
    expect(tools).toHaveLength(5);
    expect(new Set(tools.map(tool => tool.name)).size).toBe(tools.length);
  });

  test('no tool takes a tenantId, userId or integer id argument', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const flatten = (args, prefix = '') => Object.entries(args).flatMap(([key, value]) => (
      value && typeof value === 'object' && !Array.isArray(value)
        ? flatten(value, `${prefix}${key}.`)
        : [[`${prefix}${key}`, key, value]]
    ));
    const entries = tools.flatMap(({ name, args }) => flatten(args).map(entry => [name, ...entry]));

    const identityKeys = entries
      .filter(([, , key]) => /^(userId|tenantId|tenantGuid|id)$/i.test(key) || /Ids?$/.test(key))
      .map(([name, path]) => `${name}.${path}`);
    const nonGuidValues = entries
      .filter(([, , key]) => /(Guid|GuidFilter|Key)$/.test(key))
      .filter(([, , , value]) => typeof value !== 'string' || !uuid.test(value))
      .map(([name, path]) => `${name}.${path}`);

    expect(identityKeys).toEqual([]);
    expect(nonGuidValues).toEqual([]);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
