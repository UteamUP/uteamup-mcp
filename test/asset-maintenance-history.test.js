'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Asset maintenance history MCP contract', () => {
  const BASE_URL = 'https://api.test.com';
  const TOOL = 'uteamup_asset_maintenance_history';
  const ASSET = '82000000-0000-4000-8000-000000000001';
  const FIRST = '83000000-0000-4000-8000-000000000001';
  const SECOND = '83000000-0000-4000-8000-000000000002';
  const TOKEN = 'fixture-access-token';
  const args = { assetGuid: ASSET, page: 1, pageSize: 10 };
  const call = (name, toolArgs, reply) => callMcpTool(BASE_URL, TOKEN, name, toolArgs, reply);
  const page = {
    items: [
      { guid: FIRST, name: 'Completed inspection', status: 4, statusName: 'Completed', completedAt: '2026-11-03T09:42:53Z' },
      { guid: SECOND, name: 'Completed repair', status: 4, statusName: 'Completed', completedAt: '2026-10-27T14:22:21Z' }
    ],
    currentPage: 1, pageSize: 10, totalItems: 2, totalPages: 1
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('preserves the completed GUID-only page and exact totals instead of an unconditional empty list', async () => {
    const response = await call(TOOL, args, successReply(page));
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual(page);
    expect(data.items.map(row => row.guid)).toEqual([FIRST, SECOND]);
    for (const row of data.items) {
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('assetId');
      expect(row).not.toHaveProperty('workorderId');
      expect(row).not.toHaveProperty('cost');
      expect(row).not.toHaveProperty('timeSpent');
    }
  });

  test('preserves an available assets genuinely empty paginated history', async () => {
    const empty = { items: [], currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 };
    const response = await call(TOOL, args, successReply(empty));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test('forwards the exact public asset GUID and nondefault page without identity selectors', async () => {
    const selected = { assetGuid: ASSET, page: 2, pageSize: 1 };
    const secondPage = { ...page, items: [page.items[1]], currentPage: 2, pageSize: 1, totalPages: 2 };
    const response = await callMcpTool(BASE_URL, TOKEN, TOOL, selected, successReply(secondPage), selected);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(secondPage);
    expect(nock.isDone()).toBe(true);
  });

  test.each([
    [-32003, 'Permission denied: WorkOrder.View or WorkOrder.View.Own required'],
    [-32004, 'Asset not available in the selected company.']
  ])('keeps backend refusal %s as an error rather than successful empty history', async (code, message) => {
    const response = await call(TOOL, args, errorReply(code, message));
    expect(response.body.error).toMatchObject({ code, message });
    expect(response.body.result).toBeUndefined();
  });

  const tools = [{ name: TOOL, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
