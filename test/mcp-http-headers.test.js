'use strict';

const {
  PROTOCOL_VERSION_META_KEY,
  buildMcpForwardHeaders
} = require('../lib/mcp-http-headers');

describe('buildMcpForwardHeaders', () => {
  test('mirrors Mcp-Method for every JSON-RPC method', () => {
    expect(buildMcpForwardHeaders({ jsonrpc: '2.0', method: 'tools/list', id: 1 }))
      .toEqual({ 'Mcp-Method': 'tools/list' });
  });

  test('omits MCP-Protocol-Version when the body does not declare one', () => {
    const headers = buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'UteamupWorkorderList', arguments: {} },
      id: 1
    });

    expect(headers['MCP-Protocol-Version']).toBeUndefined();
    expect(headers).toEqual({
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'UteamupWorkorderList'
    });
  });

  test('copies initialize params.protocolVersion onto MCP-Protocol-Version', () => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'initialize',
      params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
      id: 0
    })).toEqual({
      'Mcp-Method': 'initialize',
      'MCP-Protocol-Version': '2025-11-25'
    });
  });

  test('copies 2026-07-28 _meta protocolVersion onto MCP-Protocol-Version', () => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'server/discover',
      params: {
        _meta: { [PROTOCOL_VERSION_META_KEY]: '2026-07-28' }
      },
      id: 1
    })).toEqual({
      'Mcp-Method': 'server/discover',
      'MCP-Protocol-Version': '2026-07-28'
    });
  });

  test('prefers _meta protocolVersion over initialize params.protocolVersion', () => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        _meta: { [PROTOCOL_VERSION_META_KEY]: '2026-07-28' }
      },
      id: 0
    })['MCP-Protocol-Version']).toBe('2026-07-28');
  });

  test.each([
    ['tools/call', { name: 'UteamupAssetGet' }, 'UteamupAssetGet'],
    ['prompts/get', { name: 'summarize' }, 'summarize'],
    ['resources/read', { uri: 'uteamup://wiki/intro' }, 'uteamup://wiki/intro']
  ])('sets Mcp-Name for %s from the routing field', (method, params, expectedName) => {
    expect(buildMcpForwardHeaders({ jsonrpc: '2.0', method, params, id: 2 })['Mcp-Name'])
      .toBe(expectedName);
  });

  test('returns an empty object for a malformed request', () => {
    expect(buildMcpForwardHeaders(null)).toEqual({});
    expect(buildMcpForwardHeaders({ jsonrpc: '2.0', method: '', id: 1 })).toEqual({});
  });
});
