UteamUP CMMS for ChatGPT and Codex

Publisher: UteamUP
Contact: gisli@uteamup.com
Website: https://uteamup.com
Support: https://github.com/UteamUP/uteamup-mcp/issues
Privacy policy: https://app.uteamup.com/privacypolicy
Terms of service: https://app.uteamup.com/terms

This package connects to the existing production read-only MCP endpoint at
https://api.uteamup.com/mcp/read-only. Users sign in through UteamUP's OAuth
flow and select an authorized workspace. The requested scope is mcp:read.
No credentials, tokens, local server programs, or executable hooks are bundled.

Available tools:
uteamup_asset_list
uteamup_asset_get_by_guid
uteamup_asset_search
uteamup_workorder_list
uteamup_workorder_search

The connection can read authorized asset and work-order records, which may
include names or contact information. Requests and responses are processed by
OpenAI and UteamUP under their respective policies. UteamUP retains stored
records under its privacy policy and workspace retention settings. This package
does not retain record content locally or provide write operations.

Examples:
List the first five assets in my workspace.
Find assets whose name contains pump.
List the first five work orders in my workspace.

Publishing preparation:
This package uses OpenAI's supported Codex compatibility format. Create the ZIP
from this folder with .codex-plugin/plugin.json, .mcp.json, README.txt, and
assets/logo.png at the archive root. Select With MCP in OpenAI's portal.
The package includes five positive and three negative reviewer test cases.
The portal still requires a verified UteamUP business identity, domain ownership
verification, a successful live OAuth/tool scan, a real demo recording, and
reviewer access entered through its secure form before review submission.
Add the real demo recording URL to extensions.com.openai.review.demo_recording_url
when that recording is available. Keep private reviewer credentials out of Git
and the upload archive.
