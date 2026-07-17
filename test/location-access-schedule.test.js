"use strict";

const nock = require("nock");
const { callMcpTool, successReply } = require("./helpers/mcp-test-helpers");
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require("./helpers/mcp-error-tests");

describe("location access schedule MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_location_access";
  const locationGuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const scheduleGuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const idempotencyKey = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const expectedUpdatedAtUtc = "2026-07-17T10:00:00Z";
  const mutation = {
    idempotencyKey,
    name: "Weekday reception",
    description: "Check in at reception",
    daysOfWeekMask: 62,
    accessStartLocal: "08:00",
    accessEndLocal: "17:00",
    isAllDay: false,
    effectiveFromDate: "2026-07-01T00:00:00Z",
    effectiveToDate: null,
    timeZoneId: "Atlantic/Reykjavik",
    isActive: true,
  };
  const response = {
    scheduleGuid,
    locationGuid,
    locationName: "North plant",
    ...mutation,
    createdAtUtc: "2026-07-16T10:00:00Z",
    updatedAtUtc: expectedUpdatedAtUtc,
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const result = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );
    expect(result.status).toBe(200);
    return JSON.parse(result.body.result.content[0].text);
  }

  it.each([
    ["UteamupLocationAccessScheduleList", { locationGuid }, [response]],
    ["UteamupLocationAccessScheduleGet", { scheduleGuid }, response],
    [
      "UteamupLocationAccessScheduleCreate",
      { locationGuid, ...mutation },
      response,
    ],
    [
      "UteamupLocationAccessScheduleUpdate",
      { scheduleGuid, expectedUpdatedAtUtc, ...mutation },
      response,
    ],
    [
      "UteamupLocationAccessScheduleDelete",
      { scheduleGuid, idempotencyKey, expectedUpdatedAtUtc },
      true,
    ],
  ])("%s preserves GUID-only access evidence", async (toolName, args, data) => {
    expect(await call(toolName, args, data)).toEqual(data);
    expect(JSON.stringify(args)).not.toMatch(
      /"(?:locationId|scheduleId|tenantId|userId)"/,
    );
  });

  it("preserves an empty access schedule list", async () => {
    expect(
      await call("UteamupLocationAccessScheduleList", { locationGuid }, []),
    ).toEqual([]);
  });

  const errorTools = [
    { name: "UteamupLocationAccessScheduleList", args: { locationGuid } },
    { name: "UteamupLocationAccessScheduleGet", args: { scheduleGuid } },
    {
      name: "UteamupLocationAccessScheduleCreate",
      args: { locationGuid, ...mutation },
    },
    {
      name: "UteamupLocationAccessScheduleUpdate",
      args: { scheduleGuid, expectedUpdatedAtUtc, ...mutation },
    },
    {
      name: "UteamupLocationAccessScheduleDelete",
      args: { scheduleGuid, idempotencyKey, expectedUpdatedAtUtc },
    },
  ];
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
