/**
 * Security helpers for the stdio-to-HTTPS transport boundary.
 *
 * Only ProxyTransportError messages are safe to return to an MCP client. All
 * other errors may contain backend response bodies, local paths, or secrets.
 */

class ProxyTransportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProxyTransportError';
  }
}

const RETRY_SAFE_MCP_METHODS = new Set([
  'ping',
  'prompts/get',
  'prompts/list',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'server/discover',
  'tools/list'
]);

/**
 * Parse the token response and require the backend-provided lifetime. Guessing
 * a lifetime can leave an expired token cached long after the server rejects it.
 *
 * @param {string} data
 * @returns {{accessToken: string, expiresInSeconds: number}}
 */
function parseOAuthTokenResponse(data) {
  let json;
  try {
    json = JSON.parse(data);
  } catch {
    throw new ProxyTransportError('Token exchange returned invalid JSON');
  }

  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new ProxyTransportError('Token exchange returned an invalid response');
  }

  const accessToken = json.accessToken || json.access_token;
  const expiresInValue = json.expiresIn ?? json.expires_in;
  const expiresInSeconds = Number(expiresInValue);
  if (
    typeof accessToken !== 'string' ||
    accessToken.trim().length === 0 ||
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    throw new ProxyTransportError('Token exchange returned an invalid response');
  }

  return { accessToken, expiresInSeconds };
}

/**
 * Only retry protocol reads. `tools/call` may mutate business data, and the
 * proxy cannot prove that every tool is idempotent after a lost response.
 *
 * @param {string} method
 * @param {number} configuredMaxRetries
 * @returns {number}
 */
function getMcpRetryLimit(method, configuredMaxRetries) {
  return RETRY_SAFE_MCP_METHODS.has(method) ? configuredMaxRetries : 0;
}

/**
 * Accept only a bare HTTPS origin for the configured backend.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeBackendBaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new ProxyTransportError('Base URL must be a valid HTTPS origin');
  }

  const hasUnexpectedPath = url.pathname !== '' && url.pathname !== '/';
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    hasUnexpectedPath ||
    url.search ||
    url.hash
  ) {
    throw new ProxyTransportError('Base URL must be a bare HTTPS origin without credentials, path, query, or fragment');
  }

  return url.origin;
}

/**
 * Incrementally reads newline-delimited input without allowing one untrusted
 * request to grow memory without bound.
 */
class BoundedLineBuffer {
  constructor(maxBytes) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new TypeError('maxBytes must be a positive safe integer');
    }

    this.maxBytes = maxBytes;
    this.pending = Buffer.alloc(0);
    this.discardingOversizedLine = false;
  }

  /**
   * @param {string|Buffer} chunk
   * @returns {Array<{line: string}|{oversized: true}>}
   */
  push(chunk) {
    let remaining = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    const events = [];

    while (remaining.length > 0) {
      if (this.discardingOversizedLine) {
        const newlineIndex = remaining.indexOf(0x0a);
        if (newlineIndex === -1) {
          return events;
        }

        remaining = remaining.subarray(newlineIndex + 1);
        this.discardingOversizedLine = false;
        continue;
      }

      const newlineIndex = remaining.indexOf(0x0a);
      if (newlineIndex === -1) {
        if (this.pending.length + remaining.length > this.maxBytes) {
          this.pending = Buffer.alloc(0);
          this.discardingOversizedLine = true;
          events.push({ oversized: true });
        } else {
          this.pending = Buffer.concat([this.pending, remaining]);
        }
        return events;
      }

      const lineRemainder = remaining.subarray(0, newlineIndex);
      const lineLength = this.pending.length + lineRemainder.length;

      if (lineLength > this.maxBytes) {
        events.push({ oversized: true });
      } else {
        let line = Buffer.concat([this.pending, lineRemainder]).toString('utf8');
        if (line.endsWith('\r')) {
          line = line.slice(0, -1);
        }
        events.push({ line });
      }

      this.pending = Buffer.alloc(0);
      remaining = remaining.subarray(newlineIndex + 1);
    }

    return events;
  }
}

/**
 * Collect an HTTP response body up to a strict byte limit.
 *
 * @param {import('stream').Readable & {headers?: object}} response
 * @param {number} maxBytes
 * @param {string} label
 * @returns {Promise<string>}
 */
function collectResponseBody(response, maxBytes, label) {
  const declaredLength = Number(response.headers?.['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    response.resume?.();
    return Promise.reject(new ProxyTransportError(`${label} exceeded the configured size limit`));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const rejectOnce = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    response.on('data', chunk => {
      if (settled) return;

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        rejectOnce(new ProxyTransportError(`${label} exceeded the configured size limit`));
        response.destroy?.();
        return;
      }

      chunks.push(buffer);
    });

    response.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    response.once('aborted', () => rejectOnce(new ProxyTransportError(`${label} was interrupted`)));
    response.once('error', rejectOnce);
  });
}

/**
 * Ensure socket timeouts terminate the underlying request.
 *
 * @param {import('stream').Writable} request
 * @param {string} label
 */
function attachRequestTimeout(request, label) {
  request.once('timeout', () => {
    request.destroy(new ProxyTransportError(`${label} timed out`));
  });
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function toPublicErrorMessage(error) {
  return error instanceof ProxyTransportError
    ? error.message
    : 'The MCP request could not be completed';
}

module.exports = {
  BoundedLineBuffer,
  ProxyTransportError,
  attachRequestTimeout,
  collectResponseBody,
  getMcpRetryLimit,
  normalizeBackendBaseUrl,
  parseOAuthTokenResponse,
  toPublicErrorMessage
};
