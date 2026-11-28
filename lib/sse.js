'use strict';

/**
 * Server-Sent Events handling for backend MCP responses.
 *
 * A streamable-HTTP response may carry several events: notifications (progress, log messages) before the
 * final JSON-RPC response. Each event's `data:` lines are joined with "\n" as the SSE spec requires.
 */

/**
 * @param {string} text - raw text/event-stream body
 * @returns {object[]} every event whose data parsed as JSON, in order
 */
function parseSseMessages(text) {
  const messages = [];
  let data = [];
  const flush = () => {
    if (data.length === 0) return;
    try {
      messages.push(JSON.parse(data.join('\n')));
    } catch {
      // Not JSON (keep-alive or comment payload); skip it.
    }
    data = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine === '') {
      flush();
    } else if (rawLine.startsWith('data:')) {
      data.push(rawLine.slice(5).replace(/^ /, ''));
    }
  }
  flush();
  return messages;
}

function isResponse(message) {
  return message && typeof message === 'object' && ('result' in message || 'error' in message);
}

/**
 * Splits parsed events into the response for this request and the notifications to forward.
 * @param {object[]} messages
 * @param {string|number|null|undefined} requestId
 * @returns {{response: object|null, notifications: object[]}}
 */
function selectResponse(messages, requestId) {
  const responses = messages.filter(isResponse);
  const response = (requestId !== undefined && requestId !== null
    ? responses.find(message => message.id === requestId)
    : responses[responses.length - 1]) ?? null;
  const notifications = messages.filter(
    message => message && message.jsonrpc === '2.0' && typeof message.method === 'string' && message.id === undefined,
  );
  return { response, notifications };
}

/** True when a body looks like text/event-stream rather than plain JSON. */
function looksLikeSse(text) {
  return /^(?:event|data|id|retry):/m.test(text) || text.startsWith(':');
}

module.exports = { parseSseMessages, selectResponse, looksLikeSse };
