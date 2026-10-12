/**
 * UTEAMUP-SEC-2026-05-02-008 — TLS verification config regression test.
 *
 * Pins three properties of the insecureTLS flag:
 *   1. Defaults to false (TLS verification ON) when no env var is set.
 *   2. Honours UTEAMUP_INSECURE_TLS=1 (and "true") when the baseUrl is
 *      a dev / staging host.
 *   3. IGNORES the flag when baseUrl resolves to api.uteamup.com — a
 *      misconfigured CI runner or confused dev cannot MITM production
 *      OAuth + token exchange just by exporting one env var.
 */

const { loadConfig, configSchema } = require('../lib/config');

const REQUIRED_ENV = {
  UTEAMUP_API_KEY: 'a'.repeat(32),
  UTEAMUP_SECRET: 'b'.repeat(64),
};

function withEnv(overrides, fn) {
  const saved = {};
  const keys = new Set([
    ...Object.keys(REQUIRED_ENV),
    ...Object.keys(overrides),
    'UTEAMUP_INSECURE_TLS',
    'UTEAMUP_API_BASE_URL',
  ]);
  for (const k of keys) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries({ ...REQUIRED_ENV, ...overrides })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

describe('UTEAMUP-SEC-2026-05-02-008 — insecureTLS config', () => {
  test('defaults to false when no env var is set', () => {
    const cfg = withEnv({ UTEAMUP_INSECURE_TLS: undefined }, loadConfig);
    expect(cfg.insecureTLS).toBe(false);
  });

  test('honours UTEAMUP_INSECURE_TLS=1 against dev backend', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: 'https://devback.uteamup.com' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(true);
  });

  test('honours UTEAMUP_INSECURE_TLS=1 against localhost', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: 'https://localhost:5002' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(true);
  });

  test('honours UTEAMUP_INSECURE_TLS=true (string form)', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: 'true', UTEAMUP_API_BASE_URL: 'https://localhost:5002' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(true);
  });

  test('IGNORES UTEAMUP_INSECURE_TLS against api.uteamup.com (production guard)', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: 'https://api.uteamup.com' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(false);
  });

  test.each([
    'https://api.uteamup.com:443',
    'https://API.UTEAMUP.COM:443/',
    'https://api.uteamup.com.',
    'https://api.uteamup.com.:8443',
    'https://%61pi.uteamup.com'
  ])('requires production TLS verification for %s', baseUrl => {
    const cfg = withEnv({ UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: baseUrl }, loadConfig);
    expect(cfg.insecureTLS).toBe(false);
    expect(configSchema.parse({
      apiKey: REQUIRED_ENV.UTEAMUP_API_KEY,
      secret: REQUIRED_ENV.UTEAMUP_SECRET,
      baseUrl,
      insecureTLS: true
    }).insecureTLS).toBe(false);
  });

  test('rejects a production base URL with a subpath before applying TLS settings', () => {
    expect(() => withEnv(
      { UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: 'https://api.uteamup.com/some/path' },
      loadConfig
    )).toThrow(/base URL/i);
  });

  test('off by default against api.uteamup.com', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: undefined, UTEAMUP_API_BASE_URL: 'https://api.uteamup.com' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(false);
  });
});
