'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const pinnedArg = file =>
  read(file).mcpServers.uteamup.args.find(arg => arg.startsWith('@uteamup/mcp-server@')).split('@').pop();

describe('Claude plugin launcher pins', () => {
  const lockedDependency = read('plugins/claude/package.json').dependencies['@uteamup/mcp-server'];

  test('the plugin launches the same server version its lockfile resolves', () => {
    const lock = read('plugins/claude/package-lock.json');

    expect(pinnedArg('plugins/claude/.mcp.json')).toBe(lockedDependency);
    expect(lock.packages['node_modules/@uteamup/mcp-server'].version).toBe(lockedDependency);
  });

  test('the repository dev config launches the same version as the plugin', () => {
    expect(pinnedArg('.mcp.json')).toBe(lockedDependency);
  });

  test('the pin is a released version no newer than this package', () => {
    const [pinned, current] = [lockedDependency, read('package.json').version]
      .map(version => version.split(/[.-]/).slice(0, 3).map(Number));

    expect(pinned.every(Number.isInteger)).toBe(true);
    const compare = pinned.findIndex((part, index) => part !== current[index]);
    expect(compare === -1 || pinned[compare] < current[compare]).toBe(true);
  });
});
