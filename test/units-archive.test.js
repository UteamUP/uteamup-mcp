/**
 * Archive and restore MCP tool tests for customers, vendors, teams and locations.
 *
 * Backend tools: UteamupCustomerArchive / UteamupCustomerRestore, UteamupVendorArchive / UteamupVendorRestore,
 * UteamupTeamArchive / UteamupTeamRestore, UteamupLocationArchive / UteamupLocationRestore, with
 * {Customer,Vendor,Team,Location}ArchiveCommandHandler. A record with history is archived instead of deleted:
 * it leaves lists, searches and pickers and stays in every row that names it. A vendor's archive state is
 * "inactive". Each needs that type's delete permission (Customer.Delete, Vendor.Delete, Team.Delete,
 * Location.Delete).
 *
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Units archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_units_archive';

  const GUID = 'cccccccc-0000-4000-8000-000000000001';

  const units = [
    { type: 'customer', prefix: 'UteamupCustomer', arg: 'customerGuid', permission: 'Customer.Delete' },
    { type: 'vendor', prefix: 'UteamupVendor', arg: 'vendorGuid', permission: 'Vendor.Delete' },
    { type: 'team', prefix: 'UteamupTeam', arg: 'teamGuid', permission: 'Team.Delete' },
    { type: 'location', prefix: 'UteamupLocation', arg: 'locationGuid', permission: 'Location.Delete' },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  describe.each(units)('$type', ({ type, prefix, arg, permission }) => {
    it('archives and returns the archived state', async () => {
      const response = await call(
        `${prefix}Archive`,
        { [arg]: GUID },
        successReply({ type, guid: GUID, archived: true }),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.type).toBe(type);
      expect(data.guid).toBe(GUID);
      expect(data.archived).toBe(true);
    });

    it('restores and returns the active state', async () => {
      const response = await call(
        `${prefix}Restore`,
        { [arg]: GUID },
        successReply({ type, guid: GUID, archived: false }),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.archived).toBe(false);
    });

    it('surfaces a missing delete right as a JSON-RPC error', async () => {
      const response = await call(
        `${prefix}Archive`,
        { [arg]: GUID },
        errorReply(-32000, `Permission denied: ${permission} required`),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain(permission);
    });

    it('surfaces a record outside the tenant as not_found', async () => {
      const response = await call(
        `${prefix}Restore`,
        { [arg]: GUID },
        errorReply(-32000, 'not_found: unavailable.'),
      );

      expect(response.body.error.message).toMatch(/not_found/);
    });
  });

  it('surfaces a location with active stock as location_stocked', async () => {
    const response = await call(
      'UteamupLocationArchive',
      { locationGuid: GUID },
      errorReply(-32000, 'location_stocked: Cannot retire location: it hosts active stock location(s). Archive them first.'),
    );

    expect(response.body.error.message).toMatch(/location_stocked/);
  });

  it('surfaces an empty GUID as invalid_request', async () => {
    const response = await call(
      'UteamupTeamArchive',
      { teamGuid: '00000000-0000-0000-0000-000000000000' },
      errorReply(-32000, 'invalid_request: teamGuid must be a non-empty GUID.'),
    );

    expect(response.body.error.message).toMatch(/invalid_request/);
  });

  const errorTools = units.flatMap(({ prefix, arg }) => [
    { name: `${prefix}Archive`, args: { [arg]: GUID } },
    { name: `${prefix}Restore`, args: { [arg]: GUID } },
  ]);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
