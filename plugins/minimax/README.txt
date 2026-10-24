UteamUP CMMS for MiniMax Code

Publisher: UteamUP
Contact: gisli@uteamup.com
Website: https://uteamup.com
Support: https://github.com/UteamUP/uteamup-mcp/issues
Privacy policy: https://app.uteamup.com/privacypolicy
Terms of service: https://app.uteamup.com/terms

This plugin connects MiniMax Code to the existing production read-only MCP
endpoint at https://api.uteamup.com/mcp/read-only. Users sign in through
UteamUP's OAuth flow (MiniMax Code registers itself automatically and opens the
UteamUP consent page on first use) and select an authorized workspace. The
requested scope is mcp:read. A tenant administrator first turns on "Allow
members to connect AI assistants" in the company's API Keys tab; each member
then connects with their own UteamUP account and permissions. No API keys,
secrets, tokens, local server programs, or executable hooks are bundled.

Available tools:
uteamup_asset_list
uteamup_asset_get_by_guid
uteamup_asset_search
uteamup_workorder_list
uteamup_workorder_search

The connection can read authorized asset and work-order records, which may
include names or contact information. Requests and responses are processed by
MiniMax and UteamUP under their respective policies. UteamUP retains stored
records under its privacy policy and workspace retention settings. This plugin
does not retain record content locally or provide write operations. Reads do not
invoke a UteamUP AI provider and spend no UteamUP AI credits.

A member disconnects under Profile -> Accounts in UteamUP; an administrator
sees and revokes every link in the API Keys tab, or with the
uteamup_assistant_connection_list / uteamup_assistant_connection_revoke MCP
tools.

Examples:
List the first five assets in my workspace.
Find assets whose name contains pump.
List the first five work orders in my workspace.
Show my open work orders.

Installation: copy this folder into the MiniMax Code plugins directory and
let the app rescan local plugins:

  git clone https://github.com/UteamUP/uteamup-mcp.git
  cp -R uteamup-mcp/plugins/minimax ~/.minimax/plugins/uteamup

MiniMax Code registers the folder as a local plugin and enables it by default.
The bundled "cmms" skill teaches the agent when and how to use the tools.

Alternative without the plugin: add the MCP server directly in MiniMax Code
under Settings -> MCP Servers, using the Remote / streamable-http transport and
this URL (no credentials are stored):

  https://api.uteamup.com/mcp/read-only
