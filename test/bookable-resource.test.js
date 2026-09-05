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

describe('bookable resource MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_bookable_resources';
  const resourceGuid = '11111111-1111-4111-8111-111111111111';
  const territoryGuid = '22222222-2222-4222-8222-222222222222';
  const workorderGuid = '33333333-3333-4333-8333-333333333333';
  const requirementGuid = '44444444-4444-4444-8444-444444444444';
  const sourceGuid = '55555555-5555-4555-8555-555555555555';
  const expectedUpdatedAt = '2026-07-19T12:30:00Z';

  const resourceModel = {
    name: 'Service van',
    description: 'North response vehicle',
    resourceType: 4,
    capacity: 1,
    capacityUnit: 'vehicle',
    isActive: true,
    atomicPoolSelection: true,
    assetGuid: sourceGuid,
    territoryGuids: [territoryGuid],
  };
  const resource = {
    guid: resourceGuid,
    ...resourceModel,
    territories: [{
      guid: territoryGuid,
      name: 'North',
      isPrimary: true,
    }],
    poolMembers: [],
    createdAt: '2026-07-19T12:00:00Z',
    updatedAt: expectedUpdatedAt,
  };
  const territoryModel = {
    name: 'North',
    centerLatitude: 64.1,
    centerLongitude: -21.9,
    radiusKm: 80,
    timeZoneId: 'Atlantic/Reykjavik',
    isActive: true,
  };
  const territory = {
    guid: territoryGuid,
    ...territoryModel,
    isPrimary: true,
    updatedAt: expectedUpdatedAt,
  };
  const requirementModel = {
    roleName: 'Service vehicle',
    resourceType: 4,
    mode: 0,
    quantity: 1,
    capacityRequired: 1,
    serviceTerritoryGuid: territoryGuid,
    isActive: true,
  };
  const requirement = {
    guid: requirementGuid,
    workorderGuid,
    ...requirementModel,
    updatedAt: expectedUpdatedAt,
  };
  const routeModel = {
    fromLatitude: 64.1,
    fromLongitude: -21.9,
    toLatitude: 64.2,
    toLongitude: -21.8,
    departureTimeUtc: '2026-07-19T13:00:00Z',
  };
  const route = {
    durationMinutes: 18,
    distanceKm: 12,
    departureTimeUtc: routeModel.departureTimeUtc,
    calculatedAtUtc: '2026-07-19T12:59:00Z',
    freshUntilUtc: '2026-07-19T13:14:00Z',
    source: 'google-routes',
    isDegraded: false,
    isFromCache: true,
    explanation: 'Traffic-aware live road route.',
  };

  const tools = [
    {
      name: 'UteamupBookableResourceList',
      args: {
        search: 'van',
        resourceType: 6,
        poolMemberResourceType: 4,
        territoryGuid,
        isActive: true,
        page: 1,
        pageSize: 25,
      },
      response: {
        items: [resource],
        page: 1,
        pageSize: 25,
        totalCount: 1,
      },
    },
    {
      name: 'UteamupBookableResourceCrewList',
      args: { search: 'North', crewGuid: sourceGuid, page: 1, pageSize: 25 },
      response: {
        items: [{ guid: sourceGuid, name: 'Field crew', organizationName: 'North services', capacity: 4, isActive: false }],
        page: 1,
        pageSize: 25,
        totalCount: 1,
      },
    },
    {
      name: 'UteamupBookableResourceGet',
      args: { resourceGuid },
      response: resource,
    },
    {
      name: 'UteamupBookableResourceCreate',
      args: { model: resourceModel },
      response: resource,
    },
    {
      name: 'UteamupBookableResourceUpdate',
      args: { resourceGuid, expectedUpdatedAt, model: resourceModel },
      response: resource,
    },
    {
      name: 'UteamupBookableResourcePoolMembersSet',
      args: {
        poolGuid: resourceGuid,
        expectedUpdatedAt,
        model: {
          members: [{
            memberResourceGuid: sourceGuid,
            priority: 10,
            capacityContribution: 1,
            isActive: true,
          }],
        },
      },
      response: resource,
    },
    {
      name: 'UteamupServiceTerritoryList',
      args: {},
      response: [territory],
    },
    {
      name: 'UteamupServiceTerritoryCreate',
      args: { model: territoryModel },
      response: territory,
    },
    {
      name: 'UteamupServiceTerritoryUpdate',
      args: { territoryGuid, expectedUpdatedAt, model: territoryModel },
      response: territory,
    },
    {
      name: 'UteamupBookableResourceRequirementList',
      args: { workorderGuid },
      response: [requirement],
    },
    {
      name: 'UteamupBookableResourceRequirementCreate',
      args: { workorderGuid, model: requirementModel },
      response: requirement,
    },
    {
      name: 'UteamupBookableResourceRequirementUpdate',
      args: { requirementGuid, expectedUpdatedAt, model: requirementModel },
      response: requirement,
    },
    {
      name: 'UteamupBookableResourceRouteEstimate',
      args: { model: routeModel },
      response: route,
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, reply) {
    return callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      reply,
      args,
    );
  }

  it.each(tools)(
    '$name preserves the reviewed GUID-only contract',
    async ({ name, args, response: expected }) => {
      const response = await call(name, args, successReply(expected));
      const result = JSON.parse(response.body.result.content[0].text);

      expect(response.status).toBe(200);
      expect(result).toEqual(expected);
      expect(JSON.stringify(args)).not.toMatch(
        /"(?:resourceId|territoryId|workorderId|requirementId|tenantId)"/,
      );
    },
  );

  it.each([
    ['UteamupBookableResourceList', { items: [], page: 1, pageSize: 25, totalCount: 0 }],
    ['UteamupServiceTerritoryList', []],
    ['UteamupBookableResourceRequirementList', []],
  ])('%s preserves an empty result', async (name, expected) => {
    const args = tools.find((tool) => tool.name === name).args;
    const response = await call(name, args, successReply(expected));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it('round-trips a backend JSON-RPC error without inventing a result', async () => {
    const tool = tools.find(
      (candidate) => candidate.name === 'UteamupBookableResourceUpdate',
    );
    const response = await call(
      tool.name,
      tool.args,
      errorReply(-32009, 'ExpectedUpdatedAt is stale'),
    );

    expect(response.body.error).toEqual({
      code: -32009,
      message: 'ExpectedUpdatedAt is stale',
    });
    expect(response.body.result).toBeUndefined();
  });

  const errorTools = tools.map(({ name, args }) => ({ name, args }));
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
