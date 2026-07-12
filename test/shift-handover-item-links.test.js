/**
 * Shift-handover operational-link MCP proxy contracts.
 *
 * The proxy is generic. These tests prove that discovery, calls, linked entity
 * models, and opaque concurrency tokens pass through unchanged for both item kinds.
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

describe('Shift-handover operational-link MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_handover_item_links';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const SECTION_GUID = '22222222-2222-4222-8222-222222222222';
  const CARRY_OVER_GUID = '33333333-3333-4333-8333-333333333333';
  const LINK_GUID = '44444444-4444-4444-8444-444444444444';
  const PROJECT_GUID = '55555555-5555-4555-8555-555555555555';
  const TOKEN = 'handover-token-current';
  const NEXT_TOKEN = 'handover-token-next';
  const createModel = {
    linkedEntityType: 'project',
    linkedEntityGuid: PROJECT_GUID,
    concurrencyToken: TOKEN,
  };

  const tools = [
    {
      name: 'UteamupShiftHandoverGetSectionLinks',
      args: { handoverGuid: HANDOVER_GUID, sectionGuid: SECTION_GUID },
    },
    {
      name: 'UteamupShiftHandoverCreateSectionLink',
      args: { handoverGuid: HANDOVER_GUID, sectionGuid: SECTION_GUID, model: createModel },
    },
    {
      name: 'UteamupShiftHandoverDeleteSectionLink',
      args: {
        handoverGuid: HANDOVER_GUID,
        sectionGuid: SECTION_GUID,
        linkGuid: LINK_GUID,
        concurrencyToken: TOKEN,
      },
    },
    {
      name: 'UteamupShiftHandoverGetCarryOverLinks',
      args: { handoverGuid: HANDOVER_GUID, carryOverGuid: CARRY_OVER_GUID },
    },
    {
      name: 'UteamupShiftHandoverCreateCarryOverLink',
      args: { handoverGuid: HANDOVER_GUID, carryOverGuid: CARRY_OVER_GUID, model: createModel },
    },
    {
      name: 'UteamupShiftHandoverDeleteCarryOverLink',
      args: {
        handoverGuid: HANDOVER_GUID,
        carryOverGuid: CARRY_OVER_GUID,
        linkGuid: LINK_GUID,
        concurrencyToken: TOKEN,
      },
    },
  ];

  const guidSchema = { type: 'string', format: 'uuid' };
  const tokenSchema = { type: 'string', minLength: 1, maxLength: 128 };
  const modelSchema = {
    type: 'object',
    properties: {
      linkedEntityType: {
        type: 'string',
        enum: [
          'project',
          'workOrder',
          'asset',
          'location',
          'workPermit',
          'incident',
          'journal',
          'document',
        ],
      },
      linkedEntityGuid: guidSchema,
      concurrencyToken: tokenSchema,
    },
    required: ['linkedEntityType', 'linkedEntityGuid', 'concurrencyToken'],
  };
  function createDiscoveryTool(name, itemGuidName, extraProperties = {}) {
    return {
      name,
      inputSchema: {
        type: 'object',
        properties: {
          handoverGuid: guidSchema,
          [itemGuidName]: guidSchema,
          ...extraProperties,
        },
        required: ['handoverGuid', itemGuidName, ...Object.keys(extraProperties)],
      },
    };
  }

  const discoveryTools = [
    createDiscoveryTool('UteamupShiftHandoverGetSectionLinks', 'sectionGuid'),
    createDiscoveryTool('UteamupShiftHandoverCreateSectionLink', 'sectionGuid', {
      model: modelSchema,
    }),
    createDiscoveryTool('UteamupShiftHandoverDeleteSectionLink', 'sectionGuid', {
      linkGuid: guidSchema,
      concurrencyToken: tokenSchema,
    }),
    createDiscoveryTool('UteamupShiftHandoverGetCarryOverLinks', 'carryOverGuid'),
    createDiscoveryTool('UteamupShiftHandoverCreateCarryOverLink', 'carryOverGuid', {
      model: modelSchema,
    }),
    createDiscoveryTool('UteamupShiftHandoverDeleteCarryOverLink', 'carryOverGuid', {
      linkGuid: guidSchema,
      concurrencyToken: tokenSchema,
    }),
  ];
  const forbiddenIntegerIdentityKeys = new Set([
    'id',
    'handoverId',
    'shiftHandoverId',
    'sectionId',
    'carryOverId',
    'linkId',
    'linkedEntityId',
    'tenantId',
  ]);

  const linkedRecord = {
    guid: LINK_GUID,
    shiftHandoverGuid: HANDOVER_GUID,
    itemKind: 'section',
    itemGuid: SECTION_GUID,
    linkedEntityType: 'project',
    linkedEntityGuid: PROJECT_GUID,
    displayName: 'North plant upgrade',
    createdAt: '2026-07-12T08:00:00Z',
    handoverConcurrencyToken: NEXT_TOKEN,
  };

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
    const payload = JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 93 });
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

  test('tools/list exposes all six GUID-first operational-link tools', async () => {
    nock(BASE_URL)
      .post('/mcp', body => body.method === 'tools/list')
      .reply(200, JSON.stringify({
        jsonrpc: '2.0',
        result: { tools: discoveryTools },
        id: 93,
      }), { 'Content-Type': 'application/json' });

    const response = await sendToolsList();

    expect(response.result.tools).toEqual(discoveryTools);
    expect(response.result.tools.map(tool => tool.name)).toEqual(tools.map(tool => tool.name));
    expectNoIntegerIdentity(response.result.tools);
  });

  test.each(tools)('$name forwards GUID arguments verbatim', async ({ name, args }) => {
    const captured = await captureCall(name, args);

    expect(captured.params).toEqual({ name, arguments: args });
    expect(captured.params.arguments.handoverGuid).toBe(HANDOVER_GUID);
    expectNoIntegerIdentity(captured.params.arguments);
  });

  test('create and delete calls preserve linked record data and opaque tokens', async () => {
    for (const { name, args } of tools.filter(tool => /Create|Delete/.test(tool.name))) {
      const captured = await captureCall(name, args);
      const token = captured.params.arguments.model?.concurrencyToken ??
        captured.params.arguments.concurrencyToken;

      expect(token).toBe(TOKEN);
      if (captured.params.arguments.model) {
        expect(captured.params.arguments.model.linkedEntityGuid).toBe(PROJECT_GUID);
        expect(captured.params.arguments.model.linkedEntityType).toBe('project');
      }
    }
  });

  test.each([
    'UteamupShiftHandoverGetSectionLinks',
    'UteamupShiftHandoverGetCarryOverLinks',
  ])('%s preserves a linked-record collection', async name => {
    const args = tools.find(tool => tool.name === name).args;
    const response = await call(name, args, successReply([linkedRecord]));
    const records = JSON.parse(response.body.result.content[0].text);

    expect(records).toHaveLength(1);
    expect(records[0].guid).toBe(LINK_GUID);
    expect(records[0].linkedEntityGuid).toBe(PROJECT_GUID);
    expectNoIntegerIdentity(records);
  });

  test.each([
    'UteamupShiftHandoverGetSectionLinks',
    'UteamupShiftHandoverGetCarryOverLinks',
  ])('%s preserves an empty collection', async name => {
    const args = tools.find(tool => tool.name === name).args;
    const response = await call(name, args, successReply([]));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('create returns the new link and refreshed handover token', async () => {
    const response = await call(
      'UteamupShiftHandoverCreateSectionLink',
      tools[1].args,
      successReply(linkedRecord),
    );
    const result = JSON.parse(response.body.result.content[0].text);

    expect(result.guid).toBe(LINK_GUID);
    expect(result.handoverConcurrencyToken).toBe(NEXT_TOKEN);
    expectNoIntegerIdentity(result);
  });

  test('delete returns the deleted link GUID and refreshed handover token', async () => {
    const deleted = { linkGuid: LINK_GUID, handoverConcurrencyToken: NEXT_TOKEN };
    const response = await call(
      'UteamupShiftHandoverDeleteCarryOverLink',
      tools[5].args,
      successReply(deleted),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(deleted);
    expectNoIntegerIdentity(deleted);
  });

  test.each(tools)('$name preserves backend JSON-RPC errors', async ({ name, args }) => {
    const response = await call(
      name,
      args,
      errorReply(-32009, 'The shift handover changed. Refresh and retry.'),
    );

    expect(response.body.error).toEqual({
      code: -32009,
      message: 'The shift handover changed. Refresh and retry.',
    });
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
