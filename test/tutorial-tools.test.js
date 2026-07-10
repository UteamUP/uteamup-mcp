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

describe('UPMate tutorial MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_tutorials';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const tutorial = {
    schemaVersion: '1.0',
    id: 'stock.orientation',
    version: 1,
    module: 'stock',
    published: true,
    supportedPlatforms: ['web', 'mobile'],
    requiredPermissions: ['Stock.View'],
    requiredFeatures: ['Stock'],
    prerequisites: [],
    localizations: {
      en: { title: 'Stock orientation', summary: 'Learn the Stock workspace.' },
    },
    variants: {
      web: { route: '/stock', steps: [] },
      mobile: { route: '/stock', steps: [] },
    },
  };

  test('lists published tutorials for a platform', async () => {
    const response = await call(
      'UteamupTutorialList',
      { module: 'stock', platform: 'mobile' },
      successReply([tutorial]),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('stock.orientation');
    expect(data[0].supportedPlatforms).toContain('mobile');
  });

  test('returns an empty list when no tutorial matches', async () => {
    const response = await call(
      'UteamupTutorialList',
      { module: 'unknown', platform: 'web' },
      successReply([]),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual([]);
  });

  test('gets a tutorial by semantic ID without integer identity', async () => {
    const response = await call(
      'UteamupTutorialGet',
      { tutorialId: 'stock.orientation', platform: 'web' },
      successReply(tutorial),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.id).toBe('stock.orientation');
    expect(data).not.toHaveProperty('idNumber');
    expect(data).not.toHaveProperty('tenantId');
    expect(data).not.toHaveProperty('userId');
  });

  test('preserves backend JSON-RPC errors', async () => {
    const response = await call(
      'UteamupTutorialGet',
      { tutorialId: 'stock.missing', platform: 'web' },
      errorReply(-32602, 'Tutorial not found'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('not found');
  });

  const tools = [
    { name: 'UteamupTutorialList', args: { module: 'stock', platform: 'web' } },
    { name: 'UteamupTutorialGet', args: { tutorialId: 'stock.orientation', platform: 'web' } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
