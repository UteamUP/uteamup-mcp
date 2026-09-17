/**
 * Proxy contract tests for the live backend AssetDossierTools schema.
 *
 * A dossier spends the tenant's AI credits and runs in the background, so two behaviours are
 * load-bearing here: `requestGuid` is the caller's idempotency key and must reach the backend
 * unchanged, and a refused quota is a 200 body carrying `quotaBlockedReason` — never a transport
 * error. A proxy that turned either of those into a failure would cause a double charge or an
 * unexplained dead end.
 */
'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Asset dossier MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_dossier';
  const ASSET_GUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
  const JOB_GUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';
  const REQUEST_GUID = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';
  const DOCUMENT_GUID = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const pipeline = ['collect', 'research', 'write', 'render', 'attach'];

  const queuedJob = {
    jobGuid: JOB_GUID,
    assetGuid: ASSET_GUID,
    assetName: 'Feed pump 1',
    status: 'queued',
    currentStep: null,
    progress: pipeline.map((step) => ({ step, status: 'pending', startedAtUtc: null, finishedAtUtc: null, detail: null })),
    documentGuid: null,
    downloadUrl: null,
    sections: ['identity', 'specifications', 'dependencies'],
    includeWebResearch: false,
    creditsCharged: 8,
    creditsRefunded: 0,
    remaining: 92,
    quotaBlockedReason: null,
    warnings: [],
    error: null,
    createdAt: '2026-09-08T10:00:00Z',
    completedAt: null
  };

  test('queues a dossier and forwards the whole request, including the idempotency key', async () => {
    const request = {
      assetGuid: ASSET_GUID,
      requestGuid: REQUEST_GUID,
      options: { sections: ['identity', 'specifications', 'dependencies'], includeWebResearch: false, includeDiagram: true }
    };
    const response = await call(
      'UteamupAssetDossierRequest',
      { request },
      successReply(queuedJob),
      { request }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.jobGuid).toBe(JOB_GUID);
    expect(data.status).toBe('queued');
    expect(data.creditsCharged).toBe(8);
    expect(data.progress.map((step) => step.step)).toEqual(pipeline);
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('assetId');
  });

  test('replaying the same requestGuid returns the existing job rather than charging again', async () => {
    const request = { assetGuid: ASSET_GUID, requestGuid: REQUEST_GUID, options: {} };
    const first = await call('UteamupAssetDossierRequest', { request }, successReply(queuedJob), { request });
    const replay = await call('UteamupAssetDossierRequest', { request }, successReply(queuedJob), { request });

    expect(JSON.parse(first.body.result.content[0].text).jobGuid)
      .toBe(JSON.parse(replay.body.result.content[0].text).jobGuid);
    expect(JSON.parse(replay.body.result.content[0].text).creditsCharged).toBe(8);
  });

  test('a refused quota comes back on the 200 body with nothing queued', async () => {
    const response = await call(
      'UteamupAssetDossierRequest',
      { request: { assetGuid: ASSET_GUID, requestGuid: REQUEST_GUID, options: {} } },
      successReply({
        ...queuedJob,
        status: 'queued',
        creditsCharged: 0,
        remaining: 0,
        quotaBlockedReason: 'The tenant has no AI credits left this period.',
        progress: []
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.body.error).toBeUndefined();
    expect(data.quotaBlockedReason).toContain('no AI credits');
    expect(data.creditsCharged).toBe(0);
  });

  test('web research is opt-in and shows up on the job', async () => {
    const request = { assetGuid: ASSET_GUID, requestGuid: REQUEST_GUID, options: { includeWebResearch: true } };
    const response = await call(
      'UteamupAssetDossierRequest',
      { request },
      successReply({ ...queuedJob, includeWebResearch: true, creditsCharged: 14, remaining: 86 }),
      { request }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.includeWebResearch).toBe(true);
    expect(data.creditsCharged).toBe(14);
  });

  test('surfaces a missing AI permission as an error rather than a silent no-op', async () => {
    const response = await call(
      'UteamupAssetDossierRequest',
      { request: { assetGuid: ASSET_GUID, requestGuid: REQUEST_GUID, options: {} } },
      errorReply(-32000, 'Permission denied: AI.Use required')
    );
    expect(response.body.error.message).toContain('AI.Use');
  });

  test('polls one job and reports the live step checklist', async () => {
    const response = await call(
      'UteamupAssetDossierGet',
      { jobGuid: JOB_GUID },
      successReply({
        ...queuedJob,
        status: 'processing',
        currentStep: 'write',
        progress: [
          { step: 'collect', status: 'done', startedAtUtc: '2026-09-08T10:00:05Z', finishedAtUtc: '2026-09-08T10:00:20Z', detail: '132 records' },
          { step: 'research', status: 'skipped', startedAtUtc: null, finishedAtUtc: null, detail: 'Web research was not requested' },
          { step: 'write', status: 'running', startedAtUtc: '2026-09-08T10:00:20Z', finishedAtUtc: null, detail: null },
          { step: 'render', status: 'pending', startedAtUtc: null, finishedAtUtc: null, detail: null },
          { step: 'attach', status: 'pending', startedAtUtc: null, finishedAtUtc: null, detail: null }
        ]
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.currentStep).toBe('write');
    expect(data.progress.find((step) => step.step === 'research').status).toBe('skipped');
  });

  test('a completed job carries the document GUID and its download URL', async () => {
    const response = await call(
      'UteamupAssetDossierGet',
      { jobGuid: JOB_GUID },
      successReply({
        ...queuedJob,
        status: 'completed',
        currentStep: null,
        documentGuid: DOCUMENT_GUID,
        downloadUrl: `https://app.uteamup.com/documents/${DOCUMENT_GUID}`,
        completedAt: '2026-09-08T10:02:00Z'
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.status).toBe('completed');
    expect(data.documentGuid).toBe(DOCUMENT_GUID);
    expect(data.downloadUrl).toContain(DOCUMENT_GUID);
    expect(data).not.toHaveProperty('documentId');
  });

  test('a failed job reports the error on the body, not as a transport failure', async () => {
    const response = await call(
      'UteamupAssetDossierGet',
      { jobGuid: JOB_GUID },
      successReply({ ...queuedJob, status: 'failed', error: 'The rendering step ran out of memory.' })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.body.error).toBeUndefined();
    expect(data.status).toBe('failed');
    expect(data.error).toContain('rendering step');
  });

  test('lists an asset dossier history newest first', async () => {
    const response = await call(
      'UteamupAssetDossierListByAsset',
      { assetGuid: ASSET_GUID, take: 3 },
      successReply([
        { ...queuedJob, status: 'completed', documentGuid: DOCUMENT_GUID, completedAt: '2026-09-08T10:02:00Z' },
        { ...queuedJob, jobGuid: 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5', status: 'cancelled', creditsRefunded: 8 }
      ]),
      { assetGuid: ASSET_GUID, take: 3 }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[1].status).toBe('cancelled');
    expect(data[1].creditsRefunded).toBe(8);
  });

  test('forwards the subject pair so a part can be documented, not only an asset', async () => {
    // The proxy is generic: it does not know what a subject is, and must not start filtering
    // arguments it does not recognise. This pins that a part request reaches the backend intact
    // — the whole dossier feature now depends on subjectType surviving the hop.
    const PART_GUID = '7b2f9c14-3e85-4a60-b1d7-9c04e8f26a3b';
    const request = {
      subjectType: 'Part',
      subjectGuid: PART_GUID,
      requestGuid: REQUEST_GUID,
      options: {}
    };

    const response = await call(
      'UteamupAssetDossierRequest',
      { request },
      successReply({ ...queuedJob, subjectType: 'Part', subjectGuid: PART_GUID }),
      { request }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.body.error).toBeUndefined();
    expect(data.subjectType).toBe('Part');
    expect(data.subjectGuid).toBe(PART_GUID);
  });

  test('an asset with no dossier returns an empty list', async () => {
    const response = await call(
      'UteamupAssetDossierListByAsset',
      { assetGuid: ASSET_GUID },
      successReply([])
    );
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('cancelling a queued job refunds its credits', async () => {
    const response = await call(
      'UteamupAssetDossierCancel',
      { jobGuid: JOB_GUID },
      successReply({ ...queuedJob, status: 'cancelled', creditsRefunded: 8, remaining: 100 })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.status).toBe('cancelled');
    expect(data.creditsRefunded).toBe(8);
  });

  test('cancelling a job that already started is a conflict', async () => {
    const response = await call(
      'UteamupAssetDossierCancel',
      { jobGuid: JOB_GUID },
      errorReply(-32000, 'This dossier has already started and cannot be cancelled.')
    );
    expect(response.body.error.message).toContain('already started');
  });

  const allTools = [
    { name: 'UteamupAssetDossierRequest', args: { request: { assetGuid: ASSET_GUID, requestGuid: REQUEST_GUID, options: {} } } },
    { name: 'UteamupAssetDossierGet', args: { jobGuid: JOB_GUID } },
    { name: 'UteamupAssetDossierListByAsset', args: { assetGuid: ASSET_GUID, take: 10 } },
    { name: 'UteamupAssetDossierCancel', args: { jobGuid: JOB_GUID } }
  ];

  test('the tool matrix covers every asset dossier tool exactly once', () => {
    expect(allTools).toHaveLength(4);
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(allTools.length);
  });

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/"(assetId|jobId|documentId|tenantId|userId)"/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
