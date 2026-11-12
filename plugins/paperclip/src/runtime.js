import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const MCP_URL = "https://api.uteamup.com/mcp";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const executeFile = promisify(execFile);

export class InputError extends Error {}

export function validateConfig(config) {
  if (!uuid.test(config.companyId) || !uuid.test(config.tenantGuid))
    throw new InputError("Company and tenant must be GUIDs.");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(config.sshHost))
    throw new InputError("Invalid SSH host.");
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(config.sshUsername))
    throw new InputError("Invalid SSH username.");
  if (!/^ssh-ed25519 [A-Za-z0-9+/=]+$/.test(config.sshHostKey))
    throw new InputError("An ed25519 host key is required.");
  for (const field of ["workingDirectory", "cliPath"]) {
    if (
      typeof config[field] !== "string" ||
      !config[field].startsWith("/") ||
      /[\r\n\0]/.test(config[field])
    )
      throw new InputError(
        "Absolute paths without control characters are required.",
      );
  }
  for (const field of ["sshKeyRef", "mcpCredentialRef"]) {
    if (
      config[field]?.type !== "secret_ref" ||
      !uuid.test(config[field]?.secretId)
    )
      throw new InputError("Encrypted secret references are required.");
  }
  return config;
}

export function assertCompany(config, context) {
  if (!context.companyId || context.companyId !== config.companyId)
    throw new InputError(
      "This connection is unavailable to this Paperclip company.",
    );
}

export function validateArgs(args) {
  if (
    !Array.isArray(args) ||
    !args.length ||
    args.length > 80 ||
    args.some(
      (v) => typeof v !== "string" || v.length > 8000 || /[\0\r\n]/.test(v),
    )
  )
    throw new InputError(
      "Provide 1–80 CLI arguments without control characters.",
    );
  if (
    args.some((v) =>
      /^(--profile(?:=|$)|-P|--insecure(?:=|$)|--verbose(?:=|$)|-v$)/.test(v),
    )
  )
    throw new InputError("Profile, verbose and TLS overrides are unavailable.");
  const domain = args[0];
  if (args.length === 1 && ["--help", "-h"].includes(domain)) return args;
  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(domain))
    throw new InputError(
      "Start with a CLI command. Put output flags after the command.",
    );
  const changesTenantSelection =
    ["tenant", "tenants"].includes(domain) &&
    args.some((value) => ["select", "switch"].includes(value));
  if (
    [
      "login",
      "logout",
      "config",
      "completion",
      "apikey",
      "apikeys",
      "api-key",
    ].includes(domain) ||
    (domain === "auth" && args.slice(1).join(" ") !== "status") ||
    changesTenantSelection
  )
    throw new InputError(
      "Global login, credentials and configuration changes are unavailable through this tool.",
    );
  return args;
}

export function quote(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function cliCommand(config, args) {
  validateArgs(args);
  return (
    "cd " +
    quote(config.workingDirectory) +
    " && exec env UTEAMUP_API_BASE_URL=https://api.uteamup.com UTEAMUP_TENANT_GUID=" +
    quote(config.tenantGuid) +
    " " +
    quote(config.cliPath) +
    " " +
    args.map(quote).join(" ")
  );
}

export async function runCli(ctx, config, args, execute = executeFile) {
  const command = cliCommand(config, args);
  const key = await ctx.secrets.resolve(config.sshKeyRef, {
    companyId: config.companyId,
    configPath: "sshKeyRef",
  });
  const directory = await mkdtemp(join(tmpdir(), "paperclip-uteamup-ssh-"));
  try {
    const keyPath = join(directory, "key");
    const hostsPath = join(directory, "known_hosts");
    await writeFile(keyPath, key.endsWith("\n") ? key : key + "\n", {
      mode: 0o600,
    });
    await writeFile(
      hostsPath,
      config.sshHost + " " + config.sshHostKey + "\n",
      { mode: 0o600 },
    );
    const options = [
      "-F",
      "/dev/null",
      "-i",
      keyPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "UserKnownHostsFile=" + hostsPath,
      "-o",
      "ConnectTimeout=10",
      config.sshUsername + "@" + config.sshHost,
      command,
    ];
    try {
      const result = await execute("ssh", options, {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        encoding: "utf8",
      });
      return {
        exitCode: 0,
        stdout: result.stdout,
        stderr: result.stderr,
        tenantGuid: config.tenantGuid,
      };
    } catch (error) {
      return {
        exitCode: typeof error.code === "number" ? error.code : null,
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
        error:
          "CLI execution failed (" +
          (error.code ?? error.signal ?? "unknown") +
          ").",
        tenantGuid: config.tenantGuid,
      };
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function withMcp(ctx, config, operation) {
  const credential = await ctx.secrets.resolve(config.mcpCredentialRef, {
    companyId: config.companyId,
    configPath: "mcpCredentialRef",
  });
  if (!/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(credential))
    throw new InputError("The MCP secret must contain API key:secret.");
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: "Bearer " + credential } },
    fetch: (input, init) => {
      if (String(input) !== MCP_URL)
        throw new InputError(
          "Only the production UteamUP MCP endpoint is allowed.",
        );
      // Native fetch preserves streaming, cancellation and redirect policy across MCP calls.
      const timeout = AbortSignal.timeout(45000);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, timeout])
        : timeout;
      return fetch(MCP_URL, { ...init, redirect: "error", signal });
    },
  });
  const client = new Client({ name: "uteamup-paperclip", version: "0.1.0" });
  try {
    await client.connect(transport);
    return await operation(client);
  } finally {
    await client.close();
  }
}

export async function findMcpTools(client, params) {
  const query = String(params.query ?? "").toLowerCase();
  const limit = params.limit ?? 20;
  if (query.length > 200 || !Number.isInteger(limit) || limit < 1 || limit > 40)
    throw new InputError("Invalid tool query or limit.");
  const matches = [];
  let cursor;
  let pages = 0;
  do {
    const result = await client.listTools(cursor ? { cursor } : {});
    matches.push(
      ...result.tools.filter(
        (tool) =>
          tool.name.startsWith("uteamup_") &&
          (tool.name + " " + (tool.description ?? ""))
            .toLowerCase()
            .includes(query),
      ),
    );
    cursor = result.nextCursor;
    pages += 1;
  } while (cursor && pages < 100);
  return {
    tools: matches.slice(0, limit),
    matches: matches.length,
    truncated: matches.length > limit || Boolean(cursor),
  };
}

export function validateMcpCall(params) {
  if (
    !/^uteamup_[a-z0-9_]+$/.test(params.name) ||
    !params.arguments ||
    typeof params.arguments !== "object" ||
    Array.isArray(params.arguments)
  )
    throw new InputError(
      "Provide a discovered UteamUP tool name and arguments object.",
    );
  return params;
}
