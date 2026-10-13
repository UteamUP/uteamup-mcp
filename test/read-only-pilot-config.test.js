'use strict';

const { loadConfig } = require('../lib/config');

describe('private read-only MCP transport', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.UTEAMUP_API_KEY = 'a'.repeat(32);
    process.env.UTEAMUP_SECRET = 'b'.repeat(64);
    delete process.env.UTEAMUP_MCP_PATH;
  });
  afterEach(() => { process.env = { ...original }; });

  test('preserves the standard transport by default', () => {
    expect(loadConfig().mcpPath).toBe('/mcp');
  });

  test('supports the same private read-only endpoint used by hosted assistants', () => {
    process.env.UTEAMUP_MCP_PATH = '/mcp/read-only';
    expect(loadConfig().mcpPath).toBe('/mcp/read-only');
  });

  test.each(['https://attacker.example/mcp', '//attacker.example/mcp', '/mcp/../api/workorder'])(
    'rejects arbitrary transport routing: %s', path => {
      process.env.UTEAMUP_MCP_PATH = path;
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    },
  );
});
