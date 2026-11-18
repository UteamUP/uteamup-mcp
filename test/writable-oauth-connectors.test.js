/**
 * Writable (mcp:full) OAuth connector manifests — UTE-493.
 *
 * Pins the staged full-scope connector manifests for Claude and OpenAI to
 * https://api.uteamup.com/mcp with mcp:full, keeps them free of API-key
 * material, and guards that no marketplace/registry listing publishes them
 * before the activation checklist in docs/writable-connectors.md is complete.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

describe('Writable (mcp:full) OAuth connector manifests', () => {
  test('Claude writable connector targets the full /mcp endpoint over HTTP OAuth', () => {
    const mcp = readJson('plugins/claude-full/.mcp.json');
    expect(Object.keys(mcp.mcpServers)).toEqual(['uteamup']);
    const server = mcp.mcpServers.uteamup;
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://api.uteamup.com/mcp');
    expect(server).not.toHaveProperty('command');
    expect(server).not.toHaveProperty('headers');
    expect(server).not.toHaveProperty('env');
  });

  test('OpenAI writable connector mirrors the published package but requests mcp:full on /mcp', () => {
    const mcp = readJson('plugins/openai-full/.mcp.json');
    expect(Object.keys(mcp.mcpServers)).toEqual(['uteamup']);
    const server = mcp.mcpServers.uteamup;
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://api.uteamup.com/mcp');
    expect(server.oauth_resource).toBe(server.url);
    expect(server).not.toHaveProperty('command');
    expect(server).not.toHaveProperty('headers');
    const auth = server.extensions['com.openai'].auth;
    expect(auth.type).toBe('oauth');
    expect(auth.client).toEqual({ mode: 'dcr' });
    expect(auth.resource).toBe(server.url);
    expect(auth.baseScopes).toEqual(['mcp:full']);
    expect(auth.defaultScopes).toEqual(['mcp:full']);
    for (const field of ['authorizationUrl', 'tokenUrl', 'registrationUrl', 'resource']) {
      const url = new URL(auth[field]);
      expect(url.origin).toBe('https://api.uteamup.com');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(url.search).toBe('');
    }
  });

  test('writable manifests carry no API key or client secret material', () => {
    for (const dir of ['plugins/claude-full', 'plugins/openai-full']) {
      for (const name of fs.readdirSync(path.join(root, dir))) {
        const raw = fs.readFileSync(path.join(root, dir, name), 'utf8');
        expect(raw).not.toMatch(/UTEAMUP_API_KEY|UTEAMUP_SECRET|client_secret|api[_-]?key\s*[:=]/i);
      }
    }
  });

  test('published read-only OpenAI connector stays on /mcp/read-only with mcp:read', () => {
    const server = readJson('plugins/openai/.mcp.json').mcpServers.uteamup;
    expect(server.url).toBe('https://api.uteamup.com/mcp/read-only');
    expect(server.oauth_resource).toBe(server.url);
    const auth = server.extensions['com.openai'].auth;
    expect(auth.resource).toBe(server.url);
    expect(auth.baseScopes).toEqual(['mcp:read']);
    expect(auth.defaultScopes).toEqual(['mcp:read']);
  });

  test('no marketplace listing publishes the writable connectors before activation', () => {
    const claude = readJson('.claude-plugin/marketplace.json');
    expect(claude.plugins.map(p => p.name)).toEqual(['uteamup', 'uteamup-zcode']);
    expect(claude.plugins.map(p => p.source)).toEqual(['./plugins/claude', './plugins/uteamup-zcode']);
    const grok = readJson('.grok-plugin/marketplace.json');
    expect(grok.plugins.map(p => p.name)).toEqual(['uteamup']);
    const cursor = readJson('.cursor-plugin/marketplace.json');
    expect(cursor.plugins.map(p => p.name)).toEqual(['uteamup']);
  });

  test('activation checklist documentation exists for the writable connectors', () => {
    expect(fs.existsSync(path.join(root, 'docs/writable-connectors.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'plugins/claude-full/README.txt'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'plugins/openai-full/README.txt'))).toBe(true);
  });
});
