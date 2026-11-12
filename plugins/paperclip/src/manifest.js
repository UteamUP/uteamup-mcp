const object = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const tools = [
  {
    name: "cli",
    displayName: "UteamUP CLI",
    description:
      "Run the installed UteamUP CLI locally on the Paperclip server or over the configured SSH connection for this company and UteamUP tenant. Supply arguments without the executable. Use --help to discover commands. Includes bugs list/get for the authorized product-team workflow. Changes require the user task to authorize them. Authentication, global config changes, profile overrides and disabling TLS are unavailable.",
    parametersSchema: object(
      {
        args: {
          type: "array",
          minItems: 1,
          maxItems: 80,
          items: { type: "string", maxLength: 8000 },
        },
      },
      ["args"],
    ),
  },
  {
    name: "mcp_tools",
    displayName: "Find UteamUP MCP tools",
    description:
      "Discover the actual tools and argument schemas exposed by https://api.uteamup.com/mcp. Search bug_report for reporting, submitted reports, conversations and follow-up comments. Returns a bounded set of matches; use these schemas with mcp_call.",
    parametersSchema: object({
      query: { type: "string", maxLength: 200 },
      limit: { type: "integer", minimum: 1, maximum: 40 },
    }),
  },
  {
    name: "mcp_call",
    displayName: "Call UteamUP MCP tool",
    description:
      "Call a discovered UteamUP MCP tool with the tenant-bound connection. Use exact names and argument schemas from mcp_tools. Bug-report tools can create reports, read your submitted reports/conversations and add follow-up comments. Perform record changes only when authorized by the current user task. Backend permissions remain authoritative.",
    parametersSchema: object(
      {
        name: { type: "string", pattern: "^uteamup_[a-z0-9_]+$" },
        arguments: { type: "object", additionalProperties: true },
      },
      ["name", "arguments"],
    ),
  },
];

const text = (title, defaultValue) => ({
  type: "string",
  title,
  ...(defaultValue ? { default: defaultValue } : {}),
});
const secret = (title) => ({
  title,
  format: "secret-ref",
  description:
    "Select an encrypted Paperclip secret. Raw credentials are not accepted.",
});

export const manifest = {
  id: "uteamup.integration",
  apiVersion: 1,
  version: "0.1.1",
  displayName: "UteamUP CLI & MCP",
  author: "UteamUP",
  categories: ["workspace"],
  description:
    "Tenant-scoped UteamUP CLI on the Paperclip server or over SSH, plus production MCP tools for bug reporting and investigation. Uses encrypted secret references and preserves CLI configuration.",
  capabilities: ["agent.tools.register", "secrets.read-ref", "http.outbound"],
  entrypoints: { worker: "dist/worker.js" },
  instanceConfigSchema: object(
    {
      companyId: text("Paperclip company GUID"),
      tenantGuid: text("UteamUP tenant GUID"),
      cliExecutionMode: {
        type: "string",
        title: "CLI execution: local server or SSH",
        enum: ["local", "ssh"],
        default: "local",
      },
      sshHost: text("SSH host (SSH mode only)"),
      sshUsername: text("SSH username (SSH mode only)"),
      sshHostKey: text("Pinned SSH host key (SSH mode only)"),
      workingDirectory: text("CLI working directory"),
      cliPath: text("Installed CLI path", "/usr/local/bin/uteamup"),
      sshKeyRef: secret("Existing Mac SSH private key"),
      mcpCredentialRef: secret("UteamUP MCP credential (API key:secret)"),
    },
    [
      "companyId",
      "tenantGuid",
      "workingDirectory",
      "cliPath",
      "mcpCredentialRef",
    ],
  ),
  tools,
};

export default manifest;
