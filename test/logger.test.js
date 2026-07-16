/**
 * Logger tests
 */

const { redactSensitive } = require('../lib/logger');

describe('Logger', () => {
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
  });
});
