'use strict';

const {
  MAX_HEADER_VALUE_LENGTH,
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

  test('rejects header values containing ASCII control characters', () => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'tools/call\r\nX-Injected: evil',
      params: {
        name: 'UteamupAssetGet\r\nX-Other: 1',
        _meta: { [PROTOCOL_VERSION_META_KEY]: '2026-07-28\nX-Bad: 1' }
      },
      id: 3
    })).toEqual({});

    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'UteamupAssetGet\x00hidden',
        _meta: { [PROTOCOL_VERSION_META_KEY]: '2026-07-28\x7f' }
      },
      id: 4
    })).toEqual({
      'Mcp-Method': 'tools/call'
    });
  });

  test.each([
    ['uteamup://wiki/intro?token=secret123&mode=full', 'uteamup://wiki/intro'],
    ['uteamup://wiki/intro#private-anchor', 'uteamup://wiki/intro'],
    ['uteamup://wiki/intro?token=secret123#section', 'uteamup://wiki/intro'],
    ['uteamup://wiki/intro#section?token=secret123', 'uteamup://wiki/intro']
  ])('strips query and fragment from resources/read URI %s', (uri, expectedName) => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: { uri },
      id: 5
    })).toEqual({
      'Mcp-Method': 'resources/read',
      'Mcp-Name': expectedName
    });
  });

  test('omits Mcp-Name when resources/read URI only contains query or fragment', () => {
    expect(buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: { uri: '?token=secret123' },
      id: 6
    })).toEqual({
      'Mcp-Method': 'resources/read'
    });
  });

  test('caps forwarded header values at 256 characters', () => {
    const longMethod = 'm'.repeat(300);
    const longVersion = 'v'.repeat(300);
    const longName = 'n'.repeat(300);
    const longResourceUri = `uteamup://wiki/${'a'.repeat(300)}?secret=do-not-leak#frag`;

    const methodAndVersionHeaders = buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: longMethod,
      params: {
        _meta: { [PROTOCOL_VERSION_META_KEY]: longVersion }
      },
      id: 7
    });

    expect(methodAndVersionHeaders['Mcp-Method']).toHaveLength(MAX_HEADER_VALUE_LENGTH);
    expect(methodAndVersionHeaders['MCP-Protocol-Version']).toHaveLength(MAX_HEADER_VALUE_LENGTH);

    const toolHeaders = buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: longName },
      id: 8
    });
    expect(toolHeaders['Mcp-Name']).toHaveLength(MAX_HEADER_VALUE_LENGTH);

    const resourceHeaders = buildMcpForwardHeaders({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: { uri: longResourceUri },
      id: 9
    });
    expect(resourceHeaders['Mcp-Name']).toHaveLength(MAX_HEADER_VALUE_LENGTH);
    expect(resourceHeaders['Mcp-Name']).not.toContain('secret');
    expect(resourceHeaders['Mcp-Name']).not.toContain('?');
    expect(resourceHeaders['Mcp-Name']).not.toContain('#');
  });
});
