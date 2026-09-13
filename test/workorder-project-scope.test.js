"use strict";

const nock = require("nock");
const { callMcpTool, successReply, errorReply } = require("./helpers/mcp-test-helpers");

describe("Workorder owning project scope", () => {
  const base = "https://api.test.com";
  const workorderGuid = "11111111-1111-4111-8111-111111111111";
  const projectGuid = "22222222-2222-4222-8222-222222222222";
  const empty = "00000000-0000-0000-0000-000000000000";
  const model = {
    requestGuid: "33333333-3333-4333-8333-333333333333",
    expectedUpdatedAt: "2026-09-13T04:30:00.123456Z",
    expectedProjectGuid: projectGuid,
    expectedProjectStageGuid: empty,
    expectedProjectOutputItemGuid: empty,
    projectOutputItemGuid: "44444444-4444-4444-8444-444444444444",
  };
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test("preserves exact expected scope assertions and original replay receipt", async () => {
    const scope = { workorderGuid, workorderName: "Build", projectGuid, projectName: "Equipment",
      projectOutputItemGuid: model.projectOutputItemGuid, updatedAt: "2026-09-13T04:31:00Z", status: 0, startedAt: null };
    const receipt = { requestGuid: model.requestGuid, isReplay: true, scope,
      previousScope: { ...scope, projectOutputItemGuid: null } };
    const response = await callMcpTool(base, "test_token", "UteamupWorkorderProjectScopeUpdate",
      { workorderGuid, model }, successReply(receipt), { workorderGuid, model });
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
  });

  test("reads current scope separately without financial fields", async () => {
    const current = { workorderGuid, workorderName: "Current work", projectGuid, updatedAt: "2026-09-13T05:00:00Z" };
    const response = await callMcpTool(base, "test_token", "UteamupWorkorderProjectScopeGet",
      { workorderGuid }, successReply(current));
    const body = JSON.parse(response.body.result.content[0].text);
    expect(body).toEqual(current);
    expect(body).not.toHaveProperty("estimatedCost");
  });

  test("preserves stale-review failure without retrying a different body", async () => {
    const response = await callMcpTool(base, "test_token", "UteamupWorkorderProjectScopeUpdate",
      { workorderGuid, model }, errorReply(-32000, "The work-order scope changed."));
    expect(response.body.error.message).toContain("scope changed");
  });
});
