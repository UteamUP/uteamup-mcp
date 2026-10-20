![UteamUP logo](assets/logo.png)

UteamUP CMMS connects Claude Code and Cowork to your UteamUP workspace for work
orders, assets, maintenance schedules, inventory, and operational records.

Install in Claude Code with /plugin install uteamup --marketplace UteamUP/uteamup-mcp

When you enable the plugin, Claude asks for your MCP-enabled tenant API key and
its secret through masked configuration fields. Claude stores those values in
its secure credential storage. The plugin uses the existing UteamUP MCP client,
pinned to an exact published version with locked dependencies. It connects only
to https://api.uteamup.com/mcp. Your tenant API key's existing permissions control
which tools and records you can access; installation grants no additional rights.

The client exchanges the credentials for OAuth tokens, refreshes its session,
and forwards requested MCP operations to UteamUP. Its process keeps tokens in
memory unless you explicitly configure persistent token caching. This plugin
does not configure persistent caching. Request and response content is processed
by Claude and UteamUP under their respective policies.

Manage or revoke your API key in UteamUP tenant settings. This local MCP plugin
requires Claude Code or Cowork; it does not run in Claude web or mobile chat.
Website: https://uteamup.com
Publisher and support contact: UteamUP, gisli@uteamup.com
