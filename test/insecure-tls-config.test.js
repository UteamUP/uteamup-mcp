/**
 * UTEAMUP-SEC-2026-05-02-008 — TLS verification config regression test.
 *
 * Pins three properties of the insecureTLS flag:
 *   1. Defaults to false (TLS verification ON) when no env var is set.
 *   2. Honours UTEAMUP_INSECURE_TLS=1 (and "true") only when the baseUrl is
 *      a loopback host (localhost, 127.0.0.0/8, ::1), like the CLI.
 *   3. IGNORES the flag, with a warning, for every other host — production,
 *      dev, staging, private IPs and lookalikes — so a misconfigured CI runner
 *      or confused dev cannot expose OAuth + token exchange to a MITM just by
 *      exporting one env var.
 */

jest.mock('../lib/logger', () => ({
  ...jest.requireActual('../lib/logger'),
  warn: jest.fn()
}));

const { warn } = require('../lib/logger');
const { loadConfig, configSchema } = require('../lib/config');

beforeEach(() => {
  warn.mockClear();
});

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
    expect(warn).not.toHaveBeenCalled();
  });

  test.each([
    'https://localhost:5002',
    'https://LOCALHOST:5002',
    'https://127.0.0.1:5002',
    'https://127.10.20.30',
    'https://[::1]:5002'
  ])('honours UTEAMUP_INSECURE_TLS=1 against loopback %s', baseUrl => {
    const cfg = withEnv({ UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: baseUrl }, loadConfig);
    expect(cfg.insecureTLS).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  test.each([
    'https://api.uteamup.com',
    'https://devback.uteamup.com',
    'https://prufaback.uteamup.com',
    'https://10.0.0.5:5002',
    'https://192.168.68.86',
    'https://[::ffff:127.0.0.1]',
    'https://localhost.evil.example',
    'https://evil-localhost',
    'https://127.0.0.1.evil.example',
    'https://localhost.:5002'
  ])('ignores UTEAMUP_INSECURE_TLS=1 and warns for non-loopback %s', baseUrl => {
    const cfg = withEnv({ UTEAMUP_INSECURE_TLS: '1', UTEAMUP_API_BASE_URL: baseUrl }, loadConfig);
    expect(cfg.insecureTLS).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('UTEAMUP_INSECURE_TLS ignored'),
      { baseUrl: cfg.baseUrl }
    );
  });

  test('does not warn when the flag is unset against a non-loopback host', () => {
    const cfg = withEnv(
      { UTEAMUP_INSECURE_TLS: undefined, UTEAMUP_API_BASE_URL: 'https://devback.uteamup.com' },
      loadConfig
    );
    expect(cfg.insecureTLS).toBe(false);
    expect(warn).not.toHaveBeenCalled();
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
