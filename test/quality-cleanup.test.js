/** Enterprise Quality document-cleanup operator MCP proxy contracts. */
'use strict';

const nock = require('nock');
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Quality cleanup operator MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_cleanup';
  const CLEANUP_JOB_GUID = '5a19b61e-dd79-4db7-8384-9f1fb968d27f';
  const DOCUMENT_GUID = 'c80955a6-4427-4c6a-9369-f7506782dd56';
  const IDEMPOTENCY_KEY = '4ee53732-9842-4621-bd86-a90e38f22d91';

  const listTool = {
    name: 'UteamupQualityCleanupDeadLettersList',
    args: { page: 2, pageSize: 25 },
  };
  const getTool = {
    name: 'UteamupQualityCleanupDeadLetterGet',
    args: { cleanupJobGuid: CLEANUP_JOB_GUID },
  };
  const redriveTool = {
    name: 'UteamupQualityCleanupDeadLetterRedrive',
    args: {
      cleanupJobGuid: CLEANUP_JOB_GUID,
      previewToken: 'preview-token-redacted-and-bounded',
      reason: 'Transient Azure provider outage has cleared.',
      confirmed: true,
      idempotencyKey: IDEMPOTENCY_KEY,
      concurrencyToken: 'cleanup-etag-v3',
    },
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('forwards bounded dead-letter pagination without caller-controlled identity', async () => {
    const response = await call(
      listTool.name,
      listTool.args,
      successReply({
        items: [{
          cleanupJobGuid: CLEANUP_JOB_GUID,
          documentGuid: DOCUMENT_GUID,
          status: 'DeadLetter',
          lastFailureCode: 'DOCUMENT_STORAGE_CLEANUP_PROVIDER_TIMEOUT',
          canRedrive: true,
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      listTool.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].cleanupJobGuid).toBe(CLEANUP_JOB_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
    expect(data.items[0]).not.toHaveProperty('routeSnapshotJson');
    expect(data.items[0]).not.toHaveProperty('cleanupKey');
    expect(listTool.args).not.toHaveProperty('tenantGuid');
    expect(listTool.args).not.toHaveProperty('userId');
  });

  test('preserves an empty dead-letter page', async () => {
    const response = await call(
      listTool.name,
      {},
      successReply({ items: [], totalCount: 0, page: 1, pageSize: 25 }),
      {},
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  test('returns a redacted detail and bounded preview contract', async () => {
    const response = await call(
      getTool.name,
      getTool.args,
      successReply({
        cleanupJobGuid: CLEANUP_JOB_GUID,
        documentGuid: DOCUMENT_GUID,
        status: 'DeadLetter',
        lastFailureCode: 'DOCUMENT_STORAGE_CLEANUP_PROVIDER_TIMEOUT',
        canRedrive: true,
        previewToken: 'preview-token-redacted-and-bounded',
        previewExpiresAtUtc: '2026-08-28T15:15:00Z',
        concurrencyToken: 'cleanup-etag-v3',
      }),
      getTool.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.cleanupJobGuid).toBe(CLEANUP_JOB_GUID);
    expect(data.canRedrive).toBe(true);
    expect(data).not.toHaveProperty('storageConfigurationGuid');
    expect(data).not.toHaveProperty('providerRoute');
    expect(data).not.toHaveProperty('leaseId');
  });

  test('preserves a missing dead letter as a null success', async () => {
    const response = await call(
      getTool.name,
      getTool.args,
      successReply(null),
      getTool.args,
    );

    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  test('forwards preview, confirmation, idempotency, and concurrency arguments verbatim', async () => {
    const response = await call(
      redriveTool.name,
      redriveTool.args,
      successReply({
        cleanupJobGuid: CLEANUP_JOB_GUID,
        status: 'Pending',
        receiptGuid: 'b08547c6-b670-451b-b080-485c5f161ab8',
        redrivenAtUtc: '2026-08-28T15:10:00Z',
        concurrencyToken: 'cleanup-etag-v4',
        idempotencyReplayed: false,
      }),
      redriveTool.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.cleanupJobGuid).toBe(CLEANUP_JOB_GUID);
    expect(data.status).toBe('Pending');
    expect(redriveTool.args.confirmed).toBe(true);
    expect(redriveTool.args.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(redriveTool.args).not.toHaveProperty('tenantGuid');
    expect(redriveTool.args).not.toHaveProperty('userId');
  });

  test('passes through a stale preview or ETag conflict without retrying it as success', async () => {
    const response = await call(
      redriveTool.name,
      redriveTool.args,
      errorReply(-32000, 'The cleanup preview or ETag is stale.'),
    );

    expect(response.body.error.message).toMatch(/stale/i);
  });

  const tools = [listTool, getTool, redriveTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
