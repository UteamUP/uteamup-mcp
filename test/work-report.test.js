'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Work report MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'work-report-token';
  const WORKORDER_GUID = '7b7fbd71-4ecf-4c3e-9e36-b87d447ab117';
  const REPORT_GUID = '9c1a5b4e-1f7d-4b2a-8c3e-5d6f7a8b9c0d';
  const REPORTER_GUID = '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
  const WORKER_GUID = '3a4b5c6d-7e8f-4a0b-9c1d-2e3f4a5b6c7d';
  const IDEMPOTENCY_KEY = '5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f';

  // callMcpTool only replies when the forwarded arguments deep-equal these objects, so every
  // round-trip below proves the proxy forwards the arguments verbatim.
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, toolArgs);

  const listArgs = { workorderGuid: WORKORDER_GUID, nameFilter: 'seal', page: 2, pageSize: 5 };
  const getArgs = { reportGuid: REPORT_GUID };
  const detailArgs = { reportGuid: REPORT_GUID };
  const createArgs = {
    idempotencyKey: IDEMPOTENCY_KEY,
    workorderGuid: WORKORDER_GUID,
    description: 'Replaced the pump seal',
    reportDate: '2026-09-20',
    closeOutNotes: 'Seal was cracked',
    timeSpent: 3.5,
    costIncurred: 120.25,
    primaryReporterGuid: REPORTER_GUID,
    additionalWorkerGuids: [WORKER_GUID],
    externalWorkerEmails: ['contractor@example.com'],
    notifyExternalWorkers: true,
  };
  const updateArgs = {
    reportGuid: REPORT_GUID,
    description: 'Replaced the pump seal and gasket',
    reportDate: '2026-09-21',
    closeOutNotes: 'Gasket also worn',
    timeSpent: 4,
    costIncurred: 150,
    primaryReporterGuid: REPORTER_GUID,
    additionalWorkerGuids: [WORKER_GUID],
    externalWorkerEmails: [],
  };
  const deleteArgs = { reportGuid: REPORT_GUID };

  const reportResponse = {
    guid: REPORT_GUID,
    description: 'Replaced the pump seal',
    reportDate: '2026-09-20T00:00:00Z',
    primaryReporterGuid: REPORTER_GUID,
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('list round-trips one workorder page with GUID people references', async () => {
    const page = {
      items: [{
        guid: REPORT_GUID,
        description: 'Replaced the pump seal',
        reportDate: '2026-09-20T00:00:00Z',
        workorder: { guid: WORKORDER_GUID, name: 'Pump seal' },
        primaryReporter: { userGuid: REPORTER_GUID, fullName: 'Ada Tech', email: 'ada@example.com' },
        signatureCount: 1,
      }],
      currentPage: 2,
      pageSize: 5,
      totalItems: 6,
      totalPages: 2,
    };

    const response = await call('UteamupWorkReportList', listArgs, successReply(page));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.currentPage).toBe(2);
    expect(result.items[0].guid).toBe(REPORT_GUID);
    expect(result.items[0].primaryReporter.userGuid).toBe(REPORTER_GUID);
    expect(result.items[0].signatureCount).toBe(1);
  });

  test('list returns an empty page as items: []', async () => {
    const response = await call(
      'UteamupWorkReportList',
      listArgs,
      successReply({ items: [], currentPage: 2, pageSize: 5, totalItems: 0, totalPages: 0 }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  test('get round-trips one work report by its GUID', async () => {
    const report = {
      guid: REPORT_GUID,
      description: 'Replaced the pump seal',
      primaryReporterName: 'Ada Tech',
      additionalWorkers: [{ userGuid: WORKER_GUID, fullName: 'Bo Helper', email: 'bo@example.com' }],
      externalWorkers: [{ guid: IDEMPOTENCY_KEY, email: 'contractor@example.com' }],
    };

    const response = await call('UteamupWorkReportGet', getArgs, successReply(report));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.guid).toBe(REPORT_GUID);
    expect(result.additionalWorkers[0].userGuid).toBe(WORKER_GUID);
    expect(result.externalWorkers[0].email).toBe('contractor@example.com');
  });

  test('detail round-trips the review detail with its evidence blocks', async () => {
    const detail = {
      guid: REPORT_GUID,
      primaryReporterGuid: REPORTER_GUID,
      signatures: [{ signerName: 'Ada Tech', signedAt: '2026-09-20T12:00:00Z', source: 'Workorder', signatureType: 'Technician' }],
      documents: [],
      materialLines: [{ stockItemGuid: WORKER_GUID, name: 'Seal kit', quantity: 1, unitCost: null, lineTotal: null }],
      failures: [],
      resolutionNote: 'Seal replaced',
    };

    const response = await call('UteamupWorkReportDetail', detailArgs, successReply(detail));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.primaryReporterGuid).toBe(REPORTER_GUID);
    expect(result.signatures).toHaveLength(1);
    expect(result.materialLines[0].unitCost).toBeNull();
    expect(result.resolutionNote).toBe('Seal replaced');
  });

  test('create forwards the idempotency key, the GUID workers and the email opt-in', async () => {
    const response = await call('UteamupWorkReportCreate', createArgs, successReply(reportResponse));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.guid).toBe(REPORT_GUID);
    expect(result.primaryReporterGuid).toBe(REPORTER_GUID);
  });

  test('update forwards the required description and reportDate with the replaced values', async () => {
    const response = await call(
      'UteamupWorkReportUpdate',
      updateArgs,
      successReply({ ...reportResponse, description: updateArgs.description, reportDate: '2026-09-21T00:00:00Z' }),
    );

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.description).toBe('Replaced the pump seal and gasket');
    expect(result.reportDate).toBe('2026-09-21T00:00:00Z');
  });

  test('delete round-trips a boolean result', async () => {
    const response = await call('UteamupWorkReportDelete', deleteArgs, successReply(true));

    expect(nock.isDone()).toBe(true);
    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
  });

  test('update forwards overrideReason verbatim', async () => {
    const overrideArgs = { ...updateArgs, overrideReason: 'Customer name misspelled' };
    const expected = JSON.parse(JSON.stringify(overrideArgs));

    const response = await call(
      'UteamupWorkReportUpdate',
      overrideArgs,
      successReply({ ...reportResponse, description: updateArgs.description, isFinalized: true }),
    );

    expect(nock.isDone()).toBe(true);
    expect(overrideArgs).toEqual(expected);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.isFinalized).toBe(true);
    expect(result.description).toBe('Replaced the pump seal and gasket');
  });

  test('delete forwards overrideReason verbatim', async () => {
    const overrideArgs = { reportGuid: REPORT_GUID, overrideReason: 'Filed on the wrong workorder' };
    const expected = JSON.parse(JSON.stringify(overrideArgs));

    const response = await call('UteamupWorkReportDelete', overrideArgs, successReply(true));

    expect(nock.isDone()).toBe(true);
    expect(overrideArgs).toEqual(expected);
    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
  });

  test('a finalized report without overrideReason round-trips OverrideReasonRequired', async () => {
    // The SDK shows a handler's McpException as an isError tool result carrying the refusal code.
    const toolError = {
      content: [{
        type: 'text',
        text: 'An error occurred invoking \'uteamup_work_report_delete\': '
          + 'OverrideReasonRequired: A finalized report needs an override reason of 10-500 characters.',
      }],
      isError: true,
    };

    const response = await call(
      'UteamupWorkReportDelete',
      deleteArgs,
      { status: 200, body: { jsonrpc: '2.0', result: toolError, id: 1 } },
    );

    expect(response.body.error).toBeUndefined();
    expect(response.body.result).toEqual(toolError);
    expect(response.body.result.content[0].text).toContain('OverrideReasonRequired: ');
  });

  test('a JSON-RPC error from the backend round-trips unchanged', async () => {
    const response = await call(
      'UteamupWorkReportCreate',
      createArgs,
      errorReply(-32000, 'You cannot create reports for this workorder.'),
    );

    expect(response.status).toBe(200);
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.code).toBe(-32000);
    expect(response.body.error.message).toBe('You cannot create reports for this workorder.');
  });

  const tools = [
    { name: 'UteamupWorkReportList', args: listArgs },
    { name: 'UteamupWorkReportGet', args: getArgs },
    { name: 'UteamupWorkReportDetail', args: detailArgs },
    { name: 'UteamupWorkReportCreate', args: createArgs },
    { name: 'UteamupWorkReportUpdate', args: updateArgs },
    { name: 'UteamupWorkReportDelete', args: deleteArgs },
  ];

  test('the tool matrix covers every work report tool exactly once', () => {
    expect(tools).toHaveLength(6);
    expect(new Set(tools.map(tool => tool.name)).size).toBe(tools.length);
  });

  test('no tool takes a userId, tenantId or integer id argument', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const identityKeys = tools.flatMap(({ name, args }) => Object.keys(args)
      .filter(key => /^(userId|tenantId|id)$/i.test(key) || /Ids?$/.test(key))
      .map(key => `${name}.${key}`));
    const nonGuidValues = tools.flatMap(({ name, args }) => Object.entries(args)
      .filter(([key]) => /(Guid|Guids|Key)$/.test(key))
      .flatMap(([key, value]) => [].concat(value)
        .filter(item => typeof item !== 'string' || !uuid.test(item))
        .map(() => `${name}.${key}`)));

    expect(identityKeys).toEqual([]);
    expect(nonGuidValues).toEqual([]);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
