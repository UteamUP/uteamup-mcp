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

describe("Work permit link and prerequisite MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_work_permit_links";

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
  const prerequisiteGuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const targetGuid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const linkGuid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  const listArgs = { workPermitGuid };
  const addArgs = { workPermitGuid, linkType: "Chemical", targetGuid };
  const removeArgs = { linkGuid };
  const linkedToArgs = { linkType: "asset", targetGuid };
  const prerequisiteArgs = { workPermitGuid, prerequisiteGuid };

  describe("UteamupWorkPermitLinksList tool", () => {
    test("returns every link with its availability", async () => {
      const response = await call(
        "UteamupWorkPermitLinksList",
        listArgs,
        successReply([
          {
            guid: linkGuid,
            linkType: "Chemical",
            targetGuid,
            displayName: "Sodium hypochlorite 12%",
            isAvailable: true,
            linkedAt: "2026-10-01T08:00:00Z",
          },
          {
            guid: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            linkType: "Asset",
            targetGuid: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            displayName: null,
            isAvailable: false,
            linkedAt: "2026-10-02T08:00:00Z",
          },
        ]),
        listArgs,
      );

      expect(response.status).toBe(200);
      const data = parse(response);
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual(
        expect.objectContaining({
          guid: linkGuid,
          linkType: "Chemical",
          targetGuid,
          isAvailable: true,
        }),
      );
      expect(data[1].isAvailable).toBe(false);
      expect(data[1]).not.toHaveProperty("id");
    });

    test("returns an empty list for a permit without links", async () => {
      const response = await call(
        "UteamupWorkPermitLinksList",
        listArgs,
        successReply([]),
        listArgs,
      );
      expect(parse(response)).toEqual([]);
    });

    test("surfaces a not-found permit as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitLinksList",
        listArgs,
        errorReply(-32602, "Work permit not found"),
      );
      expect(response.body.error).toEqual({
        code: -32602,
        message: "Work permit not found",
      });
      expect(response.body.result).toBeUndefined();
    });
  });

  describe("UteamupWorkPermitLinkAdd tool", () => {
    test.each([
      "WorkOrder",
      "Asset",
      "Chemical",
      "KnowledgeArticle",
      "Tool",
      "Certificate",
    ])("forwards link type %s verbatim", async (linkType) => {
      const args = { workPermitGuid, linkType, targetGuid };
      const response = await call(
        "UteamupWorkPermitLinkAdd",
        args,
        successReply({
          guid: linkGuid,
          linkType,
          targetGuid,
          isAvailable: true,
        }),
        args,
      );
      expect(parse(response)).toEqual(
        expect.objectContaining({ guid: linkGuid, linkType, targetGuid }),
      );
    });

    test("surfaces a rejected link type as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitLinkAdd",
        { workPermitGuid, linkType: "Vendor", targetGuid },
        errorReply(-32602, "Unsupported link type"),
      );
      expect(response.body.error.code).toBe(-32602);
    });

    test("surfaces a duplicate link as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitLinkAdd",
        addArgs,
        errorReply(-32603, "Already linked"),
      );
      expect(response.body.error.message).toBe("Already linked");
    });

    test("takes no user or tenant identifier", async () => {
      const response = await call(
        "UteamupWorkPermitLinkAdd",
        addArgs,
        successReply({ guid: linkGuid }),
        addArgs,
      );
      expect(response.status).toBe(200);
      for (const key of [
        "userId",
        "userGuid",
        "tenantId",
        "tenantGuid",
        "workPermitId",
      ]) {
        expect(addArgs).not.toHaveProperty(key);
      }
    });
  });

  describe("UteamupWorkPermitLinkRemove tool", () => {
    test("removes a link by its GUID", async () => {
      const response = await call(
        "UteamupWorkPermitLinkRemove",
        removeArgs,
        successReply({ removed: true }),
        removeArgs,
      );
      expect(parse(response)).toEqual({ removed: true });
    });

    test("surfaces an unknown link as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitLinkRemove",
        removeArgs,
        errorReply(-32602, "Link not found"),
      );
      expect(response.body.error.message).toBe("Link not found");
    });
  });

  describe("UteamupWorkPermitsLinkedTo tool", () => {
    test("returns the permits linked to a record", async () => {
      const response = await call(
        "UteamupWorkPermitsLinkedTo",
        linkedToArgs,
        successReply([
          {
            guid: workPermitGuid,
            title: "Hot work on pump P-101",
            status: "Approved",
            startDate: "2026-10-05T07:00:00Z",
            endDate: "2026-10-05T15:00:00Z",
          },
        ]),
        linkedToArgs,
      );
      const data = parse(response);
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual(
        expect.objectContaining({ guid: workPermitGuid, status: "Approved" }),
      );
    });

    test.each([
      "workorder",
      "asset",
      "chemical",
      "knowledgearticle",
      "tool",
      "certificate",
    ])("forwards lowercase link type %s verbatim", async (linkType) => {
      const args = { linkType, targetGuid };
      const response = await call(
        "UteamupWorkPermitsLinkedTo",
        args,
        successReply([]),
        args,
      );
      expect(parse(response)).toEqual([]);
    });
  });

  describe("UteamupWorkPermitPrerequisiteAdd tool", () => {
    test("adds a prerequisite permit", async () => {
      const response = await call(
        "UteamupWorkPermitPrerequisiteAdd",
        prerequisiteArgs,
        successReply({ workPermitGuid, prerequisiteGuid }),
        prerequisiteArgs,
      );
      expect(parse(response)).toEqual({ workPermitGuid, prerequisiteGuid });
    });

    test("surfaces a self or circular prerequisite as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitPrerequisiteAdd",
        { workPermitGuid, prerequisiteGuid: workPermitGuid },
        errorReply(-32602, "A work permit cannot be its own prerequisite"),
      );
      expect(response.body.error.code).toBe(-32602);
    });
  });

  describe("UteamupWorkPermitPrerequisiteRemove tool", () => {
    test("removes a prerequisite permit", async () => {
      const response = await call(
        "UteamupWorkPermitPrerequisiteRemove",
        prerequisiteArgs,
        successReply({ removed: true }),
        prerequisiteArgs,
      );
      expect(parse(response)).toEqual({ removed: true });
    });

    test("surfaces a missing prerequisite as a JSON-RPC error", async () => {
      const response = await call(
        "UteamupWorkPermitPrerequisiteRemove",
        prerequisiteArgs,
        errorReply(-32602, "Prerequisite not found"),
      );
      expect(response.body.error.message).toBe("Prerequisite not found");
    });
  });

  const tools = [
    { name: "UteamupWorkPermitLinksList", args: listArgs },
    { name: "UteamupWorkPermitLinkAdd", args: addArgs },
    { name: "UteamupWorkPermitLinkRemove", args: removeArgs },
    { name: "UteamupWorkPermitsLinkedTo", args: linkedToArgs },
    { name: "UteamupWorkPermitPrerequisiteAdd", args: prerequisiteArgs },
    { name: "UteamupWorkPermitPrerequisiteRemove", args: prerequisiteArgs },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
