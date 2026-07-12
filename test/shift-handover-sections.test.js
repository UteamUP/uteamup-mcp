/**
 * Shift-handover section MCP proxy contracts.
 *
 * The proxy is intentionally generic. These tests prove that discovery and calls for
 * the GUID-first section tools pass through unchanged, including nested mutation models
 * and opaque concurrency tokens.
 */

'use strict';

const https = require('https');
const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  errorReply,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Shift-handover section MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_handover_sections';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const SECTION_GUID_A = '22222222-2222-4222-8222-222222222222';
  const SECTION_GUID_B = '33333333-3333-4333-8333-333333333333';
  const ORIGINAL_TOKEN = 'handover-token-original';
  const CREATED_TOKEN = 'handover-token-created';
  const UPDATED_TOKEN = 'handover-token-updated';
  const DELETED_TOKEN = 'handover-token-deleted';
  const REORDERED_TOKEN = 'handover-token-reordered';

  const createModel = {
    sectionType: 99,
    title: 'Site constraints',
    content: 'Crane access is restricted after 18:00.',
    sortOrder: 30,
    isRequired: false,
    concurrencyToken: ORIGINAL_TOKEN,
  };
  const updateModel = {
    title: 'Updated site constraints',
    content: 'Crane access is restricted after 17:30.',
    isCompleted: true,
    sortOrder: 10,
    concurrencyToken: CREATED_TOKEN,
  };
  const deleteModel = { concurrencyToken: UPDATED_TOKEN };
  const reorderModel = {
    sectionGuids: [SECTION_GUID_B, SECTION_GUID_A],
    concurrencyToken: UPDATED_TOKEN,
  };

  const getArgs = { handoverGuid: HANDOVER_GUID };
  const createArgs = { handoverGuid: HANDOVER_GUID, model: createModel };
  const updateArgs = {
    handoverGuid: HANDOVER_GUID,
    sectionGuid: SECTION_GUID_A,
    model: updateModel,
  };
  const deleteArgs = {
    handoverGuid: HANDOVER_GUID,
    sectionGuid: SECTION_GUID_A,
    model: deleteModel,
  };
  const reorderArgs = { handoverGuid: HANDOVER_GUID, model: reorderModel };

  const tools = [
    { name: 'UteamupShiftHandoverGetSections', args: getArgs },
    { name: 'UteamupShiftHandoverCreateSection', args: createArgs },
    { name: 'UteamupShiftHandoverUpdateSection', args: updateArgs },
    { name: 'UteamupShiftHandoverDeleteSection', args: deleteArgs },
    { name: 'UteamupShiftHandoverReorderSections', args: reorderArgs },
  ];

  const guidSchema = { type: 'string', format: 'uuid' };
  const concurrencyTokenSchema = { type: 'string', minLength: 1, maxLength: 128 };
  const discoveryTools = [
    {
      name: 'UteamupShiftHandoverGetSections',
      inputSchema: {
        type: 'object',
        properties: { handoverGuid: guidSchema },
        required: ['handoverGuid'],
      },
    },
    {
      name: 'UteamupShiftHandoverCreateSection',
      inputSchema: {
        type: 'object',
        properties: {
          handoverGuid: guidSchema,
          model: {
            type: 'object',
            properties: {
              sectionType: { type: 'integer' },
              title: { type: ['string', 'null'], maxLength: 255 },
              content: { type: ['string', 'null'], maxLength: 100000 },
              sortOrder: { type: ['integer', 'null'], minimum: 0, maximum: 100000 },
              isRequired: { type: 'boolean' },
              concurrencyToken: concurrencyTokenSchema,
            },
            required: ['concurrencyToken'],
          },
        },
        required: ['handoverGuid', 'model'],
      },
    },
    {
      name: 'UteamupShiftHandoverUpdateSection',
      inputSchema: {
        type: 'object',
        properties: {
          handoverGuid: guidSchema,
          sectionGuid: guidSchema,
          model: {
            type: 'object',
            properties: {
              title: { type: ['string', 'null'], maxLength: 255 },
              content: { type: ['string', 'null'], maxLength: 100000 },
              isCompleted: { type: ['boolean', 'null'] },
              sortOrder: { type: ['integer', 'null'], minimum: 0, maximum: 100000 },
              concurrencyToken: concurrencyTokenSchema,
            },
            required: ['concurrencyToken'],
          },
        },
        required: ['handoverGuid', 'sectionGuid', 'model'],
      },
    },
    {
      name: 'UteamupShiftHandoverDeleteSection',
      inputSchema: {
        type: 'object',
        properties: {
          handoverGuid: guidSchema,
          sectionGuid: guidSchema,
          model: {
            type: 'object',
            properties: { concurrencyToken: concurrencyTokenSchema },
            required: ['concurrencyToken'],
          },
        },
        required: ['handoverGuid', 'sectionGuid', 'model'],
      },
    },
    {
      name: 'UteamupShiftHandoverReorderSections',
      inputSchema: {
        type: 'object',
        properties: {
          handoverGuid: guidSchema,
          model: {
            type: 'object',
            properties: {
              sectionGuids: {
                type: 'array',
                items: guidSchema,
                minItems: 1,
                maxItems: 100,
              },
              concurrencyToken: concurrencyTokenSchema,
            },
            required: ['sectionGuids', 'concurrencyToken'],
          },
        },
        required: ['handoverGuid', 'model'],
      },
    },
  ];

  const sectionA = {
    guid: SECTION_GUID_A,
    shiftHandoverGuid: HANDOVER_GUID,
    sectionType: 99,
    title: 'Updated site constraints',
    content: 'Crane access is restricted after 17:30.',
    autoPopulatedData: null,
    sortOrder: 0,
    isRequired: false,
    isCompleted: true,
    createdAt: '2026-07-12T08:00:00Z',
    updatedAt: '2026-07-12T08:05:00Z',
    handoverConcurrencyToken: UPDATED_TOKEN,
  };
  const sectionB = {
    ...sectionA,
    guid: SECTION_GUID_B,
    title: 'Equipment status',
    sectionType: 1,
    sortOrder: 10,
  };

  const forbiddenIntegerIdentityKeys = new Set([
    'id',
    'handoverId',
    'shiftHandoverId',
    'sectionId',
    'tenantId',
    'createdById',
    'updatedById',
  ]);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  const sendToolsList = () => new Promise((resolve, reject) => {
    const payload = JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 91 });
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

  const expectNoIntegerIdentity = value => {
    if (Array.isArray(value)) {
      value.forEach(expectNoIntegerIdentity);
      return;
    }
    if (!value || typeof value !== 'object') return;

    for (const [key, nestedValue] of Object.entries(value)) {
      expect(forbiddenIntegerIdentityKeys).not.toContain(key);
      expectNoIntegerIdentity(nestedValue);
    }
  };

  describe('tool discovery', () => {
    test('tools/list exposes all five GUID-first section tools and their model arguments', async () => {
      let captured = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          captured = body;
          return body.method === 'tools/list';
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { tools: discoveryTools },
          id: 91,
        }), { 'Content-Type': 'application/json' });

      const response = await sendToolsList();

      expect(captured).toEqual({ jsonrpc: '2.0', method: 'tools/list', id: 91 });
      expect(response.result.tools).toEqual(discoveryTools);
      expect(response.result.tools.map(tool => tool.name)).toEqual(tools.map(tool => tool.name));
      expectNoIntegerIdentity(response.result.tools);
    });
  });

  describe('argument round-trip', () => {
    test.each(tools)('$name forwards GUID and nested model arguments verbatim', async ({ name, args }) => {
      const captured = await captureCall(name, args);

      expect(captured.params).toEqual({ name, arguments: args });
      expect(captured.params.arguments.handoverGuid).toBe(HANDOVER_GUID);
      expectNoIntegerIdentity(captured.params.arguments);
    });

    test('mutation calls preserve each opaque concurrency token exactly', async () => {
      const mutations = [
        ['UteamupShiftHandoverCreateSection', createArgs, ORIGINAL_TOKEN],
        ['UteamupShiftHandoverUpdateSection', updateArgs, CREATED_TOKEN],
        ['UteamupShiftHandoverDeleteSection', deleteArgs, UPDATED_TOKEN],
        ['UteamupShiftHandoverReorderSections', reorderArgs, UPDATED_TOKEN],
      ];

      for (const [name, args, token] of mutations) {
        const captured = await captureCall(name, args);
        expect(captured.params.arguments.model.concurrencyToken).toBe(token);
      }
    });
  });

  describe('success responses', () => {
    test('get returns GUID-only section identities and the latest handover token', async () => {
      const response = await call(
        'UteamupShiftHandoverGetSections',
        getArgs,
        successReply([sectionA, sectionB]),
      );

      const sections = JSON.parse(response.body.result.content[0].text);
      expect(sections).toHaveLength(2);
      expect(sections[0].guid).toBe(SECTION_GUID_A);
      expect(sections[0].shiftHandoverGuid).toBe(HANDOVER_GUID);
      expect(sections[0].handoverConcurrencyToken).toBe(UPDATED_TOKEN);
      expectNoIntegerIdentity(sections);
    });

    test('get preserves an empty section collection', async () => {
      const response = await call(
        'UteamupShiftHandoverGetSections',
        getArgs,
        successReply([]),
      );

      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    test('create returns the new section GUID and refreshed handover token', async () => {
      const created = {
        ...sectionA,
        title: createModel.title,
        content: createModel.content,
        isCompleted: false,
        handoverConcurrencyToken: CREATED_TOKEN,
      };
      const response = await call(
        'UteamupShiftHandoverCreateSection',
        createArgs,
        successReply(created),
      );

      const section = JSON.parse(response.body.result.content[0].text);
      expect(section.guid).toBe(SECTION_GUID_A);
      expect(section.handoverConcurrencyToken).toBe(CREATED_TOKEN);
      expectNoIntegerIdentity(section);
    });

    test('update returns edited completion state and refreshed handover token', async () => {
      const response = await call(
        'UteamupShiftHandoverUpdateSection',
        updateArgs,
        successReply(sectionA),
      );

      const section = JSON.parse(response.body.result.content[0].text);
      expect(section.isCompleted).toBe(true);
      expect(section.handoverConcurrencyToken).toBe(UPDATED_TOKEN);
      expectNoIntegerIdentity(section);
    });

    test('delete returns only the deleted section GUID and refreshed handover token', async () => {
      const deleted = {
        sectionGuid: SECTION_GUID_A,
        handoverConcurrencyToken: DELETED_TOKEN,
      };
      const response = await call(
        'UteamupShiftHandoverDeleteSection',
        deleteArgs,
        successReply(deleted),
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result).toEqual(deleted);
      expectNoIntegerIdentity(result);
    });

    test('reorder preserves the absolute GUID order and returns a refreshed token', async () => {
      const reordered = [
        { ...sectionB, sortOrder: 0, handoverConcurrencyToken: REORDERED_TOKEN },
        { ...sectionA, sortOrder: 10, handoverConcurrencyToken: REORDERED_TOKEN },
      ];
      const response = await call(
        'UteamupShiftHandoverReorderSections',
        reorderArgs,
        successReply(reordered),
      );

      const sections = JSON.parse(response.body.result.content[0].text);
      expect(sections.map(section => section.guid)).toEqual(reorderModel.sectionGuids);
      expect(sections.every(section => section.handoverConcurrencyToken === REORDERED_TOKEN)).toBe(true);
      expectNoIntegerIdentity(sections);
    });
  });

  describe('error pass-through', () => {
    test.each(tools)('$name preserves backend JSON-RPC errors', async ({ name, args }) => {
      const response = await call(
        name,
        args,
        errorReply(-32602, 'Shift handover section validation failed'),
      );

      expect(response.body.error).toEqual({
        code: -32602,
        message: 'Shift handover section validation failed',
      });
      expect(response.body.result).toBeUndefined();
    });

    test('update preserves stale-concurrency conflict details', async () => {
      const response = await call(
        'UteamupShiftHandoverUpdateSection',
        updateArgs,
        errorReply(-32009, 'The shift handover changed. Refresh and retry.'),
      );

      expect(response.body.error.code).toBe(-32009);
      expect(response.body.error.message).toContain('Refresh and retry');
    });
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
