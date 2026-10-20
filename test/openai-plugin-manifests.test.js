const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pluginRoot = path.join(root, 'plugins/openai');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const plugin = readJson(path.join(pluginRoot, '.codex-plugin/plugin.json'));
const mcp = readJson(path.join(pluginRoot, '.mcp.json'));
const openai = plugin.extensions['com.openai'];

describe('OpenAI public plugin package', () => {
  test('uses the release version and the approved UteamUP publisher identity', () => {
    const npmPackage = readJson(path.join(root, 'package.json'));
    expect(plugin.version).toBe(npmPackage.version);
    expect(npmPackage.author).toBe('UteamUP <gisli@uteamup.com>');
    expect(plugin.author).toEqual({
      name: 'UteamUP', email: 'gisli@uteamup.com', url: 'https://uteamup.com'
    });
    expect(plugin.interface.developerName).toBe('UteamUP');
    expect(plugin.mcpServers).toBe('./.mcp.json');
    const trackedFiles = readJson(path.join(root, 'release-please-config.json'))
      .packages['.']['extra-files'];
    expect(trackedFiles).toContainEqual({
      type: 'json', path: 'plugins/openai/.codex-plugin/plugin.json', jsonpath: '$.version'
    });
  });

  test('connects only to the production read-only resource using OAuth DCR', () => {
    expect(Object.keys(mcp.mcpServers)).toEqual(['uteamup']);
    const server = mcp.mcpServers.uteamup;
    expect(server.type).toBe('http');
    expect(server.url).toBe('https://api.uteamup.com/mcp/read-only');
    expect(server.oauth_resource).toBe(server.url);
    expect(server).not.toHaveProperty('command');
    expect(server).not.toHaveProperty('headers');
    const auth = server.extensions['com.openai'].auth;
    expect(auth.type).toBe('oauth');
    expect(auth.client).toEqual({ mode: 'dcr' });
    expect(auth.resource).toBe(server.url);
    expect(auth.baseScopes).toEqual(['mcp:read']);
    expect(auth.defaultScopes).toEqual(['mcp:read']);
    for (const field of ['authorizationUrl', 'tokenUrl', 'registrationUrl', 'resource']) {
      const url = new URL(auth[field]);
      expect(url.origin).toBe('https://api.uteamup.com');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(url.search).toBe('');
    }
  });

  test('includes all listing links, bounded text, and the original UteamUP logo', () => {
    const listing = plugin.interface;
    for (const field of ['displayName', 'shortDescription']) {
      expect(listing[field].length).toBeGreaterThan(0);
      expect(listing[field].length).toBeLessThanOrEqual(30);
    }
    expect(listing.longDescription.length).toBeLessThanOrEqual(4000);
    for (const field of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
      const url = new URL(listing[field]);
      expect(url.protocol).toBe('https:');
      expect(url.username).toBe('');
      expect(url.password).toBe('');
    }
    for (const field of ['logo', 'composerIcon']) {
      expect(listing[field]).toBe('./assets/logo.png');
      expect(fs.readFileSync(path.join(pluginRoot, listing[field]))).toEqual(
        fs.readFileSync(path.join(root, 'assets/logo.png'))
      );
    }
    expect(listing.defaultPrompt).toHaveLength(3);
    for (const prompt of listing.defaultPrompt) expect(prompt.length).toBeLessThanOrEqual(128);
  });

  test('provides the required review cases for the same five read-only Action tools', () => {
    const cases = openai.review.test_cases;
    expect(cases.positive).toHaveLength(5);
    expect(cases.negative).toHaveLength(3);
    const expectedTools = readJson(path.join(root, 'openapi-actions.json'))
      .components.schemas.ReadOnlyToolCallParams.properties.name.enum;
    const reviewedTools = new Set();
    for (const scenario of cases.positive) {
      expect(scenario.prompt).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(scenario.expected_behavior).toBeTruthy();
      for (const tool of scenario.tools_triggered.split(',').map(value => value.trim())) {
        expect(expectedTools).toContain(tool);
        reviewedTools.add(tool);
      }
    }
    expect([...reviewedTools].sort()).toEqual([...expectedTools].sort());
    expect(openai.review).not.toHaveProperty('test_credentials');
    expect(openai.review).not.toHaveProperty('reviewer_instructions');
  });
});
