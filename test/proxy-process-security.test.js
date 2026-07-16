const path = require('path');
const { spawnSync } = require('child_process');

const proxyPath = path.resolve(__dirname, '..', 'index.js');
const validEnvironment = {
  ...process.env,
  UTEAMUP_API_KEY: '12345678901234567890123456789012',
  UTEAMUP_SECRET: '1234567890123456789012345678901234567890123456789012345678901234',
  UTEAMUP_MAX_REQUEST_BYTES: '1024',
  UTEAMUP_LOG_LEVEL: 'DEBUG'
};

describe('MCP proxy process security boundary', () => {
  test('rejects oversized and malformed input without echoing payloads or stacks', () => {
    const secretPayload = `private-${'x'.repeat(1024)}`;
    const result = spawnSync(process.execPath, [proxyPath], {
      env: validEnvironment,
      input: `${secretPayload}\nnot-json-private-marker\n`,
      encoding: 'utf8',
      timeout: 10000
    });

    expect(result.status).toBe(0);
    const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    expect(responses).toEqual([
      {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Request exceeds the configured size limit' },
        id: null
      },
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null
      }
    ]);
    expect(result.stdout).not.toContain('private-marker');
    expect(result.stdout).not.toContain('stack');
    expect(result.stderr).not.toContain(secretPayload);
    expect(result.stderr).not.toContain('not-json-private-marker');
  });

  test('rejects a structurally invalid JSON-RPC request before authentication', () => {
    const result = spawnSync(process.execPath, [proxyPath], {
      env: validEnvironment,
      input: '{"jsonrpc":"2.0","id":"request-id"}\n',
      encoding: 'utf8',
      timeout: 10000
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: 'request-id'
    });
  });
});
