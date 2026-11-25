'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Document upload ticket MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'upload-ticket-token';
  const ticketGuid = '7b1d3c0e-2f4a-4b8e-9c6d-1a2b3c4d5e6f';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('issues a ticket and forwards the declared file verbatim', async () => {
    const args = { fileName: 'pump-manual.pdf', contentType: 'application/pdf', sizeBytes: 2048, description: 'Manual' };
    const response = await call('UteamupDocumentCreateUploadTicket', args, successReply({
      ticketGuid,
      uploadUrl: 'https://api.uteamup.com/api/mcp/upload-tickets/abc',
      method: 'PUT',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    }), args);

    const ticket = JSON.parse(response.body.result.content[0].text);
    expect(ticket.method).toBe('PUT');
    expect(ticket.uploadUrl).toMatch(/\/api\/mcp\/upload-tickets\//);
  });

  test('reads the ticket status with the document GUID once uploaded', async () => {
    const response = await call('UteamupDocumentUploadTicketGet', { ticketGuid }, successReply({
      ticketGuid, status: 'uploaded', documentGuid: '11111111-1111-4111-8111-111111111111',
    }), { ticketGuid });

    expect(JSON.parse(response.body.result.content[0].text).status).toBe('uploaded');
  });

  test('takes no tenant or user arguments', async () => {
    const args = { ticketGuid };
    await call('UteamupDocumentUploadTicketGet', args, successReply({ ticketGuid, status: 'waiting' }), args);

    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('userId');
  });

  test('preserves backend validation errors', async () => {
    const response = await call('UteamupDocumentCreateUploadTicket',
      { fileName: 'x.pdf', contentType: 'pdf', sizeBytes: 0 },
      errorReply(-32602, 'sizeBytes must be between 1 and 104857600 bytes.'));

    expect(response.body.error.code).toBe(-32602);
  });

  const tools = [
    { name: 'UteamupDocumentCreateUploadTicket', args: { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 10 } },
    { name: 'UteamupDocumentUploadTicketGet', args: { ticketGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
