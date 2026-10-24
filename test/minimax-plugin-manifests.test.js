/**
 * MiniMax Code local plugin package validation tests
 *
 * MiniMax Code discovers local plugins by folder (it has no plugin marketplace),
 * so this package ships under plugins/minimax and is copied into
 * ~/.minimax/plugins/uteamup by the user.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLUGIN_ROOT = path.join(ROOT, 'plugins/minimax');
const MANIFEST_PATH = path.join(PLUGIN_ROOT, '.minimax-plugin/plugin.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

describe('MiniMax Code local plugin package', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  const manifest = readJson(MANIFEST_PATH);
  const servers = readJson(path.join(PLUGIN_ROOT, 'servers.mcp.json'));

  test('declares the MiniMax Plugin V1 manifest with the release version and publisher identity', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.name).toBe('uteamup');
    expect(manifest.name).toMatch(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.description).toBeTruthy();
    expect(manifest.author).toBe('UteamUP <gisli@uteamup.com>');
    expect(manifest.category).toBe('Business');
    expect(manifest.apps).toEqual([]);
    expect(manifest.exampleQueries.length).toBeGreaterThan(0);
    for (const query of manifest.exampleQueries)
      expect(query.trim().length).toBeGreaterThan(0);

    const trackedFiles = readJson(path.join(ROOT, 'release-please-config.json'))
      .packages['.']['extra-files'];
    expect(trackedFiles).toContainEqual({
      type: 'json',
      path: 'plugins/minimax/.minimax-plugin/plugin.json',
      jsonpath: '$.version',
    });
  });

  test('connects only to the production read-only resource over streamable-http', () => {
    expect(servers.schemaVersion).toBe(1);
    expect(Object.keys(servers.mcpServers)).toEqual(['uteamup']);

    const server = servers.mcpServers.uteamup;
    // MiniMax rejects the "http" alias and accepts no embedded auth configuration.
    expect(server.type).toBe('streamable-http');
    expect(server.type).not.toBe('http');
    expect(server.url).toBe('https://api.uteamup.com/mcp/read-only');
    expect(server).not.toHaveProperty('command');
    expect(server).not.toHaveProperty('headers');
    expect(server).not.toHaveProperty('env');
    for (const field of ['auth', 'oauth', 'oauth_resource', 'refresh']) {
      expect(server).not.toHaveProperty(field);
    }
    expect(Number.isInteger(server.timeout)).toBe(true);
    expect(server.timeout).toBeGreaterThan(0);

    expect(manifest.mcpServers).toEqual(['servers.mcp.json']);
  });

  test('bundles the UteamUP logo as the plugin icon', () => {
    expect(manifest.icon).toBe('icon.png');
    expect(fs.existsSync(path.join(PLUGIN_ROOT, 'icon.png'))).toBe(true);
    expect(fs.readFileSync(path.join(PLUGIN_ROOT, 'icon.png'))).toEqual(
      fs.readFileSync(path.join(ROOT, 'assets/logo.png')),
    );
    const header = fs
      .readFileSync(path.join(PLUGIN_ROOT, 'icon.png'))
      .subarray(0, 8);
    expect(header).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test('ships one cmms skill whose frontmatter matches its directory', () => {
    expect(manifest.skills).toEqual(['skills/cmms/SKILL.md']);

    const skill = fs.readFileSync(
      path.join(PLUGIN_ROOT, 'skills/cmms/SKILL.md'),
      'utf8',
    );
    expect(skill.startsWith('---\n')).toBe(true);
    const frontmatter = skill.slice(3, skill.indexOf('\n---', 3));
    expect(frontmatter.match(/^name:\s*(.+)$/m)[1].trim()).toBe('cmms');
    expect(
      frontmatter
        .match(/^description:\s*([\s\S]+?)(?=\n[a-zA-Z_-]+:|$)/m)[1]
        .trim().length,
    ).toBeGreaterThan(0);
  });

  test('keeps the package free of symlinks and of paths MiniMax rejects', () => {
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        expect(entry.isSymbolicLink()).toBe(false);
        expect(entry.name).toMatch(/^[A-Za-z0-9._-]+$/);
        expect(entry.name.endsWith('.')).toBe(false);
        return entry.isDirectory() ? walk(full) : [full];
      });

    const files = walk(PLUGIN_ROOT);
    expect(files.length).toBeGreaterThan(0);
    expect(files.length).toBeLessThanOrEqual(1024);
    for (const file of files) {
      expect(fs.statSync(file).size).toBeLessThanOrEqual(16 * 1024 * 1024);
    }
  });

  test('documents the MiniMax Code install path in the plugin README', () => {
    const readme = fs.readFileSync(
      path.join(PLUGIN_ROOT, 'README.txt'),
      'utf8',
    );
    expect(readme).toContain('~/.minimax/plugins/uteamup');
    expect(readme).toContain('https://api.uteamup.com/mcp/read-only');
    expect(readme).toContain('mcp:read');
    expect(readme).not.toMatch(/UTEAMUP_API_KEY\s*=\s*[A-Za-z0-9]/);
    expect(readme).not.toMatch(/UTEAMUP_SECRET\s*=\s*[A-Za-z0-9]/);
  });
});
