'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Asset and short stock search contracts', () => {
  const baseUrl = 'https://api.uteamup.com';
  const token = 'synthetic-search-token';
  const examples = [
    { name: 'UteamupAssetSearch', args: { searchFilter: 'WiZ' } },
    { name: 'UteamupStockSearchItems', args: { q: 'AA' } },
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const call = (name, args, reply) => callMcpTool(baseUrl, token, name, args, reply, args);

  it('preserves part GUIDs in an asset search result', async () => {
    const partGuid = '6a6248fd-a90e-4505-b074-307e410737bc';
    const response = await call(examples[0].name, examples[0].args, successReply([{ name: 'WiZ light', partGuids: [partGuid] }]));
    expect(JSON.parse(response.body.result.content[0].text)[0].partGuids).toEqual([partGuid]);
  });

  it('forwards a two-character stock query verbatim and preserves both battery matches', async () => {
    const items = [{ name: 'AA battery', sku: 'ELKO-BAT-AA' }, { name: 'AAA battery', sku: 'ELKO-BAT-AAA' }];
    const response = await call(examples[1].name, examples[1].args, successReply({ items, totalItems: 2 }));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ items, totalItems: 2 });
  });

  it('preserves the actionable required-filter error', async () => {
    const response = await call(examples[0].name, { searchFilter: '' }, errorReply(-32602, 'invalid_search_filter: Search query is required'));
    expect(response.body.error.message).toContain('invalid_search_filter');
  });

  describeJsonRpcCompliance((name, args, reply) => callMcpTool(baseUrl, token, name, args, reply), examples);
  describe401Unauthorized(baseUrl, examples);
  describe503ServiceUnavailable(baseUrl, examples);
});
