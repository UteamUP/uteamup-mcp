/**
 * Document metadata + timeline MCP tool tests (document-metadata-and-timeline).
 *
 * Covers the 2 MCP tools added on top of the existing /document endpoints:
 *   - UteamupDocumentGetMetadata
 *   - UteamupDocumentGetTimeline
 *
 * Same generic-proxy pattern as document-import-tools.test.js — nock-mocked
 * backend, no real network calls.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Document metadata + timeline MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_document_metadata';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── UteamupDocumentGetMetadata ─────────────────────────────────────────

  describe('UteamupDocumentGetMetadata', () => {
    const metadataPayload = {
      guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      status: 'Extracted',
      title: 'Site visit',
      author: 'photographer@uteamup.com',
      capturedAt: '2026-05-10T14:23:00Z',
      capturedAtSource: 'Exif',
      image: {
        width: 4032,
        height: 3024,
        cameraMake: 'Apple',
        cameraModel: 'iPhone 15 Pro',
        iso: 200,
        fNumber: 1.8,
        exposureTimeSec: 0.008,
        gpsLatitude: 64.1466,
        gpsLongitude: -21.9426,
      },
      thumbnails: {
        micro: 'documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/thumb-48-abc123.webp',
        small: 'documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/thumb-128-abc123.webp',
        medium: 'documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/thumb-512-abc123.webp',
      },
    };

    it('returns extracted metadata for a known GUID', async () => {
      const response = await call(
        'UteamupDocumentGetMetadata',
        { guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        successReply(metadataPayload),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(data.image.cameraModel).toBe('iPhone 15 Pro');
      expect(data.capturedAtSource).toBe('Exif');
      expect(data.thumbnails.medium).toContain('thumb-512');
    });

    it('returns null when the document is not found', async () => {
      const response = await call(
        'UteamupDocumentGetMetadata',
        { guid: '00000000-0000-0000-0000-000000000000' },
        successReply(null),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });
  });

  // ── UteamupDocumentGetTimeline ─────────────────────────────────────────

  describe('UteamupDocumentGetTimeline', () => {
    const timelinePayload = [
      {
        guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        fileName: 'IMG_4821.jpg',
        contentType: 'image/jpeg',
        fileSize: 4_700_000,
        capturedAt: '2026-05-10T14:23:00Z',
        capturedAtSource: 'Exif',
        title: 'Site visit',
        thumbnails: null,
      },
      {
        guid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        fileSize: 1_200_000,
        capturedAt: '2026-05-12T09:00:00Z',
        capturedAtSource: 'PdfInfo',
        title: null,
        thumbnails: null,
      },
    ];

    it('returns ordered timeline entries for the default range', async () => {
      const response = await call(
        'UteamupDocumentGetTimeline',
        {},
        successReply(timelinePayload),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].guid).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(data[1].capturedAtSource).toBe('PdfInfo');
    });

    it('passes explicit date + types filter through to the backend', async () => {
      const response = await call(
        'UteamupDocumentGetTimeline',
        {
          from: '2026-05-01T00:00:00Z',
          to: '2026-05-14T00:00:00Z',
          types: 'image/jpeg,application/pdf',
          limit: 100,
        },
        successReply(timelinePayload),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
    });

    it('returns an empty array when no documents match', async () => {
      const response = await call(
        'UteamupDocumentGetTimeline',
        { from: '2099-01-01T00:00:00Z', to: '2099-01-02T00:00:00Z' },
        successReply([]),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });
  });

  // ── Generic error-shape compliance ─────────────────────────────────────

  const tools = [
    { name: 'UteamupDocumentGetMetadata', args: { guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } },
    { name: 'UteamupDocumentGetTimeline', args: {} },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
