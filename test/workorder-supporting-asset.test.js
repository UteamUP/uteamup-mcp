'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('workorder supporting-asset MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_supporting_asset';
  const workorderGuid = '11111111-1111-4111-8111-111111111111';
  const requirementGuid = '22222222-2222-4222-8222-222222222222';
  const assetTypeGuid = '33333333-3333-4333-8333-333333333333';
  const model = {
    name: 'Workshop bay',
    exactAssetGuid: null,
    assetTypeGuid,
    quantity: 1,
    isMandatory: true,
    isActive: true,
    availabilityValidatedAtUtc: '2026-07-19T12:00:00Z',
    maxEvidenceAgeHours: 24,
  };
  const responseModel = {
    requirementGuid,
    workorderGuid,
    ...model,
    exactAssetName: null,
    assetTypeName: 'Workshop bay',
    isEvidenceFresh: true,
    readiness: 'Ready',
  };

  const tools = [
    {
      name: 'UteamupWorkorderSupportingAssetRequirementList',
      args: { workorderGuid },
    },
    {
      name: 'UteamupWorkorderSupportingAssetRequirementCreate',
      args: { workorderGuid, model },
    },
    {
      name: 'UteamupWorkorderSupportingAssetRequirementUpdate',
      args: { workorderGuid, requirementGuid, model },
    },
    {
      name: 'UteamupWorkorderSupportingAssetRequirementDelete',
      args: { workorderGuid, requirementGuid },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );

    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it('returns bounded readiness evidence', async () => {
    const result = await call(
      tools[0].name,
      tools[0].args,
      [responseModel],
    );

    expect(result).toEqual([responseModel]);
  });

  it('preserves an empty list', async () => {
    const result = await call(tools[0].name, tools[0].args, []);

    expect(result).toEqual([]);
  });

  it.each([
    [tools[1], responseModel],
    [tools[2], responseModel],
    [tools[3], true],
  ])('$name forwards GUID-only mutation arguments', async (tool, data) => {
    const result = await call(tool.name, tool.args, data);

    expect(result).toEqual(data);
    expect(JSON.stringify(tool.args)).not.toMatch(
      /"(?:tenantId|tenantGuid|userId|workorderId|requirementId)"/,
    );
  });

  it('round-trips backend validation errors', async () => {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      tools[1].name,
      tools[1].args,
      errorReply(-32602, 'Select either one exact asset or one asset type.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toContain('exact asset');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
