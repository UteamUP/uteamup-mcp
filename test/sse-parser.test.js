'use strict';

const { parseSseMessages, selectResponse, looksLikeSse } = require('../lib/sse');

describe('SSE parser (lib/sse)', () => {
  test('parses a single response event', () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n';

    expect(parseSseMessages(body)).toEqual([{ jsonrpc: '2.0', id: 1, result: { ok: true } }]);
  });

  test('accepts data lines without the optional space and CRLF line endings', () => {
    const body = 'event: message\r\ndata:{"jsonrpc":"2.0","id":2,"result":{}}\r\n\r\n';

    expect(parseSseMessages(body)).toEqual([{ jsonrpc: '2.0', id: 2, result: {} }]);
  });

  test('joins multi-line data of one event with newlines', () => {
    const body = 'data: {"jsonrpc":"2.0",\ndata: "id":3,"result":{"text":"a"}}\n\n';

    expect(parseSseMessages(body)).toEqual([{ jsonrpc: '2.0', id: 3, result: { text: 'a' } }]);
  });

  test('keeps every event, skipping comments, keep-alives and non-JSON data', () => {
    const body = [
      ': keep-alive',
      '',
      'data: not json',
      '',
      'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}',
      '',
      'data: {"jsonrpc":"2.0","id":4,"result":{}}',
      '',
    ].join('\n');

    expect(parseSseMessages(body)).toHaveLength(2);
  });

  test('returns the response for the request id and forwards notifications sent before it', () => {
    const messages = [
      { jsonrpc: '2.0', method: 'notifications/progress', params: { progress: 50 } },
      { jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', data: 'x' } },
      { jsonrpc: '2.0', id: 7, result: { content: [] } },
    ];

    const { response, notifications } = selectResponse(messages, 7);

    expect(response).toEqual({ jsonrpc: '2.0', id: 7, result: { content: [] } });
    expect(notifications.map(n => n.method)).toEqual(['notifications/progress', 'notifications/message']);
  });

  test('prefers the response whose id matches over another response in the stream', () => {
    const messages = [
      { jsonrpc: '2.0', id: 8, result: { mine: true } },
      { jsonrpc: '2.0', id: 9, result: { mine: false } },
    ];

    expect(selectResponse(messages, 8).response.result.mine).toBe(true);
  });

  test('keeps error responses', () => {
    const { response } = selectResponse([{ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'bad' } }], 1);

    expect(response.error.code).toBe(-32602);
  });

  test('does not forward server-to-client requests as notifications', () => {
    const messages = [{ jsonrpc: '2.0', id: 'srv-1', method: 'sampling/createMessage', params: {} }];

    expect(selectResponse(messages, 1)).toEqual({ response: null, notifications: [] });
  });

  test('returns no response for an empty stream', () => {
    expect(selectResponse(parseSseMessages(''), 1)).toEqual({ response: null, notifications: [] });
  });

  test.each([
    ['event: message\ndata: {}', true],
    ['data: {}', true],
    [': comment\n', true],
    ['{"jsonrpc":"2.0","id":1,"result":{"text":"data: inside"}}', false],
  ])('detects SSE bodies (%p)', (body, expected) => {
    expect(looksLikeSse(body)).toBe(expected);
  });
});
