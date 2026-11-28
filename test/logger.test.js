/**
 * Logger tests
 */

const { redactSensitive } = require('../lib/logger');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

describe('Logger', () => {
  test('redacts capability and OAuth fields recursively without hiding diagnostic codes', () => {
    const keys = ['uploadUrl', 'upload_url', 'downloadUrl', 'download_url',
      'client_assertion', 'assertion', 'code', 'state', 'email'];
    const fields = Object.fromEntries(keys.map(key => [key, `private-${key}`]));
    const input = { nested: [fields], STATUSCODE: 403, errorCode: 'E_NETWORK' };
    const result = redactSensitive(input);

    for (const key of keys) expect(result.nested[0][key]).toBe('[REDACTED]');
    expect(redactSensitive({ UPLOADURL: 'private', EMAIL: 'private' }))
      .toEqual({ UPLOADURL: '[REDACTED]', EMAIL: '[REDACTED]' });
    expect(result.STATUSCODE).toBe(403);
    expect(result.errorCode).toBe('E_NETWORK');
    expect(input.nested[0]).toEqual(fields);
  });

  test('sanitizes capability URLs and OAuth parameters in free text', () => {
    const value = 'GET https://api.uteamup.com/api/mcp/download-links/download-secret?x=1 ' +
      'PUT /api/mcp/upload-tickets/upload-secret ' +
      'callback?code=code-secret&state=state-secret&email=email-secret ' +
      'client_assertion=client-secret assertion=assertion-secret';
    const result = redactSensitive(value);

    for (const secret of ['download-secret', 'upload-secret', 'code-secret', 'state-secret',
      'email-secret', 'client-secret', 'assertion-secret']) expect(result).not.toContain(secret);
    expect(result).toContain('/api/mcp/download-links/[REDACTED]');
    expect(result).toContain('/api/mcp/upload-tickets/[REDACTED]');
    expect(redactSensitive('request failed with statusCode=403')).toContain('statusCode=403');
  });

  test('sanitizes Error messages, stacks, causes and custom context without mutation', () => {
    const cause = new Error('callback?code=cause-secret');
    const err = new Error('GET /api/mcp/download-links/error-secret', { cause });
    err.downloadUrl = 'custom-secret';
    err.details = { state: 'nested-secret' };
    err.self = err;
    const result = redactSensitive(err);
    const serialized = JSON.stringify(result);

    for (const secret of ['cause-secret', 'error-secret', 'custom-secret', 'nested-secret'])
      expect(serialized).not.toContain(secret);
    expect(result.type).toBe('Error');
    expect(result.stack).toContain('Error: GET');
    expect(result.cause.message).toContain('[REDACTED]');
    expect(result.self).toBe('[Circular]');
    expect(err.message).toContain('error-secret');
    expect(cause.message).toContain('cause-secret');
    expect(err.downloadUrl).toBe('custom-secret');
  });

  test('sanitizes emitted JSON from wrappers, raw Pino and child bindings', () => {
    const script = `
      const log = require('./lib/logger');
      const err = new TypeError('callback?code=error-private');
      err.cause = new Error('GET /api/mcp/upload-tickets/cause-private');
      err.email = 'error-email-private';
      log.error('GET /api/mcp/download-links/message-private', err);
      for (const level of ['trace', 'debug', 'info', 'warn', 'error']) {
        log[level]('callback?state=message-state-private', { deep: [{ uploadUrl: 'context-private' }] });
      }
      log.logger.info({ download_url: 'raw-private', nested: { assertion: 'assertion-private' } }, 'raw');
      log.logger.error(err, 'raw error');
      log.createChildLogger({ deep: { email: 'child-private' } }).info('child');
      const child = log.logger.child({ deep: { nested: { code: 'raw-child-private' } } });
      child.info('raw child');
      child.child({ route: '/api/mcp/upload-tickets/descendant-private' }).info('descendant');
      log.logger.info('GET %s/%s', '/api/mcp/upload-tickets', 'interpolated-private');
      log.logger.info('callback?%s=%s', 'code', 'oauth-interpolated-private');
    `;
    const run = spawnSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, UTEAMUP_LOG_FORMAT: 'json', UTEAMUP_LOG_LEVEL: 'TRACE' },
      encoding: 'utf8'
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('');
    const records = run.stderr.trim().split('\n').map(line => JSON.parse(line));
    expect(records).toHaveLength(13);
    for (const secret of ['error-private', 'cause-private', 'error-email-private', 'message-private',
      'message-state-private', 'context-private', 'raw-private', 'assertion-private', 'child-private',
      'raw-child-private', 'descendant-private', 'interpolated-private', 'oauth-interpolated-private'])
      expect(run.stderr).not.toContain(secret);
    expect(records[0].err.type).toBe('TypeError');
    expect(records[0].err.stack).toContain('TypeError:');
  });

  describe('redactSensitive', () => {
    test('should redact authorization header', () => {
      const data = {
        Authorization: 'Bearer token123',
        otherData: 'visible'
      };

      const redacted = redactSensitive(data);

      expect(redacted.Authorization).toBe('[REDACTED]');
      expect(redacted.otherData).toBe('visible');
    });

    test('should redact client_secret', () => {
      const data = {
        client_secret: 'secret123',
        client_id: 'public'
      };

      const redacted = redactSensitive(data);

      expect(redacted.client_secret).toBe('[REDACTED]');
      expect(redacted.client_id).toBe('public');
    });

    test('should redact access_token', () => {
      const data = {
        access_token: 'token123',
        expires_in: 3600
      };

      const redacted = redactSensitive(data);

      expect(redacted.access_token).toBe('[REDACTED]');
      expect(redacted.expires_in).toBe(3600);
    });

    test('should redact nested objects', () => {
      const data = {
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json'
        }
      };

      const redacted = redactSensitive(data);

      expect(redacted.headers.Authorization).toBe('[REDACTED]');
      expect(redacted.headers['Content-Type']).toBe('application/json');
    });

    test('should redact arrays', () => {
      const data = {
        items: [
          { Authorization: 'Bearer token1', id: 1 },
          { Authorization: 'Bearer token2', id: 2 }
        ]
      };

      const redacted = redactSensitive(data);

      expect(redacted.items[0].Authorization).toBe('[REDACTED]');
      expect(redacted.items[1].Authorization).toBe('[REDACTED]');
      expect(redacted.items[0].id).toBe(1);
      expect(redacted.items[1].id).toBe(2);
    });

    test('should handle case-insensitive matching', () => {
      const data = {
        AUTHORIZATION: 'Bearer token',
        authorization: 'Bearer token',
        Authorization: 'Bearer token'
      };

      const redacted = redactSensitive(data);

      expect(redacted.AUTHORIZATION).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.Authorization).toBe('[REDACTED]');
    });

    test('should not mutate original object', () => {
      const data = {
        Authorization: 'Bearer token',
        visible: 'data'
      };

      const originalAuth = data.Authorization;
      redactSensitive(data);

      expect(data.Authorization).toBe(originalAuth);
    });

    test('should handle null and undefined', () => {
      expect(redactSensitive(null)).toBeNull();
      expect(redactSensitive(undefined)).toBeUndefined();
    });

    test('should handle primitive types', () => {
      expect(redactSensitive('string')).toBe('string');
      expect(redactSensitive(123)).toBe(123);
      expect(redactSensitive(true)).toBe(true);
    });

    test('should redact password fields', () => {
      const data = {
        username: 'user',
        password: 'pass123'
      };

      const redacted = redactSensitive(data);

      expect(redacted.username).toBe('user');
      expect(redacted.password).toBe('[REDACTED]');
    });

    test('should redact fields containing "secret"', () => {
      const data = {
        mySecret: 'value',
        secretKey: 'value',
        publicField: 'visible'
      };

      const redacted = redactSensitive(data);

      expect(redacted.mySecret).toBe('[REDACTED]');
      expect(redacted.secretKey).toBe('[REDACTED]');
      expect(redacted.publicField).toBe('visible');
    });

    test('should redact numeric handover codes at every nesting level', () => {
      const data = {
        numericCode: '12345678',
        result: {
          numeric_code: '87654321',
          statusCode: 200
        }
      };

      const redacted = redactSensitive(data);

      expect(redacted.numericCode).toBe('[REDACTED]');
      expect(redacted.result.numeric_code).toBe('[REDACTED]');
      expect(redacted.result.statusCode).toBe(200);
    });

    test('should redact API keys, cookies, OAuth redirects, and refresh tokens', () => {
      const redacted = redactSensitive({
        apiKey: 'api-key-value',
        cookie: 'session=value',
        setCookie: 'session=value',
        oauthRedirect: 'https://localhost/callback?code=secret-code',
        refreshToken: 'refresh-token-value',
        visible: 'safe'
      });

      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.cookie).toBe('[REDACTED]');
      expect(redacted.setCookie).toBe('[REDACTED]');
      expect(redacted.oauthRedirect).toBe('[REDACTED]');
      expect(redacted.refreshToken).toBe('[REDACTED]');
      expect(redacted.visible).toBe('safe');
    });

    test('should redact GPS and photo bytes from peer-sync style payloads', () => {
      const redacted = redactSensitive({
        gps: { latitude: 64.1, longitude: -21.9 },
        photo: '<binary>',
        bytes: 'ff00',
        blob: 'aabb',
        latitude: 1,
        longitude: 2,
        workorderGuid: 'visible-guid'
      });

      expect(redacted.gps).toBe('[REDACTED]');
      expect(redacted.photo).toBe('[REDACTED]');
      expect(redacted.bytes).toBe('[REDACTED]');
      expect(redacted.blob).toBe('[REDACTED]');
      expect(redacted.latitude).toBe('[REDACTED]');
      expect(redacted.longitude).toBe('[REDACTED]');
      expect(redacted.workorderGuid).toBe('visible-guid');
    });
  });
});
