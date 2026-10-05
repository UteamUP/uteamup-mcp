"use strict";

const nock = require("nock");
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require("./helpers/mcp-test-helpers");
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require("./helpers/mcp-error-tests");

describe("Work permit settings MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_work_permit_settings";

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      mockReply,
      expectedArgs,
    );
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  const getArgs = { previewDays: 14 };
  const updateArgs = { autoExpireEnabled: true, autoExpireAfterDays: 10 };

  describe("UteamupWorkPermitSettingsGet tool", () => {
    test("returns the defaults and the preview count", async () => {
      const response = await call(
        "UteamupWorkPermitSettingsGet",
        getArgs,
        successReply({
          autoExpireEnabled: false,
          autoExpireAfterDays: 10,
          updatedAt: null,
          wouldExpireNow: 3,
        }),
        getArgs,
      );

      expect(response.status).toBe(200);
      const data = parse(response);
      expect(data.autoExpireEnabled).toBe(false);
      expect(data.autoExpireAfterDays).toBe(10);
      expect(data.wouldExpireNow).toBe(3);
      expect(data).not.toHaveProperty("tenantId");
    });

    test("works without a preview day count", async () => {
      const response = await call(
        "UteamupWorkPermitSettingsGet",
        {},
        successReply({
          autoExpireEnabled: true,
          autoExpireAfterDays: 30,
          wouldExpireNow: 0,
        }),
        {},
      );
      expect(parse(response).autoExpireAfterDays).toBe(30);
    });

    test("surfaces a missing Tenant.Update permission as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitSettingsGet",
        getArgs,
        errorReply(-32603, "Permission denied: Tenant.Update"),
      );
      expect(response.body.error.message).toBe(
        "Permission denied: Tenant.Update",
      );
      expect(response.body.result).toBeUndefined();
    });
  });

  describe("UteamupWorkPermitSettingsUpdate tool", () => {
    test("turns expiry on and returns the saved settings", async () => {
      const response = await call(
        "UteamupWorkPermitSettingsUpdate",
        updateArgs,
        successReply({
          autoExpireEnabled: true,
          autoExpireAfterDays: 10,
          updatedAt: "2026-10-05T08:00:00Z",
          wouldExpireNow: 2,
        }),
        updateArgs,
      );

      const data = parse(response);
      expect(data.autoExpireEnabled).toBe(true);
      expect(data.updatedAt).toBe("2026-10-05T08:00:00Z");
    });

    test.each([0, 366, -5])(
      "surfaces an out-of-range day count (%p) as a JSON-RPC error",
      async (days) => {
        const args = { autoExpireEnabled: true, autoExpireAfterDays: days };
        const response = await call(
          "UteamupWorkPermitSettingsUpdate",
          args,
          errorReply(-32602, "Days must be between 1 and 365."),
        );
        expect(response.body.error).toEqual({
          code: -32602,
          message: "Days must be between 1 and 365.",
        });
      },
    );
  });

  const tools = [
    { name: "UteamupWorkPermitSettingsGet", args: getArgs },
    { name: "UteamupWorkPermitSettingsUpdate", args: updateArgs },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
