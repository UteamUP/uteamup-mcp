import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import {
  validateConfig,
  assertCompany,
  validateArgs,
  cliCommand,
  runCli,
  localCliEnvironment,
  findMcpTools,
  validateMcpCall,
} from "../src/runtime.js";
import { tools } from "../src/manifest.js";

const config = {
  companyId: "d119aae1-beb9-43a5-a6e4-618cb9856a8c",
  tenantGuid: "9b9f653b-3529-4b64-9d3d-6ea4960edf2d",
  sshHost: "192.168.68.79",
  sshUsername: "gisligudmundsson",
  sshHostKey: "ssh-ed25519 dGVzdA==",
  workingDirectory: "/Users/test/Active Projects",
  cliPath: "/opt/homebrew/bin/uteamup",
  sshKeyRef: {
    type: "secret_ref",
    secretId: "11111111-1111-4111-8111-111111111111",
  },
  mcpCredentialRef: {
    type: "secret_ref",
    secretId: "22222222-2222-4222-8222-222222222222",
  },
};

test("requires encrypted credentials, absolute paths and a pinned host", () => {
  assert.equal(validateConfig(config), config);
  for (const patch of [
    { sshKeyRef: "raw-key" },
    { sshHost: "-oProxyCommand=evil" },
    { cliPath: "uteamup" },
    { sshHostKey: "unknown" },
  ])
    assert.throws(() => validateConfig({ ...config, ...patch }));
});

test("fails closed for a different company or missing company identity", () => {
  assertCompany(config, { companyId: config.companyId });
  assert.throws(() => assertCompany(config, { companyId: "other" }));
  assert.throws(() => assertCompany(config, {}));
});

const localConfig = {
  companyId: config.companyId,
  tenantGuid: config.tenantGuid,
  cliExecutionMode: "local",
  workingDirectory: "/var/lib/paperclip",
  cliPath: "/usr/local/bin/uteamup",
  mcpCredentialRef: config.mcpCredentialRef,
};

test("local CLI needs no SSH connection but still requires a bound MCP secret", () => {
  assert.equal(validateConfig(localConfig), localConfig);
  assert.throws(() =>
    validateConfig({ ...localConfig, cliExecutionMode: "other" }),
  );
  assert.throws(() =>
    validateConfig({ ...localConfig, mcpCredentialRef: "raw" }),
  );
  assert.throws(() => validateConfig({ ...localConfig, cliPath: "uteamup" }));
  assert.throws(() =>
    validateConfig({ ...localConfig, cliExecutionMode: "ssh" }),
  );
});

test("local environment pins production and tenant without inheriting service secrets", () => {
  const env = localCliEnvironment(localConfig, {
    HOME: "/var/lib/paperclip",
    PATH: "/usr/local/bin:/usr/bin:/bin",
    OPENAI_API_KEY: "private-service-value",
    DATABASE_URL: "private-database-value",
    UTEAMUP_API_KEY: "ambient-key",
    UTEAMUP_API_BASE_URL: "https://wrong.invalid",
    UTEAMUP_TENANT_GUID: "wrong-tenant",
  });
  assert.equal(env.HOME, "/var/lib/paperclip");
  assert.equal(env.UTEAMUP_API_BASE_URL, "https://api.uteamup.com");
  assert.equal(env.UTEAMUP_TENANT_GUID, config.tenantGuid);
  for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "UTEAMUP_API_KEY"])
    assert.equal(env[key], undefined);
});

test("local CLI passes literal arguments without a shell or SSH secret reads", async () => {
  const args = ["asset", "search", "a'; $(touch /tmp/unwanted)"];
  const result = await runCli(
    {},
    localConfig,
    args,
    async (file, received, options) => {
      assert.equal(file, localConfig.cliPath);
      assert.deepEqual(received, args);
      assert.equal(options.shell, false);
      assert.equal(options.cwd, localConfig.workingDirectory);
      assert.equal(options.env.UTEAMUP_TENANT_GUID, localConfig.tenantGuid);
      return { stdout: "found", stderr: "" };
    },
  );
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "found");
});

test("local failures retain exit status and forbidden commands never launch", async () => {
  const result = await runCli({}, localConfig, ["version"], async () => {
    throw Object.assign(new Error("internal"), { code: 3, stderr: "denied" });
  });
  assert.equal(result.exitCode, 3);
  assert.equal(result.stderr, "denied");
  let launched = false;
  await assert.rejects(
    runCli({}, localConfig, ["login"], async () => {
      launched = true;
    }),
  );
  assert.equal(launched, false);
});

