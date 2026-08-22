/**
 * Construction module MCP tool tests.
 *
 * Tools under test — GUID-first (every boundary identifier is a GUID; there are
 * no int-id params anywhere on this surface):
 *   UteamupConstructionIssueList(projectGuid?, status?, mode?, priority?, ballInCourtUserGuid?, search?, page?, pageSize?)  [ConstructionIssue.View]
 *   UteamupConstructionIssueGet(issueGuid)                        [ConstructionIssue.View]
 *   UteamupConstructionIssueCreate(model)                         [ConstructionIssue.Create]
 *   UteamupConstructionIssueUpdateStatus(issueGuid, model)        [ConstructionIssue.Update]
 *   UteamupRfiList(projectGuid?, status?, discipline?, ...)       [Rfi.View]
 *   UteamupRfiGet(rfiGuid)                                        [Rfi.View]
 *   UteamupRfiRespond(rfiGuid, model)                             [Rfi.Respond]
 *   UteamupSubmittalList(projectGuid?, status?, reviewStatus?, ...) [Submittal.View]
 *   UteamupSubmittalGet(submittalGuid)                            [Submittal.View]
 *   UteamupSubmittalReview(submittalGuid, model)                  [Submittal.Review]
 *   UteamupDailylogList(projectGuid?, from?, to?, status?, ...)   [DailyLog.View]
 *   UteamupDailylogGet(dailyLogGuid)                              [DailyLog.View]
 *   UteamupDailylogCreate(model)  — idempotent get-or-create      [DailyLog.Create]
 *   UteamupConstructionSheetList(projectGuid?, discipline?, ...)  [Document.View]
 *
 * Pattern mirrors bank-transfer-tools.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Construction MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_construction';

  const PROJECT_GUID = '11111111-aaaa-4aaa-8aaa-111111111111';
  const ISSUE_GUID = '22222222-bbbb-4bbb-8bbb-222222222222';
  const RFI_GUID = '33333333-cccc-4ccc-8ccc-333333333333';
  const SUBMITTAL_GUID = '44444444-dddd-4ddd-8ddd-444444444444';
  const DAILYLOG_GUID = '55555555-eeee-4eee-8eee-555555555555';
  const SHEET_GUID = '66666666-ffff-4fff-8fff-666666666666';
  const USER_GUID = '77777777-aaaa-4aaa-8aaa-777777777777';
  const DOCUMENT_GUID = '88888888-bbbb-4bbb-8bbb-888888888888';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  describe('Construction issues — happy path', () => {
    test('UteamupConstructionIssueList — paginated GUID-first register', async () => {
      const response = await call(
        'UteamupConstructionIssueList',
        { projectGuid: PROJECT_GUID, status: 'Open', page: 1, pageSize: 25 },
        successReply({
          data: [{ guid: ISSUE_GUID, projectGuid: PROJECT_GUID, number: 'ISS-0001', title: 'Cracked slab at grid B3', status: 'Open' }],
          totalRecords: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1
        })
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data[0].guid).toBe(ISSUE_GUID);
      expect(result.data[0]).not.toHaveProperty('id');
    });

    test('UteamupConstructionIssueGet — guid-keyed lookup', async () => {
      const response = await call(
        'UteamupConstructionIssueGet',
        { issueGuid: ISSUE_GUID },
        successReply({ guid: ISSUE_GUID, number: 'ISS-0001', title: 'Cracked slab at grid B3', status: 'Open', ballInCourtUserGuid: USER_GUID })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupConstructionIssueCreate — forwards the GUID-only payload verbatim', async () => {
      const args = {
        model: {
          projectGuid: PROJECT_GUID,
          title: 'Damaged fire door DR-104',
          mode: 'PunchItem',
          type: 'Quality',
          priority: 'High',
          assigneeUserGuid: USER_GUID,
          documentGuids: [DOCUMENT_GUID]
        }
      };
      const response = await call(
        'UteamupConstructionIssueCreate',
        args,
        successReply({ guid: ISSUE_GUID, projectGuid: PROJECT_GUID, number: 'ISS-0002', status: 'Draft' }),
        args // argument round-trip: the proxy must forward exactly these args
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupConstructionIssueUpdateStatus — guid-keyed transition', async () => {
      const response = await call(
        'UteamupConstructionIssueUpdateStatus',
        { issueGuid: ISSUE_GUID, model: { status: 'ReadyForReview', comment: 'Rework complete.' } },
        successReply({ guid: ISSUE_GUID, status: 'ReadyForReview' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupConstructionIssueCreate — ConstructionIssue.Create denial round-trips', async () => {
      const response = await call(
        'UteamupConstructionIssueCreate',
        { model: { projectGuid: PROJECT_GUID, title: 'No permission' } },
        errorReply(-32000, 'Permission denied: ConstructionIssue.Create required.')
      );
      expect(response.body.error.message).toMatch(/ConstructionIssue\.Create/);
    });
  });

  describe('RFIs — happy path', () => {
    test('UteamupRfiList — paginated GUID-first register', async () => {
      const response = await call(
        'UteamupRfiList',
        { projectGuid: PROJECT_GUID, status: 'Submitted', page: 1, pageSize: 25 },
        successReply({
          data: [{ guid: RFI_GUID, projectGuid: PROJECT_GUID, number: 'RFI-0007', subject: 'Handrail termination detail', status: 'Submitted' }],
          totalRecords: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1
        })
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data[0].guid).toBe(RFI_GUID);
      expect(result.data[0]).not.toHaveProperty('id');
    });

    test('UteamupRfiGet — guid-keyed lookup', async () => {
      const response = await call(
        'UteamupRfiGet',
        { rfiGuid: RFI_GUID },
        successReply({ guid: RFI_GUID, number: 'RFI-0007', subject: 'Handrail termination detail', question: 'Which detail governs?' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupRfiRespond — records the official response', async () => {
      const args = {
        rfiGuid: RFI_GUID,
        model: { officialResponse: 'Use detail 5/A-501 as issued.', documentGuids: [DOCUMENT_GUID] }
      };
      const response = await call(
        'UteamupRfiRespond',
        args,
        successReply({ guid: RFI_GUID, status: 'Answered', officialResponse: 'Use detail 5/A-501 as issued.' }),
        args
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Answered');
    });
  });

  describe('Submittals — happy path', () => {
    test('UteamupSubmittalList — paginated GUID-first register', async () => {
      const response = await call(
        'UteamupSubmittalList',
        { projectGuid: PROJECT_GUID, status: 'InReview', overdueOnly: true, page: 1, pageSize: 25 },
        successReply({
          data: [{ guid: SUBMITTAL_GUID, projectGuid: PROJECT_GUID, number: 'SUB-0003', displayNumber: 'SUB-0003-R0', title: 'Curtain wall shop drawings', status: 'InReview' }],
          totalRecords: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1
        })
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data[0].guid).toBe(SUBMITTAL_GUID);
      expect(result.data[0]).not.toHaveProperty('id');
    });

    test('UteamupSubmittalGet — guid-keyed lookup', async () => {
      const response = await call(
        'UteamupSubmittalGet',
        { submittalGuid: SUBMITTAL_GUID },
        successReply({ guid: SUBMITTAL_GUID, number: 'SUB-0003', title: 'Curtain wall shop drawings', status: 'InReview' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSubmittalReview — records the review outcome', async () => {
      const args = {
        submittalGuid: SUBMITTAL_GUID,
        model: { reviewStatus: 'ApprovedAsNoted', comment: 'Confirm anchor spacing on sheet 2.', markupDocumentGuids: [DOCUMENT_GUID] }
      };
      const response = await call(
        'UteamupSubmittalReview',
        args,
        successReply({ guid: SUBMITTAL_GUID, status: 'Closed', reviewStatus: 'ApprovedAsNoted' }),
        args
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.reviewStatus).toBe('ApprovedAsNoted');
    });
  });

  describe('Daily logs — happy path', () => {
    test('UteamupDailylogList — paginated GUID-first list', async () => {
      const response = await call(
        'UteamupDailylogList',
        { projectGuid: PROJECT_GUID, from: '2026-08-15', to: '2026-08-21', page: 1, pageSize: 25 },
        successReply({
          data: [{ guid: DAILYLOG_GUID, projectGuid: PROJECT_GUID, logDate: '2026-08-21T00:00:00Z', status: 'Draft' }],
          totalRecords: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1
        })
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data[0].guid).toBe(DAILYLOG_GUID);
      expect(result.data[0]).not.toHaveProperty('id');
    });

    test('UteamupDailylogGet — guid-keyed lookup', async () => {
      const response = await call(
        'UteamupDailylogGet',
        { dailyLogGuid: DAILYLOG_GUID },
        successReply({ guid: DAILYLOG_GUID, projectGuid: PROJECT_GUID, logDate: '2026-08-21T00:00:00Z', status: 'Draft' })
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupDailylogCreate — idempotent get-or-create for a project + day', async () => {
      const args = {
        model: { projectGuid: PROJECT_GUID, logDate: '2026-08-21' }
      };
      const response = await call(
        'UteamupDailylogCreate',
        args,
        successReply({ guid: DAILYLOG_GUID, projectGuid: PROJECT_GUID, logDate: '2026-08-21T00:00:00Z', status: 'Draft' }),
        args
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.guid).toBe(DAILYLOG_GUID);
    });
  });

  describe('Sheet register — happy path', () => {
    test('UteamupConstructionSheetList — paginated GUID-first register', async () => {
      const response = await call(
        'UteamupConstructionSheetList',
        { projectGuid: PROJECT_GUID, discipline: 'Structural', status: 'Current', page: 1, pageSize: 25 },
        successReply({
          data: [{ guid: SHEET_GUID, projectGuid: PROJECT_GUID, documentGuid: DOCUMENT_GUID, sheetNumber: 'S-201', status: 'Current' }],
          totalRecords: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1
        })
      );
      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data[0].guid).toBe(SHEET_GUID);
      expect(result.data[0].documentGuid).toBe(DOCUMENT_GUID);
      expect(result.data[0]).not.toHaveProperty('id');
    });
  });

  describe('Empty results', () => {
    test('UteamupConstructionIssueList — zero-item register surfaces as empty data', async () => {
      const response = await call(
        'UteamupConstructionIssueList',
        { projectGuid: PROJECT_GUID },
        successReply({ data: [], totalRecords: 0, page: 1, pageSize: 25, totalPages: 0 })
      );
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.data).toEqual([]);
      expect(result.totalRecords).toBe(0);
    });

    test('UteamupRfiGet — unknown GUID surfaces as null result, not a crash', async () => {
      const response = await call(
        'UteamupRfiGet',
        { rfiGuid: '99999999-9999-4999-8999-999999999999' },
        successReply(null)
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
    });
  });

  // Identity comes from the Bearer token — none of these tools accept a
  // userId/tenantId argument, and adding one would silently invite spoofing.
  const complianceTools = [
    { name: 'UteamupConstructionIssueList', args: { projectGuid: PROJECT_GUID, page: 1, pageSize: 25 } },
    { name: 'UteamupConstructionIssueGet', args: { issueGuid: ISSUE_GUID } },
    { name: 'UteamupConstructionIssueCreate', args: { model: { projectGuid: PROJECT_GUID, title: 'Compliance issue' } } },
    { name: 'UteamupConstructionIssueUpdateStatus', args: { issueGuid: ISSUE_GUID, model: { status: 'Closed' } } },
    { name: 'UteamupRfiList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupRfiGet', args: { rfiGuid: RFI_GUID } },
    { name: 'UteamupRfiRespond', args: { rfiGuid: RFI_GUID, model: { officialResponse: 'Answered.' } } },
    { name: 'UteamupSubmittalList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupSubmittalGet', args: { submittalGuid: SUBMITTAL_GUID } },
    { name: 'UteamupSubmittalReview', args: { submittalGuid: SUBMITTAL_GUID, model: { reviewStatus: 'Approved' } } },
    { name: 'UteamupDailylogList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupDailylogGet', args: { dailyLogGuid: DAILYLOG_GUID } },
    { name: 'UteamupDailylogCreate', args: { model: { projectGuid: PROJECT_GUID, logDate: '2026-08-21' } } },
    { name: 'UteamupConstructionSheetList', args: { projectGuid: PROJECT_GUID } }
  ];

  test('no construction tool argument carries a userId or tenantId (spoofing guard)', () => {
    for (const tool of complianceTools) {
      expect(Object.keys(tool.args)).not.toContain('userId');
      expect(Object.keys(tool.args)).not.toContain('tenantId');
      expect(Object.keys(tool.args)).not.toContain('tenantGuid');
    }
  });

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
