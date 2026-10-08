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
  const toolGuid = '77777777-7777-4777-8777-777777777777';
  const availabilityArgs = {
    fromUtc: '2026-10-09T08:00:00Z',
    toUtc: '2026-10-09T12:00:00Z',
    types: ['technician', 'tool', 'equipment', 'facility'],
    search: 'drill',
    availableOnly: true,
    includeNotRostered: false,
    pageSizePerType: 10,
    cursor: 'eyJ0eXBlIjoidG9vbCIsIm9mZnNldCI6MTB9',
  };
  const availability = {
    fromUtc: availabilityArgs.fromUtc,
    toUtc: availabilityArgs.toUtc,
    groups: [
      {
        resourceType: 'tool',
        items: [{
          sourceGuid: toolGuid,
          resourceGuid,
          name: 'Hammer drill',
          detail: 'Workshop A',
          resourceType: 'tool',
          status: 'available',
          reasons: [],
        }, {
          sourceGuid,
          resourceGuid: null,
          name: 'Angle grinder',
          detail: 'Workshop B',
          resourceType: 'tool',
          status: 'notRostered',
          reasons: ['Not registered as a bookable resource'],
        }],
        nextCursor: 'eyJ0eXBlIjoidG9vbCIsIm9mZnNldCI6MjB9',
        scanCapped: false,
      },
      {
        resourceType: 'technician',
        items: [{
          sourceGuid: territoryGuid,
          resourceGuid: requirementGuid,
          name: 'Anna Technician',
          detail: 'Electrician',
          resourceType: 'technician',
          status: 'busy',
          reasons: ['Booked 09:00-11:00'],
        }],
        nextCursor: null,
        scanCapped: true,
      },
    ],
  };

  const tools = [
    {
      name: 'UteamupCustomerBookingServiceTypeList',
      args: { search: 'Repair & service', serviceTypeGuid: sourceGuid, page: 2, pageSize: 25 },
      response: { items: [{ guid: sourceGuid, name: 'Repair & service' }], page: 2, pageSize: 25, totalCount: 26 },
    },
    {
      name: 'UteamupBookableResourceSourceList',
      args: { resourceType: 4, search: 'North', sourceGuid, page: 1, pageSize: 25 },
      response: { items: [{ guid: sourceGuid, name: 'Service van', detail: 'North', capacity: null, isActive: false }],
        page: 1, pageSize: 25, totalCount: 1 },
    },
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
      args: { model: resourceModel, idempotencyKey: '66666666-6666-4666-8666-666666666666' },
      response: resource,
    },
    {
      name: 'UteamupBookableResourceUpdate',
      args: { resourceGuid, expectedUpdatedAt, model: resourceModel, idempotencyKey: '66666666-6666-4666-8666-666666666666' },
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
    {
      name: 'UteamupBookableResourceAvailabilitySearch',
      args: availabilityArgs,
      response: availability,
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

  it('finds an existing resource by source GUID across all statuses', async () => {
    const expected = { items: [{ ...resource, isActive: false }], page: 1, pageSize: 1, totalCount: 1 };
    const response = await call('UteamupBookableResourceList',
      { assetGuid: sourceGuid, isActive: null, page: 1, pageSize: 1 }, successReply(expected));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it.each(['UteamupBookableResourceCreate', 'UteamupBookableResourceUpdate'])(
    '%s sends a complete pool definition in one request', async (name) => {
      const poolMembers = [{
        memberResourceGuid: sourceGuid, priority: 35, capacityContribution: 0.5,
        effectiveFromUtc: '2026-09-06T10:00:00Z', effectiveToUtc: '2026-09-13T10:00:00Z', isActive: false,
      }];
      const model = { ...resourceModel, name: 'Response pool', resourceType: 6, assetGuid: null, poolMembers };
      const args = name === 'UteamupBookableResourceCreate'
        ? { model, idempotencyKey: '66666666-6666-4666-8666-666666666666' }
        : { resourceGuid, expectedUpdatedAt, model, idempotencyKey: '66666666-6666-4666-8666-666666666666' };
      const expected = { ...resource, ...model, poolMembers: [{
        ...poolMembers[0], membershipGuid: requirementGuid, memberResourceName: 'Vehicle', memberResourceType: 4,
      }] };

      const response = await call(name, args, successReply(expected));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    },
  );

  it.each([
    ['UteamupBookableResourceList', { items: [], page: 1, pageSize: 25, totalCount: 0 }],
    ['UteamupBookableResourceSourceList', { items: [], page: 1, pageSize: 25, totalCount: 0 }],
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

  it('filters the resource list by tool GUID and the tool resource type', async () => {
    const args = { toolGuid, resourceType: 'tool', isActive: null, page: 1, pageSize: 1 };
    const expected = {
      items: [{ ...resource, name: 'Hammer drill', resourceType: 'tool', toolGuid, assetGuid: null }],
      page: 1,
      pageSize: 1,
      totalCount: 1,
    };

    const response = await call('UteamupBookableResourceList', args, successReply(expected));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  describe('UteamupBookableResourceAvailabilitySearch', () => {
    const name = 'UteamupBookableResourceAvailabilitySearch';

    it('returns grouped availability with statuses, reasons and per-type cursors', async () => {
      const response = await call(name, availabilityArgs, successReply(availability));
      const result = JSON.parse(response.body.result.content[0].text);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(result).toEqual(availability);
      expect(result.groups[0].items[1].resourceGuid).toBeNull();
      expect(result.groups[1].nextCursor).toBeNull();
      expect(result.groups[1].scanCapped).toBe(true);
    });

    it('preserves empty groups for a window with no matching resources', async () => {
      const args = { fromUtc: availabilityArgs.fromUtc, toUtc: availabilityArgs.toUtc };
      const expected = { fromUtc: args.fromUtc, toUtc: args.toUtc, groups: [] };

      const response = await call(name, args, successReply(expected));

      expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    });

    it('forwards the types array, flags and cursor verbatim', async () => {
      const args = {
        ...availabilityArgs,
        types: ['tool', 'facility'],
        availableOnly: false,
        includeNotRostered: true,
        pageSizePerType: 25,
        cursor: 'opaque-cursor/+=',
      };
      const expected = { fromUtc: args.fromUtc, toUtc: args.toUtc, groups: [] };

      // callMcpTool only matches the nock interceptor when the forwarded
      // arguments deep-equal `args`, so a dropped or rewritten field fails here.
      const response = await call(name, args, successReply(expected));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    });

    it('round-trips a validation error for an inverted window', async () => {
      const response = await call(
        name,
        { fromUtc: availabilityArgs.toUtc, toUtc: availabilityArgs.fromUtc },
        errorReply(-32602, 'toUtc must be after fromUtc'),
      );

      expect(response.body.error).toEqual({ code: -32602, message: 'toUtc must be after fromUtc' });
      expect(response.body.result).toBeUndefined();
    });
  });

  const errorTools = tools.map(({ name, args }) => ({ name, args }));
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
