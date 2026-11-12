import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { tools } from "./manifest.js";
import {
  validateConfig,
  assertCompany,
  runCli,
  withMcp,
  findMcpTools,
  validateMcpCall,
  InputError,
} from "./runtime.js";

export function registerTools(ctx) {
  const handlers = {
    cli: (config, params) => runCli(ctx, config, params.args),
    mcp_tools: (config, params) =>
      withMcp(ctx, config, (client) => findMcpTools(client, params)),
    mcp_call: (config, params) => {
      validateMcpCall(params);
      return withMcp(ctx, config, (client) => client.callTool(params));
    },
  };
  for (const declaration of tools) {
    ctx.tools.register(
      declaration.name,
      declaration,
      async (params, context) => {
        try {
          const config = validateConfig(
            await ctx.config.get(context.companyId),
          );
          assertCompany(config, context);
          const data = await handlers[declaration.name](config, params ?? {});
          if (JSON.stringify(data).length > 1024 * 1024)
            return { error: "Result exceeded 1 MiB. Narrow the query." };
          return { data, content: JSON.stringify(data) };
        } catch (error) {
          return {
            error:
              error instanceof InputError
                ? error.message
                : "UteamUP connection failed. Check the encrypted credentials, permissions and Mac availability.",
          };
        }
      },
    );
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    registerTools(ctx);
  },
  async onValidateConfig(config) {
    try {
      validateConfig(config);
      return { ok: true };
    } catch (error) {
      return { ok: false, errors: [error.message] };
    }
  },
  async onHealth() {
    return {
      status: "ok",
      message:
        "UteamUP CLI and MCP tools registered; connections are checked when called.",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
