'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Part comments through the existing Comment tools', () => {
  const base = 'https://api.uteamup.com';
  const partGuid = '11111111-1111-4111-8111-111111111111';
  const commentGuid = '22222222-2222-4222-8222-222222222222';
  const comment = {
    guid: commentGuid, partGuid, partName: 'Beam bridge kit', text: 'Consider Wi-Fi 8 when purchasing',
    workorderGuid: '00000000-0000-0000-0000-000000000000', workorderName: '',
    authorGuid: '33333333-3333-4333-8333-333333333333', authorName: 'Author',
    tenantGuid: '44444444-4444-4444-8444-444444444444',
    createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-04T10:00:00Z', mentionedUserGuids: [],
  };
  const cases = [
    { name: 'UteamupCommentCreate', args: { model: { partGuid, text: comment.text } }, result: comment },
    { name: 'UteamupCommentGet', args: { commentGuid }, result: comment },
    { name: 'UteamupCommentListByPartPaginated', args: { partGuid, page: 2, pageSize: 3 },
      result: { items: [comment], pageNumber: 2, pageSize: 3, totalCount: 4, totalPages: 2 } },
    { name: 'UteamupCommentUpdateForPart', args: { partGuid, commentGuid, model: { text: 'Corrected observation' } },
      result: { ...comment, text: 'Corrected observation', updatedAt: '2026-11-04T11:00:00Z' } },
    { name: 'UteamupCommentDelete', args: { commentGuid }, result: true },
  ];
  const call = (name, args, reply) => callMcpTool(base, 'part-comment-test-token', name, args, reply, args);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  for (const entry of cases) {
    test(`${entry.name} forwards exact GUID-only scope and preserves response metadata`, async () => {
      const response = await call(entry.name, entry.args, successReply(entry.result));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(entry.result);
      expect(nock.isDone()).toBe(true);
      expect(entry.args).not.toHaveProperty('tenantId');
      expect(entry.args).not.toHaveProperty('userId');
      expect(entry.args).not.toHaveProperty('partId');
      expect(entry.args).not.toHaveProperty('commentId');
    });
    test(`${entry.name} retains server permission or authorship denial`, async () => {
      const response = await call(entry.name, entry.args, errorReply(-32003, 'Part.View and the matching Comment permission are required; only the author may change a comment'));
      expect(response.body.error.code).toBe(-32003);
      expect(response.body.error.message).toContain('Part.View');
      expect(response.body.error.message).toContain('only the author');
    });
  }

  test('empty bounded part threads remain empty with their page metadata', async () => {
    const empty = { items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0 };
    const response = await call(cases[2].name, { partGuid, page: 1, pageSize: 20 }, successReply(empty));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test('a missing comment remains null and unsuccessful removal remains false', async () => {
    const read = await call(cases[1].name, { commentGuid }, successReply(null));
    const remove = await call(cases[4].name, { commentGuid }, successReply(false));
    expect(JSON.parse(read.body.result.content[0].text)).toBeNull();
    expect(JSON.parse(remove.body.result.content[0].text)).toBe(false);
  });

  test('unsupported part mentions/media are not silently accepted by the wire contract', async () => {
    const args = { model: { partGuid, text: 'Observation', documentGuids: [commentGuid] } };
    const response = await call(cases[0].name, args, errorReply(-32602, 'Part comments do not support mentions or embedded media.'));
    expect(response.body.error.message).toBe('Part comments do not support mentions or embedded media.');
    expect(nock.isDone()).toBe(true);
  });

  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(base, cases);
  describe503ServiceUnavailable(base, cases);
});
