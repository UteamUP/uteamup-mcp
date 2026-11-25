'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Workforce time and training MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'workforce-time-token';
  const eventGuid = '5b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
  const ruleSetGuid = '6c2a3d4e-5f60-4b7c-8d9e-0f1a2b3c4d5e';
  const expenseGuid = '7d3b4e5f-6071-4c8d-9eaf-1a2b3c4d5e6f';
  const userGuid = '8e4c5f60-7182-4d9e-afb0-2b3c4d5e6f70';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists training events with public GUIDs only', async () => {
    const events = [{ externalGuid: eventGuid, topic: 'Lockout/tagout', status: 'Scheduled' }];
    const response = await call('UteamupTrainingEventList', {}, successReply(events), {});

    const result = parse(response);
    expect(result[0].externalGuid).toBe(eventGuid);
    expect(result[0]).not.toHaveProperty('id');
  });

  test('returns an empty training list', async () => {
    const response = await call('UteamupTrainingEventList', {}, successReply([]), {});

    expect(parse(response)).toEqual([]);
  });

  test("lists the caller's own training without a user argument", async () => {
    const args = {};
    const response = await call(
      'UteamupTrainingEventMine', args,
      successReply([{ trainingEventGuid: eventGuid, workerStatus: 'Enrolled' }]), args,
    );

    expect(parse(response)[0].workerStatus).toBe('Enrolled');
    expect(args).not.toHaveProperty('userId');
    expect(args).not.toHaveProperty('userGuid');
  });

  test('gets a training event by GUID', async () => {
    const args = { eventGuid };
    const response = await call(
      'UteamupTrainingEventGet', args, successReply({ externalGuid: eventGuid, topic: 'First aid' }), args,
    );

    expect(parse(response).topic).toBe('First aid');
  });

  test('creates a training event and forwards the arguments verbatim', async () => {
    const args = { topic: 'Confined space', startDate: '2026-12-01T09:00:00Z', maxParticipants: 12 };
    const response = await call(
      'UteamupTrainingEventCreate', args, successReply({ externalGuid: eventGuid, topic: 'Confined space' }), args,
    );

    expect(parse(response).externalGuid).toBe(eventGuid);
  });

  test('updates a training event with clear flags', async () => {
    const args = { eventGuid, topic: 'Renamed', clearLocation: true };
    const response = await call(
      'UteamupTrainingEventUpdate', args, successReply({ externalGuid: eventGuid, topic: 'Renamed' }), args,
    );

    expect(parse(response).topic).toBe('Renamed');
  });

  test('requests enrollment for the caller only', async () => {
    const args = { eventGuid };
    const response = await call(
      'UteamupTrainingEventRequestEnrollment', args,
      successReply({ trainingEventGuid: eventGuid, status: 'Waitlisted' }), args,
    );

    expect(parse(response).trainingEventGuid).toBe(eventGuid);
    expect(args).not.toHaveProperty('userGuid');
  });

  test('lists enrollments and completions of an event', async () => {
    const enrollments = await call(
      'UteamupTrainingEventEnrollmentList', { eventGuid }, successReply([{ userGuid, status: 'Enrolled' }]), { eventGuid },
    );
    const completions = await call(
      'UteamupTrainingEventCompletionList', { eventGuid }, successReply([{ userGuid, score: 92 }]), { eventGuid },
    );

    expect(parse(enrollments)[0].userGuid).toBe(userGuid);
    expect(parse(completions)[0]).not.toHaveProperty('userId');
  });

  test('rejects an invalid training topic with the backend validation error', async () => {
    const response = await call(
      'UteamupTrainingEventCreate',
      { topic: '', startDate: '2026-12-01T09:00:00Z' },
      errorReply(-32602, 'Topic is required.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('Topic');
  });

  test('preserves not-found errors for events outside the tenant', async () => {
    const response = await call(
      'UteamupTrainingEventGet', { eventGuid }, errorReply(-32602, `Training event with GUID ${eventGuid} not found.`),
    );

    expect(response.body.error.message).toContain('not found');
  });

  test('lists, gets, creates and updates working-time rule sets', async () => {
    const ruleSet = { ruleSetGuid, name: 'Iceland', countryCode: 'IS', isActive: true, rules: [] };
    expect(parse(await call('UteamupWorkingTimeRuleSetList', {}, successReply([ruleSet]), {}))[0].ruleSetGuid)
      .toBe(ruleSetGuid);
    expect(parse(await call('UteamupWorkingTimeRuleSetGet', { ruleSetGuid }, successReply(ruleSet), { ruleSetGuid })).name)
      .toBe('Iceland');

    const createArgs = { name: 'Iceland', countryCode: 'IS' };
    expect(parse(await call('UteamupWorkingTimeRuleSetCreate', createArgs, successReply(ruleSet), createArgs)).countryCode)
      .toBe('IS');

    const updateArgs = { ruleSetGuid, name: 'Iceland 2027', isActive: false };
    const updated = parse(await call(
      'UteamupWorkingTimeRuleSetUpdate', updateArgs, successReply({ ...ruleSet, name: 'Iceland 2027', isActive: false }), updateArgs,
    ));
    expect(updated.isActive).toBe(false);
  });

  test('lists working-time policy assignments', async () => {
    const response = await call(
      'UteamupWorkingTimePolicyAssignmentList', {},
      successReply([{ assignmentGuid: userGuid, ruleSetGuid, scope: 'Tenant' }]), {},
    );

    expect(parse(response)[0].ruleSetGuid).toBe(ruleSetGuid);
  });

  test('pages travel expenses without internal ids', async () => {
    const args = { page: 2, pageSize: 10 };
    const page = { items: [{ expenseGuid, amount: 42.5, reimbursementStatus: 'Pending' }], page: 2, pageSize: 10, totalItems: 11, totalPages: 2 };
    const result = parse(await call('UteamupTravelExpenseList', args, successReply(page), args));

    expect(result.totalItems).toBe(11);
    expect(result.items[0]).not.toHaveProperty('id');
    expect(result.items[0]).not.toHaveProperty('workorderId');
    expect(result.items[0]).not.toHaveProperty('userId');
  });

  test('rejects an oversized travel expense page', async () => {
    const response = await call(
      'UteamupTravelExpenseList', { page: 1, pageSize: 500 }, errorReply(-32602, 'pageSize must be between 1 and 100.'),
    );

    expect(response.body.error.message).toContain('pageSize');
  });

  test('gets a travel expense by GUID', async () => {
    const response = await call(
      'UteamupTravelExpenseGet', { expenseGuid }, successReply({ expenseGuid, expenseType: 'Mileage' }), { expenseGuid },
    );

    expect(parse(response).expenseType).toBe('Mileage');
  });

  test("reads a technician's schedule and current shift by user GUID", async () => {
    const scheduleArgs = { userGuid, startDate: '2026-11-01', endDate: '2026-11-30' };
    const schedule = parse(await call(
      'UteamupTechnicianAvailabilitySchedule', scheduleArgs,
      successReply([{ userGuid, shiftName: 'Day', date: '2026-11-02T00:00:00' }]), scheduleArgs,
    ));
    expect(schedule[0]).not.toHaveProperty('id');

    const current = parse(await call('UteamupTechnicianAvailabilityCurrent', { userGuid }, successReply(null), { userGuid }));
    expect(current).toBeNull();
  });

  test('reports a user outside the tenant as not found', async () => {
    const response = await call(
      'UteamupTechnicianAvailabilityCurrent', { userGuid },
      errorReply(-32602, `User with GUID ${userGuid} is not a member of this tenant.`),
    );

    expect(response.body.error.message).toContain('not a member');
  });

  const tools = [
    { name: 'UteamupTrainingEventList', args: {} },
    { name: 'UteamupTrainingEventMine', args: {} },
    { name: 'UteamupTrainingEventGet', args: { eventGuid } },
    { name: 'UteamupTrainingEventCreate', args: { topic: 'X', startDate: '2026-12-01T09:00:00Z' } },
    { name: 'UteamupTrainingEventUpdate', args: { eventGuid, topic: 'Y' } },
    { name: 'UteamupTrainingEventRequestEnrollment', args: { eventGuid } },
    { name: 'UteamupTrainingEventEnrollmentList', args: { eventGuid } },
    { name: 'UteamupTrainingEventCompletionList', args: { eventGuid } },
    { name: 'UteamupWorkingTimeRuleSetList', args: {} },
    { name: 'UteamupWorkingTimeRuleSetGet', args: { ruleSetGuid } },
    { name: 'UteamupWorkingTimeRuleSetCreate', args: { name: 'IS' } },
    { name: 'UteamupWorkingTimeRuleSetUpdate', args: { ruleSetGuid, name: 'IS' } },
    { name: 'UteamupWorkingTimePolicyAssignmentList', args: {} },
    { name: 'UteamupTravelExpenseList', args: { page: 1, pageSize: 25 } },
    { name: 'UteamupTravelExpenseGet', args: { expenseGuid } },
    { name: 'UteamupTechnicianAvailabilitySchedule', args: { userGuid, startDate: '2026-11-01', endDate: '2026-11-30' } },
    { name: 'UteamupTechnicianAvailabilityCurrent', args: { userGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