test("CLI cannot change global authentication, profile or TLS policy", () => {
  for (const args of [
    ["login"],
    ["logout"],
    ["config", "show"],
    ["auth", "token"],
    ["apikey", "create"],
    ["tenant", "select"],
    ["asset", "list", "--profile=dev"],
    ["--insecure"],
    ["asset", "list", "-P", "dev"],
  ])
    assert.throws(() => validateArgs(args));
  assert.deepEqual(validateArgs(["auth", "status"]), ["auth", "status"]);
});

test("rejects empty, oversized and control-character arguments", () => {
  for (const args of [[], ["asset\nlist"], [null], Array(81).fill("x")])
    assert.throws(() => validateArgs(args));
});

test("output flags and tenant aliases cannot hide a configuration command", () => {
  for (const args of [
    ["--output", "json", "apikey", "create"],
    ["-ojson", "login"],
    ["tenants", "select"],
    ["tenant", "--output", "json", "select"],
  ])
    assert.throws(() => validateArgs(args));
  assert.deepEqual(validateArgs(["--help"]), ["--help"]);
  assert.deepEqual(
    validateArgs(["tenant", "get", config.tenantGuid, "--output", "json"]),
    ["tenant", "get", config.tenantGuid, "--output", "json"],
  );
});

test("quotes shell metacharacters and fixes production and tenant without rewriting config", () => {
  const command = cliCommand(config, [
    "asset",
    "search",
    "a'; $(touch /tmp/unwanted)",
  ]);
  assert.ok(
    command.startsWith(
      "cd '/Users/test/Active Projects' && exec env UTEAMUP_API_BASE_URL=https://api.uteamup.com ",
    ),
  );
  assert.ok(
    command.includes("UTEAMUP_TENANT_GUID='" + config.tenantGuid + "'"),
  );
  assert.ok(command.endsWith("'a'\\''; $(touch /tmp/unwanted)'"));
});

test("SSH verifies its host and removes temporary keys after success", async () => {
  let temporaryKey;
  const ctx = {
    secrets: {
      resolve: async (ref, options) => {
        assert.equal(ref, config.sshKeyRef);
        assert.equal(options.companyId, config.companyId);
        return "private-key";
      },
    },
  };
  const result = await runCli(ctx, config, ["version"], async (file, args) => {
    assert.equal(file, "ssh");
    assert.ok(args.includes("StrictHostKeyChecking=yes"));
    temporaryKey = args[args.indexOf("-i") + 1];
    assert.equal((await stat(temporaryKey)).mode & 0o777, 0o600);
    assert.equal(await readFile(temporaryKey, "utf8"), "private-key\n");
    return { stdout: "version", stderr: "" };
  });
  assert.equal(result.exitCode, 0);
  await assert.rejects(stat(temporaryKey), { code: "ENOENT" });
});

test("SSH failures preserve exit status and clean up without returning the key", async () => {
  let temporaryKey;
  const result = await runCli(
    { secrets: { resolve: async () => "private-key" } },
    config,
    ["version"],
    async (file, args) => {
      temporaryKey = args[args.indexOf("-i") + 1];
      throw Object.assign(new Error("private-key"), {
        code: 255,
        stderr: "connection failed",
      });
    },
  );
  assert.equal(result.exitCode, 255);
  assert.ok(!JSON.stringify(result).includes("private-key"));
  await assert.rejects(stat(temporaryKey), { code: "ENOENT" });
});

test("tool search follows pagination and returns discovered schemas with bounded output", async () => {
  const client = {
    listTools: async ({ cursor }) =>
      cursor
        ? {
            tools: [
              {
                name: "uteamup_bug_report_get_conversation",
                inputSchema: { type: "object" },
              },
            ],
          }
        : {
            tools: [
              { name: "uteamup_bug_report_create" },
              { name: "other_tool" },
            ],
            nextCursor: "next",
          },
  };
  const result = await findMcpTools(client, { query: "bug_report", limit: 1 });
  assert.equal(result.matches, 2);
  assert.equal(result.tools[0].name, "uteamup_bug_report_create");
  assert.equal(result.truncated, true);
});

test("only discovered UteamUP calls with argument objects can be dispatched", () => {
  assert.equal(
    validateMcpCall({ name: "uteamup_bug_report_list_mine", arguments: {} })
      .name,
    "uteamup_bug_report_list_mine",
  );
  for (const params of [
    { name: "other", arguments: {} },
    { name: "uteamup_bug_report_create", arguments: [] },
  ])
    assert.throws(() => validateMcpCall(params));
});

test("manifest exposes CLI and MCP discovery/call without ambient write jobs", () => {
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["cli", "mcp_tools", "mcp_call"],
  );
});
