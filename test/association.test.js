/**
 * UteamUP Home housing association MCP tool tests
 *
 * Tools under test (backend AssociationTools.cs):
 *   uteamup_association_meetings_list / meeting_get / meeting_create / meeting_update / meeting_delete
 *   uteamup_association_votes_list / vote_create / ballot_cast / vote_close
 *   uteamup_association_notices_list / notice_post / notice_delete
 *
 * The tenant comes from the Bearer token, so none of these tools take a tenant argument.
 * Reads and casting a ballot need Tenant.View; everything else Tenant.Update.
 */

'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamUP Home housing association MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_association';
  const MEETING_GUID = '32000000-0000-0000-0000-000000000001';
  const VOTE_GUID = '32000000-0000-0000-0000-000000000002';
  const NOTICE_GUID = '32000000-0000-0000-0000-000000000003';
  const DOCUMENT_GUID = '32000000-0000-0000-0000-000000000004';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (name, args, reply) => callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, reply);
  const callExact = (name, args, reply) => callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, reply, args);
  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  // ModelContextProtocol returns a backend exception as a tool result with isError set.
  const toolError = (name, text) => ({
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `An error occurred invoking '${name}': ${text}` }],
        isError: true,
      },
      id: 1,
    },
  });

  const meeting = {
    guid: MEETING_GUID,
    title: 'Aðalfundur 2026',
    kind: 'general',
    heldOn: '2026-11-05T18:00:00Z',
    location: 'Sameignin',
    minutesText: 'Samþykkt að mála stigaganginn.',
  };

  const vote = {
    guid: VOTE_GUID,
    title: 'Mála stigaganginn?',
    isOpen: true,
    yesCount: 3,
    noCount: 1,
    abstainCount: 0,
    myChoice: null,
  };

  describe('meetings', () => {
    test('list returns meetings with their minutes', async () => {
      const response = await call('uteamup_association_meetings_list', {}, successReply([meeting]));

      expect(response.status).toBe(200);
      expect(resultOf(response)).toEqual([meeting]);
    });

    test('list of an association without meetings is empty', async () => {
      const response = await call('uteamup_association_meetings_list', {}, successReply([]));

      expect(resultOf(response)).toEqual([]);
    });

    test('get takes only the meeting GUID', async () => {
      const response = await callExact('uteamup_association_meeting_get', { meetingGuid: MEETING_GUID },
        successReply(meeting));

      expect(resultOf(response).guid).toBe(MEETING_GUID);
    });

    test('get of an unknown meeting comes back null', async () => {
      const response = await call('uteamup_association_meeting_get', { meetingGuid: MEETING_GUID }, successReply(null));

      expect(resultOf(response)).toBeNull();
    });

    test('create forwards the meeting body verbatim', async () => {
      const args = {
        body: { title: 'Stjórnarfundur', kind: 'board', heldOn: '2026-11-12T17:00:00Z', location: 'Íbúð 101' },
      };

      const response = await callExact('uteamup_association_meeting_create', args,
        successReply({ guid: MEETING_GUID, ...args.body, minutesText: null }));

      expect(resultOf(response)).toMatchObject({ guid: MEETING_GUID, kind: 'board' });
    });

    test('update forwards the meeting GUID and the replaced body', async () => {
      const args = {
        meetingGuid: MEETING_GUID,
        body: { title: 'Aðalfundur 2026', kind: 'general', heldOn: '2026-11-05T18:00:00Z', minutesText: 'Fundargerð.' },
      };

      const response = await callExact('uteamup_association_meeting_update', args,
        successReply({ guid: MEETING_GUID, ...args.body }));

      expect(resultOf(response).minutesText).toBe('Fundargerð.');
    });

    test('create forwards the minutes document GUID', async () => {
      const args = {
        body: { title: 'Aðalfundur 2026', kind: 'general', heldOn: '2026-11-05T18:00:00Z', minutesDocumentGuid: DOCUMENT_GUID },
      };

      const response = await callExact('uteamup_association_meeting_create', args,
        successReply({ guid: MEETING_GUID, ...args.body }));

      expect(resultOf(response).minutesDocumentGuid).toBe(DOCUMENT_GUID);
    });

    test('a minutes document from another tenant is refused by the backend', async () => {
      const name = 'uteamup_association_meeting_update';
      const response = await call(name,
        { meetingGuid: MEETING_GUID, body: { title: 'Fundur', kind: 'board', heldOn: '2026-11-12T17:00:00Z', minutesDocumentGuid: DOCUMENT_GUID } },
        toolError(name, 'association.meeting.documentNotFound: the minutes document was not found.'));

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('association.meeting.documentNotFound');
    });

    test('delete returns false when the meeting is not found', async () => {
      const response = await callExact('uteamup_association_meeting_delete', { meetingGuid: MEETING_GUID },
        successReply(false));

      expect(resultOf(response)).toBe(false);
    });
  });

  describe('votes', () => {
    test('list shows counts, open state and the caller answer', async () => {
      const response = await call('uteamup_association_votes_list', {}, successReply([vote]));

      expect(resultOf(response)[0]).toMatchObject({ yesCount: 3, noCount: 1, isOpen: true, myChoice: null });
    });

    test('create forwards title, description and closesAt', async () => {
      const args = {
        body: { title: 'Mála stigaganginn?', description: 'Tilboð frá málara.', closesAt: '2026-11-30T23:59:00Z' },
      };

      const response = await callExact('uteamup_association_vote_create', args, successReply({ ...vote, ...args.body }));

      expect(resultOf(response).closesAt).toBe('2026-11-30T23:59:00Z');
    });

    test('ballot cast forwards the vote GUID and the choice', async () => {
      const args = { voteGuid: VOTE_GUID, body: { choice: 'yes' } };

      const response = await callExact('uteamup_association_ballot_cast', args,
        successReply({ ...vote, yesCount: 4, myChoice: 'yes' }));

      expect(resultOf(response)).toMatchObject({ yesCount: 4, myChoice: 'yes' });
    });

    test('a member can change the answer while the vote is open', async () => {
      const args = { voteGuid: VOTE_GUID, body: { choice: 'abstain' } };

      const response = await callExact('uteamup_association_ballot_cast', args,
        successReply({ ...vote, abstainCount: 1, myChoice: 'abstain' }));

      expect(resultOf(response).myChoice).toBe('abstain');
    });

    test('close takes only the vote GUID', async () => {
      const response = await callExact('uteamup_association_vote_close', { voteGuid: VOTE_GUID },
        successReply({ ...vote, isOpen: false }));

      expect(resultOf(response).isOpen).toBe(false);
    });

    test('an invalid ballot choice is refused by the backend', async () => {
      const name = 'uteamup_association_ballot_cast';
      const response = await call(name, { voteGuid: VOTE_GUID, body: { choice: 'maybe' } },
        toolError(name, 'association.vote.invalidChoice: answer Yes, No or Abstain.'));

      expect(response.body.error).toBeUndefined();
      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('association.vote.invalidChoice');
    });

    test('a ballot on a closed vote is refused by the backend', async () => {
      const name = 'uteamup_association_ballot_cast';
      const response = await call(name, { voteGuid: VOTE_GUID, body: { choice: 'no' } },
        toolError(name, 'association.vote.closed: this vote is closed.'));

      expect(response.body.result.content[0].text).toContain('association.vote.closed');
    });

    test('a resident creating a vote gets permission denied', async () => {
      const response = await call('uteamup_association_vote_create', { body: { title: 'Nýr bílskúr?' } },
        errorReply(-32000, 'Permission denied: Tenant.Update required'));

      expect(response.body.error.message).toMatch(/Permission denied/i);
      expect(response.body.error.message).toContain('Tenant.Update');
    });
  });

  describe('notices', () => {
    test('list returns the board notices', async () => {
      const notices = [{ guid: NOTICE_GUID, title: 'Vatnslaust á morgun', body: 'Frá 9 til 12.' }];

      const response = await call('uteamup_association_notices_list', {}, successReply(notices));

      expect(resultOf(response)).toEqual(notices);
    });

    test('post forwards title and body', async () => {
      const args = { body: { title: 'Vatnslaust á morgun', body: 'Frá 9 til 12.' } };

      const response = await callExact('uteamup_association_notice_post', args,
        successReply({ guid: NOTICE_GUID, ...args.body }));

      expect(resultOf(response).guid).toBe(NOTICE_GUID);
    });

    test('delete takes only the notice GUID', async () => {
      const response = await callExact('uteamup_association_notice_delete', { noticeGuid: NOTICE_GUID },
        successReply(true));

      expect(resultOf(response)).toBe(true);
    });
  });

  test('a tenant that is not a housing association gets not found', async () => {
    const name = 'uteamup_association_meetings_list';
    const response = await call(name, {},
      toolError(name, 'association.notAssociation: only a housing association has meetings, votes and notices.'));

    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('association.notAssociation');
  });

  const tools = [
    { name: 'uteamup_association_meetings_list', args: {} },
    { name: 'uteamup_association_meeting_get', args: { meetingGuid: MEETING_GUID } },
    { name: 'uteamup_association_meeting_create', args: { body: { title: 'Fundur', kind: 'board', heldOn: '2026-11-12T17:00:00Z' } } },
    { name: 'uteamup_association_meeting_update', args: { meetingGuid: MEETING_GUID, body: { title: 'Fundur', kind: 'board', heldOn: '2026-11-12T17:00:00Z' } } },
    { name: 'uteamup_association_meeting_delete', args: { meetingGuid: MEETING_GUID } },
    { name: 'uteamup_association_votes_list', args: {} },
    { name: 'uteamup_association_vote_create', args: { body: { title: 'Spurning' } } },
    { name: 'uteamup_association_ballot_cast', args: { voteGuid: VOTE_GUID, body: { choice: 'yes' } } },
    { name: 'uteamup_association_vote_close', args: { voteGuid: VOTE_GUID } },
    { name: 'uteamup_association_notices_list', args: {} },
    { name: 'uteamup_association_notice_post', args: { body: { title: 'Tilkynning', body: 'Texti' } } },
    { name: 'uteamup_association_notice_delete', args: { noticeGuid: NOTICE_GUID } },
  ];

  test('regression guard: no association tool takes a tenant or user argument', () => {
    for (const { args } of tools) {
      for (const forbidden of ['tenantGuid', 'tenantId', 'userGuid', 'userId']) {
        expect(Object.keys(args)).not.toContain(forbidden);
      }
    }
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
