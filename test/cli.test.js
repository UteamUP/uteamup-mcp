'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { version } = require('../package.json');

const proxyPath = path.resolve(__dirname, '..', 'index.js');

describe('MCP proxy CLI utilities', () => {
  test.each(['--version', '-v', '--help', '-h'])('%s reports the package version without credentials', flag => {
    const result = spawnSync(process.execPath, [proxyPath, flag], {
      env: {},
      encoding: 'utf8',
      timeout: 10000
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    if (flag === '--version' || flag === '-v') {
      expect(result.stdout.trim()).toBe(`v${version}`);
    } else {
      expect(result.stdout).toContain(`UteamUP MCP Proxy v${version}`);
    }
  });
});
