/**
 * Marketplace and registry manifest validation tests
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  expect(fs.existsSync(fullPath)).toBe(true);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('Marketplace & Registry Manifests', () => {
  const pkg = readJson('package.json');

  test('package.json declares mcpName and bundles server.json', () => {
    expect(pkg.mcpName).toBe('io.github.UteamUP/mcp-server');
    expect(pkg.files).toContain('server.json');
  });

  test('Official MCP Registry server.json is valid and synchronized with package.json', () => {
    const server = readJson('server.json');

    expect(server.$schema).toMatch(/^https:\/\/static\.modelcontextprotocol\.io\/schemas\//);
    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.repository?.url).toBe('https://github.com/UteamUP/uteamup-mcp');

    expect(Array.isArray(server.packages)).toBe(true);
    expect(server.packages).toHaveLength(1);
    const npmPkg = server.packages[0];
    expect(npmPkg.registryType).toBe('npm');
    expect(npmPkg.identifier).toBe(pkg.name);
    expect(npmPkg.version).toBe(pkg.version);
    expect(npmPkg.transport?.type).toBe('stdio');

    const envNames = npmPkg.environmentVariables.map(v => v.name);
    expect(envNames).toEqual(expect.arrayContaining(['UTEAMUP_API_KEY', 'UTEAMUP_SECRET']));
    for (const secretVar of ['UTEAMUP_API_KEY', 'UTEAMUP_SECRET']) {
      const entry = npmPkg.environmentVariables.find(v => v.name === secretVar);
      expect(entry.isRequired).toBe(true);
      expect(entry.isSecret).toBe(true);
    }

    expect(server.remotes).toEqual([
      { type: 'streamable-http', url: 'https://api.uteamup.com/mcp/read-only' },
      { type: 'streamable-http', url: 'https://api.uteamup.com/mcp' }
    ]);
  });

  test('Shared .mcp.json references @uteamup/mcp-server without hardcoded secrets', () => {
    const mcpConfig = readJson('.mcp.json');
    const entry = mcpConfig.mcpServers?.uteamup;

    expect(entry).toBeDefined();
    expect(entry.command).toBe('npx');
    expect(entry.args).toEqual(['-y', '@uteamup/mcp-server']);
    expect(entry.env).toEqual({
      UTEAMUP_API_KEY: '${UTEAMUP_API_KEY}',
      UTEAMUP_SECRET: '${UTEAMUP_SECRET}'
    });
  });

  test('Grok Build plugin and marketplace manifests match package version and .mcp.json', () => {
    const grokPlugin = readJson('.grok-plugin/plugin.json');
    const grokMarketplace = readJson('.grok-plugin/marketplace.json');

    expect(grokPlugin.name).toBe('uteamup');
    expect(grokPlugin.version).toBe(pkg.version);
    expect(grokPlugin.components?.mcp).toBe('.mcp.json');

    expect(grokMarketplace.plugins).toHaveLength(1);
    expect(grokMarketplace.plugins[0].name).toBe('uteamup');
    expect(grokMarketplace.plugins[0].version).toBe(pkg.version);
    expect(grokMarketplace.plugins[0].source?.repo).toBe('UteamUP/uteamup-mcp');
  });

  test('Claude Code plugin and marketplace manifests match package version and .mcp.json', () => {
    const claudePlugin = readJson('.claude-plugin/plugin.json');
    const claudeMarketplace = readJson('.claude-plugin/marketplace.json');

    expect(claudePlugin.name).toBe('uteamup');
    expect(claudePlugin.version).toBe(pkg.version);
    expect(claudePlugin.mcpServers).toBe('./.mcp.json');

    expect(claudeMarketplace.plugins).toHaveLength(1);
    expect(claudeMarketplace.plugins[0].name).toBe('uteamup');
    expect(claudeMarketplace.plugins[0].version).toBe(pkg.version);
    expect(claudeMarketplace.plugins[0].source?.repo).toBe('UteamUP/uteamup-mcp');
  });

  test('Gemini CLI extension manifest matches package version and marks credentials sensitive', () => {
    const geminiExt = readJson('gemini-extension.json');

    expect(geminiExt.name).toBe('uteamup');
    expect(geminiExt.version).toBe(pkg.version);
    expect(geminiExt.mcpServers?.uteamup?.command).toBe('node');
    expect(geminiExt.mcpServers?.uteamup?.args).toEqual(['${extensionPath}/index.js']);

    const settingsByEnv = Object.fromEntries((geminiExt.settings || []).map(s => [s.envVar, s]));
    expect(settingsByEnv.UTEAMUP_API_KEY?.sensitive).toBe(true);
    expect(settingsByEnv.UTEAMUP_SECRET?.sensitive).toBe(true);
  });

  test('Glama and Smithery manifests exist and declare stdio transport', () => {
    const glama = readJson('glama.json');
    expect(glama.$schema).toBe('https://glama.ai/mcp/schemas/server.json');
    expect(glama.name).toBe(pkg.name);
    expect(glama.transport).toEqual(expect.arrayContaining(['stdio', 'http', 'sse']));

    const smitheryPath = path.join(ROOT, 'smithery.yaml');
    expect(fs.existsSync(smitheryPath)).toBe(true);
    const smithery = fs.readFileSync(smitheryPath, 'utf8');
    expect(smithery).toContain('type: stdio');
    expect(smithery).toContain('UTEAMUP_API_KEY: config.uteamupApiKey');
    expect(smithery).toContain('UTEAMUP_SECRET: config.uteamupSecret');
  });

  test('OpenAPI 3.1.0 Action schema (openapi-actions.json) exposes the 5 read-only MCP tools with OAuth and Bearer auth', () => {
    const openapi = readJson('openapi-actions.json');

    expect(openapi.openapi).toBe('3.1.0');
    expect(openapi.info?.version).toBe(pkg.version);
    expect(openapi.servers?.[0]?.url).toBe('https://api.uteamup.com');

    const postOp = openapi.paths?.['/mcp/read-only']?.post;
    expect(postOp).toBeDefined();
    expect(postOp.operationId).toBe('callUteamupReadOnlyTool');
    expect(postOp['x-openai-isConsequential']).toBe(false);

    const toolEnum = openapi.components?.schemas?.ReadOnlyToolCallParams?.properties?.name?.enum;
    expect(toolEnum).toEqual([
      'uteamup_asset_list',
      'uteamup_asset_get_by_guid',
      'uteamup_asset_search',
      'uteamup_workorder_list',
      'uteamup_workorder_search'
    ]);

    expect(openapi.info?.['x-logo']?.url).toBe(
      'https://raw.githubusercontent.com/UteamUP/uteamup-mcp/main/assets/logo.png'
    );

    const oauthFlow = openapi.components?.securitySchemes?.UteamupOAuth?.flows?.authorizationCode;
    expect(oauthFlow?.authorizationUrl).toBe('https://api.uteamup.com/oauth/authorize');
    expect(oauthFlow?.tokenUrl).toBe('https://api.uteamup.com/oauth/token');
    expect(oauthFlow?.scopes).toHaveProperty('mcp:read');
  });

  test('UteamUP logo assets exist and are referenced across all marketplace manifests', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets/logo.svg'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'assets/logo.png'))).toBe(true);

    const server = readJson('server.json');
    expect(server.icons).toEqual([
      {
        src: 'https://raw.githubusercontent.com/UteamUP/uteamup-mcp/main/assets/logo.svg',
        mimeType: 'image/svg+xml',
        sizes: ['any']
      },
      {
        src: 'https://raw.githubusercontent.com/UteamUP/uteamup-mcp/main/assets/logo.png',
        mimeType: 'image/png',
        sizes: ['512x512']
      }
    ]);

    expect(readJson('.grok-plugin/plugin.json').logo).toBe('assets/logo.svg');
    expect(readJson('.grok-plugin/marketplace.json').plugins[0].logo).toBe('assets/logo.svg');
    expect(readJson('.claude-plugin/plugin.json').logo).toBe('assets/logo.svg');
    expect(readJson('.claude-plugin/marketplace.json').plugins[0].logo).toBe('assets/logo.svg');
    expect(readJson('gemini-extension.json').icon).toBe('assets/logo.png');
    expect(readJson('gemini-extension.json').logo).toBe('assets/logo.svg');
    expect(readJson('glama.json').icon).toBe(
      'https://raw.githubusercontent.com/UteamUP/uteamup-mcp/main/assets/logo.png'
    );
  });

  test('release-please-config.json tracks version fields across all JSON manifests', () => {
    const releasePlease = readJson('release-please-config.json');
    const extraFiles = releasePlease.packages?.['.']?.['extra-files'] || [];
    const trackedPaths = extraFiles.map(entry => `${entry.path}:${entry.jsonpath}`);

    expect(trackedPaths).toEqual(
      expect.arrayContaining([
        'server.json:$.version',
        'server.json:$.packages[0].version',
        'gemini-extension.json:$.version',
        '.claude-plugin/plugin.json:$.version',
        '.claude-plugin/marketplace.json:$.plugins[0].version',
        '.grok-plugin/plugin.json:$.version',
        '.grok-plugin/marketplace.json:$.plugins[0].version',
        'openapi-actions.json:$.info.version'
      ])
    );
  });
});
