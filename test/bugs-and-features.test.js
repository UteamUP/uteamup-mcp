/** Canonical report administration and reporter tools forwarded by the generic MCP proxy. */
'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

const BASE_URL = 'https://api.test.com';
const TOKEN = 'unit-test-token';
const report = '11111111-1111-4111-8111-111111111111';
const attachment = '22222222-2222-4222-8222-222222222222';
const row = { externalGuid: report, title: 'Example report', type: 'bug', status: 'new' };
const cases = [
  { name: 'uteamup_bugsandfeatures_list', args: { query: { page: 2, pageSize: 10, search: 'MCP' } }, result: { items: [row], totalCount: 11, page: 2, pageSize: 10 } },
  { name: 'uteamup_bugsandfeatures_get', args: { externalGuid: report }, result: { ...row, statusHistory: [], comments: [] } },
  { name: 'uteamup_bugsandfeatures_update_status', args: { externalGuid: report, input: { toStatus: 'validated', note: 'Verified reproduction' } }, result: { ...row, status: 'validated' } },
  { name: 'uteamup_bugsandfeatures_update_notes', args: { externalGuid: report, input: { additionalNotes: 'Acceptance evidence' } }, result: { ...row, additionalNotes: 'Acceptance evidence' } },
  { name: 'uteamup_bugsandfeatures_update_type', args: { externalGuid: report, input: { type: 'feature', note: 'Product request' } }, result: { ...row, type: 'feature' } },
  { name: 'uteamup_bugsandfeatures_increment_hit', args: { externalGuid: report, input: { environment: 'dev', evidence: 'A new observation' } }, result: { cluster: row, occurrenceCountBefore: 1, occurrenceCountAfter: 2 } },
  { name: 'uteamup_bugsandfeatures_delete', args: { externalGuid: report }, result: true },
  { name: 'uteamup_bugsandfeatures_comments_list', args: { externalGuid: report, page: 1, pageSize: 20 }, result: { items: [], totalCount: 0, page: 1, pageSize: 20 } },
  { name: 'uteamup_bugsandfeatures_comments_add', args: { externalGuid: report, input: { bodyHtml: '<p>Verified</p>', isVisibleToReporter: false } }, result: { externalGuid: attachment, bodyHtml: '<p>Verified</p>', isVisibleToReporter: false } },
  { name: 'uteamup_bugsandfeatures_attachments_list', args: { externalGuid: report }, result: [] },
  { name: 'uteamup_bugsandfeatures_attachments_upload', args: { externalGuid: report, contentType: 'image/png', fileName: 'evidence.png', base64: 'aW1hZ2U=' }, result: { externalGuid: attachment } },
  { name: 'uteamup_bugsandfeatures_attachments_download', args: { externalGuid: report, attachmentExternalGuid: attachment }, result: { url: 'https://storage.example.test/short-lived-attachment' } },
  { name: 'uteamup_bugsandfeatures_attachments_delete', args: { externalGuid: report, attachmentExternalGuid: attachment }, result: true },
  { name: 'uteamup_bug_report_create', args: { type: 'bug', title: 'Example report', description: 'Steps and expected result', severity: 'high', idempotencyKey: 'same-request' }, result: { ...row, wasCreated: true } },
  { name: 'uteamup_bug_report_list_mine', args: {}, result: [row] },
  { name: 'uteamup_bug_report_get_conversation', args: { reportGuid: report }, result: { ...row, statusTimeline: [], comments: [] } },
  { name: 'uteamup_bug_report_add_comment', args: { reportGuid: report, message: 'More reproduction steps' }, result: { bodyHtml: 'More reproduction steps' } },
];

describe('Bugs & Features MCP contracts', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (name, args, reply) => callMcpTool(BASE_URL, TOKEN, name, args, reply, args);

  test.each(cases)('$name preserves its complete arguments and response', async ({ name, args, result }) => {
    const response = await call(name, args, successReply(result));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    expect(nock.isDone()).toBe(true);
  });

  test('an empty platform search remains an empty result', async () => {
    const empty = { items: [], totalCount: 0, page: 1, pageSize: 50 };
    const response = await call('uteamup_bugsandfeatures_list', { query: { search: 'no matches' } }, successReply(empty));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test('platform authority refusal is preserved as a tool error', async () => {
    const reply = { status: 200, body: { jsonrpc: '2.0', id: 1,
      result: { isError: true, content: [{ type: 'text', text: 'Configured Global Admin access required' }] } } };
    const response = await call('uteamup_bugsandfeatures_list', {}, reply);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('Global Admin');
  });

  const tools = cases.map(({ name, args }) => ({ name, args }));
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
