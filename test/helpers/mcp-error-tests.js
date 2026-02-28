'use strict';

const nock = require('nock');
const { sendRawRequest } = require('./mcp-test-helpers');

/**
 * Generate a "JSON-RPC 2.0 compliance" describe block.
 *
 * @param {Function} callFn - bound callMcpTool(toolName, toolArgs, mockReply)
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describeJsonRpcCompliance(callFn, tools) {
  const complianceTools = tools.map((t, i) => ({ ...t, idBase: 200 + i }));

  describe('JSON-RPC 2.0 compliance', () => {
    test.each(complianceTools)(
      '$name — response has id and result, no error (JSON-RPC 2.0 success shape)',
      async ({ name, args, idBase }) => {
        const response = await callFn(
          name,
          args,
          {
            status: 200,
            body: {
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: '{}' }] },
              id: idBase
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.body.jsonrpc).toBe('2.0');
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
        expect(response.body.id).toBe(idBase);
      }
    );
  });
}

/**
 * Generate a "401 Unauthorized handling" describe block.
 *
 * @param {string} baseUrl - test base URL
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describe401Unauthorized(baseUrl, tools) {
  describe('401 Unauthorized handling', () => {
    test.each(tools)(
      '$name — 401 response from backend is surfaced correctly',
      async ({ name, args }) => {
        nock(baseUrl)
          .post('/mcp')
          .reply(401, 'Unauthorized');

        const statusCode = await sendRawRequest(baseUrl, name, args);
        expect(statusCode).toBe(401);
      }
    );
  });
}

/**
 * Generate a "503 Service Unavailable handling" describe block.
 *
 * @param {string} baseUrl - test base URL
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describe503ServiceUnavailable(baseUrl, tools) {
  describe('503 Service Unavailable handling', () => {
    test.each(tools)(
      '$name — 503 response is surfaced correctly, not a crash',
      async ({ name, args }) => {
        nock(baseUrl)
          .post('/mcp')
          .reply(503, 'Service Unavailable');

        const statusCode = await sendRawRequest(baseUrl, name, args);
        expect(statusCode).toBe(503);
      }
    );
  });
}

module.exports = {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
};
