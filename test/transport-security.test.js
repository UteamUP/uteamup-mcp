const { PassThrough } = require('stream');
const {
  BoundedLineBuffer,
  ProxyTransportError,
  attachRequestTimeout,
  collectResponseBody,
  getMcpRetryLimit,
  normalizeBackendBaseUrl,
  parseOAuthTokenResponse,
  toPublicErrorMessage
} = require('../lib/transport-security');

describe('MCP transport security', () => {
  describe('normalizeBackendBaseUrl', () => {
    test('normalizes an HTTPS origin', () => {
      expect(normalizeBackendBaseUrl('https://devback.uteamup.com/'))
        .toBe('https://devback.uteamup.com');
    });

    test.each([
      'http://api.uteamup.com',
      'https://user:password@api.uteamup.com',
      'https://api.uteamup.com/other-path',
      'https://api.uteamup.com/?redirect=https://attacker.example',
      'https://api.uteamup.com/#fragment'
    ])('rejects unsafe backend URL %s', unsafeUrl => {
      expect(() => normalizeBackendBaseUrl(unsafeUrl)).toThrow(/base URL/i);
    });
  });

  describe('BoundedLineBuffer', () => {
    test('emits complete lines split across chunks', () => {
      const buffer = new BoundedLineBuffer(64);

      expect(buffer.push('{"jsonrpc":"2.0",')).toEqual([]);
      expect(buffer.push('"id":1}\n')).toEqual([
        { line: '{"jsonrpc":"2.0","id":1}' }
      ]);
    });

    test('rejects one oversized line and resumes at the next newline', () => {
      const buffer = new BoundedLineBuffer(12);

      expect(buffer.push('1234567890123')).toEqual([{ oversized: true }]);
      expect(buffer.push('discarded\n{"id":1}\n')).toEqual([{ line: '{"id":1}' }]);
    });

    test('measures UTF-8 bytes instead of JavaScript characters', () => {
      const buffer = new BoundedLineBuffer(4);

      expect(buffer.push('ééé\n')).toEqual([{ oversized: true }]);
    });

    test('buffers a large multi-chunk line in O(N) without quadratic Buffer.concat calls', () => {
      const chunkSize = 1024;
      const chunkCount = 1024; // 1 MiB total
      const chunk = Buffer.alloc(chunkSize, 'a');
      const buffer = new BoundedLineBuffer(chunkSize * chunkCount + 16);
      const concatSpy = jest.spyOn(Buffer, 'concat');

      try {
        for (let i = 0; i < chunkCount; i += 1) {
          expect(buffer.push(chunk)).toEqual([]);
        }
        expect(concatSpy).not.toHaveBeenCalled();

        const events = buffer.push('\r\n');
        expect(concatSpy).toHaveBeenCalledTimes(1);
        expect(events).toHaveLength(1);
        expect(events[0].line.length).toBe(chunkSize * chunkCount);
        expect(events[0].line).toBe('a'.repeat(chunkSize * chunkCount));
        expect(buffer.pendingChunks).toEqual([]);
        expect(buffer.pendingLength).toBe(0);
      } finally {
        concatSpy.mockRestore();
      }
    });

    test('preserves multi-byte UTF-8 sequences split across chunks and CRLF stripping', () => {
      const buffer = new BoundedLineBuffer(32);
      const encoded = Buffer.from('café\r\nnext\n', 'utf8');

      // Split right in the middle of the 2-byte UTF-8 sequence for 'é' (0xc3, 0xa9)
      expect(buffer.push(encoded.subarray(0, 4))).toEqual([]);
      expect(buffer.push(encoded.subarray(4))).toEqual([
        { line: 'café' },
        { line: 'next' }
      ]);
    });
  });

  describe('parseOAuthTokenResponse', () => {
    test.each([
      ['camel case', '{"accessToken":"jwt-value","expiresIn":86400}', 86400],
      ['OAuth snake case', '{"access_token":"jwt-value","expires_in":3600}', 3600]
    ])('uses the %s token and backend lifetime', (_label, response, expiresInSeconds) => {
      expect(parseOAuthTokenResponse(response)).toEqual({
        accessToken: 'jwt-value',
        expiresInSeconds
      });
    });

    test.each([
      '{}',
      '{"accessToken":"jwt-value"}',
      '{"accessToken":"jwt-value","expiresIn":0}',
      '{"accessToken":"","expiresIn":3600}',
      'null',
      'not-json'
    ])('rejects a token response whose lifetime cannot be trusted: %s', response => {
      expect(() => parseOAuthTokenResponse(response)).toThrow(/token exchange/i);
    });
  });

  describe('getMcpRetryLimit', () => {
    test.each(['tools/list', 'resources/read', 'prompts/get', 'ping', 'server/discover'])(
      'retains configured retries for protocol read %s',
      method => {
        expect(getMcpRetryLimit(method, 3)).toBe(3);
      }
    );

    test.each(['tools/call', 'initialize', 'notifications/initialized', 'unknown/method'])(
      'disables automatic retries for potentially stateful method %s',
      method => {
        expect(getMcpRetryLimit(method, 3)).toBe(0);
      }
    );
  });

  describe('collectResponseBody', () => {
    test('collects a response within the configured byte limit', async () => {
      const response = new PassThrough();
      response.headers = {};
      const result = collectResponseBody(response, 16, 'MCP response');

      response.end('safe response');

      await expect(result).resolves.toBe('safe response');
    });

    test('rejects a declared oversized response before buffering it', async () => {
      const response = new PassThrough();
      response.headers = { 'content-length': '1000' };

      await expect(collectResponseBody(response, 16, 'MCP response'))
        .rejects.toThrow(/size limit/i);
    });

    test('rejects a chunked response when it crosses the byte limit', async () => {
      const response = new PassThrough();
      response.headers = {};
      const result = collectResponseBody(response, 4, 'MCP response');

      response.write('1234');
      response.end('5');

      await expect(result).rejects.toThrow(/size limit/i);
    });
  });

  test('attachRequestTimeout destroys the request with a safe timeout error', () => {
    const request = new PassThrough();
    request.on('error', () => {});
    const destroy = jest.spyOn(request, 'destroy');
    attachRequestTimeout(request, 'MCP request');

    request.emit('timeout');

    expect(destroy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'MCP request timed out'
    }));
  });

  test('only explicitly public transport errors reach JSON-RPC clients', () => {
    expect(toPublicErrorMessage(new ProxyTransportError('Request exceeds size limit')))
      .toBe('Request exceeds size limit');
    expect(toPublicErrorMessage(new Error('secret provider body and /private/path')))
      .toBe('The MCP request could not be completed');
  });
});
