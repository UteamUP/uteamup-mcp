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

describe("Work permit approver MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_work_permit_approvers";

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

  const workPermitGuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const contactGuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const userGuid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const listArgs = { workPermitGuid };
  const assignArgs = {
    workPermitGuid,
    step: "supervisor",
    kind: "contact",
    contactGuid,
  };
  const stepArgs = { workPermitGuid, step: "supervisor" };

  const contactStep = {
    guid: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    step: "supervisor",
    kind: "contact",
    displayName: "Eva External",
    contactEmail: "eva@contractor.example",
    isCurrent: true,
    externalStatus: "sent",
    emailSentAt: "2026-10-05T08:00:00Z",
  };

  describe("UteamupWorkPermitApproversList tool", () => {
    test("returns each step with its approver and email state", async () => {
      const response = await call(
        "UteamupWorkPermitApproversList",
        listArgs,
        successReply([
          contactStep,
          {
            guid: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            step: "safetyOfficer",
            kind: "user",
            displayName: "Sigga Supervisor",
            userGuid,
            isCurrent: false,
            externalStatus: null,
          },
        ]),
        listArgs,
      );

      expect(response.status).toBe(200);
      const data = parse(response);
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual(
        expect.objectContaining({ kind: "contact", externalStatus: "sent" }),
      );
      expect(data[1].userGuid).toBe(userGuid);
      expect(data[1]).not.toHaveProperty("id");
    });

    test("surfaces a missing permit as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitApproversList",
        listArgs,
        errorReply(-32602, "Work permit not found."),
      );
      expect(response.body.error.message).toBe("Work permit not found.");
      expect(response.body.result).toBeUndefined();
    });
  });

  describe("UteamupWorkPermitApproverAssign tool", () => {
    test("names a contact and returns the updated steps", async () => {
      const response = await call(
        "UteamupWorkPermitApproverAssign",
        assignArgs,
        successReply([contactStep]),
        assignArgs,
      );
      expect(parse(response)[0].displayName).toBe("Eva External");
    });

    test.each([
      [
        "a member who cannot approve",
        "This person cannot approve work permits.",
      ],
      ["a contact without email", "The contact has no email address."],
      ["a decided step", "The Supervisor step is already decided."],
    ])("surfaces %s as a JSON-RPC error", async (_case, message) => {
      const response = await call(
        "UteamupWorkPermitApproverAssign",
        assignArgs,
        errorReply(-32602, message),
      );
      expect(response.body.error.message).toBe(message);
    });
  });

  describe("UteamupWorkPermitApproverClear tool", () => {
    test("returns the remaining steps", async () => {
      const response = await call(
        "UteamupWorkPermitApproverClear",
        stepArgs,
        successReply([]),
        stepArgs,
      );
      expect(parse(response)).toEqual([]);
    });
  });

  describe("UteamupWorkPermitApproverResend tool", () => {
    test("returns the step with its fresh email state", async () => {
      const response = await call(
        "UteamupWorkPermitApproverResend",
        stepArgs,
        successReply([{ ...contactStep, emailSentAt: "2026-10-05T09:00:00Z" }]),
        stepArgs,
      );
      expect(parse(response)[0].emailSentAt).toBe("2026-10-05T09:00:00Z");
    });

    test("surfaces a step that is not waiting as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitApproverResend",
        stepArgs,
        errorReply(
          -32602,
          "Only the step the permit is waiting on can be sent.",
        ),
      );
      expect(response.body.error.code).toBe(-32602);
    });
  });

  const tools = [
    { name: "UteamupWorkPermitApproversList", args: listArgs },
    { name: "UteamupWorkPermitApproverAssign", args: assignArgs },
    { name: "UteamupWorkPermitApproverClear", args: stepArgs },
    { name: "UteamupWorkPermitApproverResend", args: stepArgs },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
