/**
 * Saved filter (filter preset) MCP tool tests
 *
 * Tools under test:
 *   UteamupFilterPresetList(hubKey)
 *   UteamupFilterPresetCreate(hubKey, name, filter, isDefault?)
 *   UteamupFilterPresetUpdate(hubKey, presetGuid, name, filter, isDefault?)
 *   UteamupFilterPresetSetDefault(hubKey, presetGuid)
 *   UteamupFilterPresetRemove(hubKey, presetGuid)
 *
 * Saved filters are personal: every tool acts for the signed-in user (or the API
 * key's owner) in the current company and takes no userId / tenantId argument.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Saved filter MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_filter_presets';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  const presetGuid = '55555555-5555-4555-8555-555555555555';
  const filter = { sort: 'dueDate', status: 'active', showArchived: false, locationGuids: ['66666666-6666-4666-8666-666666666666'] };
  const preset = {
    guid: presetGuid,
    hubKey: 'workorders',
    name: 'Overdue on site',
    isDefault: true,
    filter,
    updatedAt: '2026-11-14T10:00:00Z'
  };

  describe('UteamupFilterPresetList tool', () => {
    test('returns my saved filters on the hub', async () => {
      const response = await call('UteamupFilterPresetList', { hubKey: 'workorders' }, successReply([preset]),
        { hubKey: 'workorders' });

      expect(response.status).toBe(200);
      const presets = parse(response);
      expect(presets).toHaveLength(1);
      expect(presets[0].guid).toBe(presetGuid);
      expect(presets[0].filter).toEqual(filter);
    });

    test('returns an empty list when nothing is saved', async () => {
      const response = await call('UteamupFilterPresetList', { hubKey: 'asset-types' }, successReply([]));

      expect(parse(response)).toEqual([]);
    });

    test('surfaces an invalid hubKey error', async () => {
      const response = await call('UteamupFilterPresetList', { hubKey: 'Work_Orders' },
        errorReply(-32602, 'hubKey must be lowercase letters, digits and single hyphens'));

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('hubKey');
    });
  });

  describe('UteamupFilterPresetCreate tool', () => {
    test('forwards the name, client-owned filter and default flag verbatim', async () => {
      const args = { hubKey: 'workorders', name: 'Overdue on site', filter, isDefault: true };
      const response = await call('UteamupFilterPresetCreate', args, successReply(preset), args);

      expect(parse(response).isDefault).toBe(true);
    });

    test('surfaces a duplicate name', async () => {
      const response = await call('UteamupFilterPresetCreate', { hubKey: 'workorders', name: 'Overdue on site', filter },
        errorReply(-32000, 'You already have a saved filter named "Overdue on site" on this hub.'));

      expect(response.body.error.message).toContain('already have a saved filter');
    });

    test('surfaces an oversized filter', async () => {
      const response = await call('UteamupFilterPresetCreate', { hubKey: 'workorders', name: 'Huge', filter: { note: 'x'.repeat(9000) } },
        errorReply(-32602, 'filter cannot exceed 8192 bytes.'));

      expect(response.body.error.message).toContain('8192');
    });
  });

  describe('UteamupFilterPresetUpdate tool', () => {
    test('renames and replaces the filter', async () => {
      const args = { hubKey: 'workorders', presetGuid, name: 'Renamed', filter: { sort: 'name' }, isDefault: false };
      const response = await call('UteamupFilterPresetUpdate', args,
        successReply({ ...preset, name: 'Renamed', isDefault: false, filter: { sort: 'name' } }), args);

      expect(parse(response).name).toBe('Renamed');
    });

    test('reports another user\'s filter as not_found', async () => {
      const response = await call('UteamupFilterPresetUpdate', { hubKey: 'workorders', presetGuid, name: 'x', filter },
        errorReply(-32000, 'not_found: You have no saved filter with that GUID on this hub.'));

      expect(response.body.error.message).toMatch(/^not_found/);
    });
  });

  describe('UteamupFilterPresetSetDefault tool', () => {
    test('returns the new default', async () => {
      const response = await call('UteamupFilterPresetSetDefault', { hubKey: 'workorders', presetGuid }, successReply(preset),
        { hubKey: 'workorders', presetGuid });

      expect(parse(response).isDefault).toBe(true);
    });
  });

  describe('UteamupFilterPresetRemove tool', () => {
    test('removes my filter', async () => {
      const response = await call('UteamupFilterPresetRemove', { hubKey: 'workorders', presetGuid }, successReply(true));

      expect(parse(response)).toBe(true);
    });

    test('reports an unknown filter as not_found', async () => {
      const response = await call('UteamupFilterPresetRemove', { hubKey: 'workorders', presetGuid },
        errorReply(-32000, 'not_found: You have no saved filter with that GUID on this hub.'));

      expect(response.body.error.message).toMatch(/^not_found/);
    });
  });

  const allTools = [
    { name: 'UteamupFilterPresetList', args: { hubKey: 'workorders' } },
    { name: 'UteamupFilterPresetCreate', args: { hubKey: 'workorders', name: 'Overdue on site', filter } },
    { name: 'UteamupFilterPresetUpdate', args: { hubKey: 'workorders', presetGuid, name: 'Renamed', filter } },
    { name: 'UteamupFilterPresetSetDefault', args: { hubKey: 'workorders', presetGuid } },
    { name: 'UteamupFilterPresetRemove', args: { hubKey: 'workorders', presetGuid } }
  ];

  describe('regression guards', () => {
    test.each(allTools)('$name takes no userId or tenantId', ({ args }) => {
      const keys = Object.keys(args).map(k => k.toLowerCase());
      expect(keys.some(k => k.includes('userid') || k.includes('userguid') || k.includes('tenant'))).toBe(false);
    });

    test('identifiers are GUIDs', () => {
      expect(presetGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('hub keys are lowercase', () => {
      allTools.forEach(t => expect(t.args.hubKey).toBe(t.args.hubKey.toLowerCase()));
    });
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
