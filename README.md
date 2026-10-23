<p align="center">
  <img src="assets/logo.svg" alt="UteamUP Logo" width="88" />
</p>

# @uteamup/mcp-server

> MCP server client for UteamUP - enables Claude Desktop/Code integration with automatic OAuth 2.0 authentication

[![npm version](https://img.shields.io/npm/v/@uteamup/mcp-server.svg)](https://www.npmjs.com/package/@uteamup/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Links

- **📦 [npm Package](https://www.npmjs.com/package/@uteamup/mcp-server)** - Install with `npx -y @uteamup/mcp-server`
- **📖 [Documentation](https://github.com/UteamUP/uteamup-mcp#readme)** - Full MCP integration guide
- **🐛 [Issues](https://github.com/UteamUP/uteamup-mcp/issues)** - Report bugs and request features
- **💬 [Support](mailto:gisli@uteamup.com)** - Get help

## What is this?

This package enables AI assistants like Claude Desktop and Claude Code to connect to your UteamUP CMMS system using the Model Context Protocol (MCP). It handles OAuth 2.0 authentication automatically, so you can manage work orders, assets, inventory, and more through natural conversation.

### Read-only access for Claude, Grok, Grok Bot and ChatGPT

Use the production HTTPS endpoint:

| Environment | MCP server URL |
|---|---|
| Production | `https://api.uteamup.com/mcp/read-only` |

**Sign in with your UteamUP account (recommended).** A tenant administrator (`Tenant.Update`)
first turns on **Allow members to connect AI assistants** in the company's **API Keys** tab.
Then each member connects their own assistant; no API key or secret is involved. The consent
page offers only companies with an active subscription in which the member is the owner or
holds a license; a link ends (401 `invalid_token`) when that stops being true:

- **Grok:** open [Connectors](https://grok.com/connectors), choose **New Connector → Custom**,
  and enter the endpoint. Grok registers itself (RFC 7591), sends you to the UteamUP consent
  page, and you pick the company and allow access. Business/Enterprise workspaces require
  their administrator to provision the connector.
- **Grok Bot:** add a **Custom MCP server, Remote HTTPS** with the endpoint on the Bot's
  Setup → Plugins card; each teammate signs in the first time they use it.
- **ChatGPT:** add a custom MCP server with the endpoint and choose OAuth; ChatGPT registers
  itself and you approve on the same consent page.
- **Claude:** add a custom connector with the endpoint, choose **Sign in now** and
  **Register automatically**, then approve on the UteamUP consent page.

The assistant uses the member's own permissions in the chosen company, and only the read
tools below. Access tokens last 60 minutes and refresh tokens rotate on every use. A member
disconnects under **Profile → Accounts**; an administrator sees and revokes every link in the
API Keys tab, or with the `uteamup_assistant_connection_list` /
`uteamup_assistant_connection_revoke` MCP tools. Turning the company setting off stops all
links immediately.

**Tenant API key (service integrations).** The **API Keys → Set up UPMate Integration** wizard
still offers the **Private read-only pilot for ChatGPT and Grok**: select an active role whose
grants are exclusively `View`/`Read` and create a separate MCP-enabled key per assistant. In
ChatGPT, configure OAuth with predefined client credentials (the API key as **Client ID**, its
secret as **Client Secret**). Grok only supports sign-in, so use the option above for Grok.
Tenant administrators retain the normal key quotas, expiration, IP restrictions, rate
limits, rotation, and revocation controls.

Only the existing asset list, asset search, asset-by-GUID, work-order list and work-order
search tools are advertised. Current UPMate capability settings, role permissions and
tenant scope are checked before discovery and invocation. Guessed write/admin tool calls
are denied before execution. The read-only endpoint also rejects a key if its persisted
role gains a write or wildcard permission, or if the key is revoked, expired or rotated.
These reads do not invoke a UteamUP AI provider or spend UteamUP AI credits.

The Node proxy can use the same endpoint with `UTEAMUP_MCP_PATH=/mcp/read-only`.
Its default `/mcp` transport retains the existing behavior and role-based authorization.
The CLI continues to use existing API-key creation, role selection and revocation commands;
no separate credential store or tool implementation is required.

References: [OpenAI custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server)
and [Grok connectors](https://docs.x.ai/grok/connectors).

**Key Features:**
- ✅ Automatic OAuth 2.0 + PKCE authentication
- ✅ Token caching with automatic refresh
- ✅ Works with Claude Desktop, Claude Code, and any MCP-compatible client
- ✅ Zero configuration - just provide API credentials
- ✅ Comprehensive error messages
- ✅ Server-Sent Events (SSE) response parsing
- ✅ Proper JSON-RPC 2.0 notification handling
- ✅ **NEW:** Structured logging with Pino (JSON/text formats)
- ✅ **NEW:** Configuration validation with Zod
- ✅ **NEW:** Performance monitoring and metrics
- ✅ **NEW:** Retry logic with exponential backoff
- ✅ **NEW:** CLI utilities (--help, --version, --validate-config, --test-auth)
- ✅ Comprehensive test suite

**Release status:** Beta. The npm badge above shows the published version;
see [CHANGELOG.md](CHANGELOG.md) for release details.

**Example Conversation:**
```
You: Show me all high-priority work orders in Building A
AI: I found 5 high-priority work orders in Building A...

You: Assign them all to John Doe
AI: Done! All 5 work orders are now assigned to John Doe.
```

---

## Installation

No installation needed! Use `npx` to run directly:

```bash
npx -y @uteamup/mcp-server
```

Or install globally:

```bash
npm install -g @uteamup/mcp-server
```

### Install via CLI Plugin Marketplaces

- **Claude Code:**
  ```bash
  claude plugin marketplace add UteamUP/uteamup-mcp
  claude plugin install uteamup@uteamup
  ```
- **Grok Build:**
  ```bash
  grok plugin install https://github.com/UteamUP/uteamup-mcp.git --trust
  ```
- **Gemini CLI:**
  ```bash
  gemini extensions install https://github.com/UteamUP/uteamup-mcp
  ```

---

## Quick Start

### 1. Get Your API Credentials

1. Log in to [UteamUP](https://app.uteamup.com)
2. Go to **Tenant Settings** → **API Keys**
3. Click **"Set up AI Integration"** or **"Create API Key"**
4. Enable **"MCP Enabled"** toggle
5. Click **Create API Key**
6. **Copy and save** your API Key and Secret (you won't see them again!)

### 2. Configure Claude Desktop

In Claude Desktop, open **Settings → Developer → Edit Config**.
The configuration file is located at:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "uteamup": {
      "command": "npx",
      "args": ["-y", "@uteamup/mcp-server"],
      "env": {
        "UTEAMUP_API_KEY": "your-32-character-api-key",
        "UTEAMUP_SECRET": "your-64-character-secret"
      }
    }
  }
}
```

All UteamUP MCP connections use `https://api.uteamup.com`. Use a restricted key
from a demo workspace when validating an integration.

### 3. Restart Claude Desktop

After saving the configuration, restart Claude Desktop. The UteamUP tools will be available automatically.

### 4. Test the Connection

In Claude, try:
```
What UteamUP tools do you have access to?
```
or
```
Show me all open work orders
```

That's it! 🎉

---

## Configuration

### Environment Variables

#### Required
| Variable | Description |
|----------|-------------|
| `UTEAMUP_API_KEY` | Your MCP-enabled API key (32 chars) |
| `UTEAMUP_SECRET` | Your API key secret (64+ chars) |

#### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `UTEAMUP_API_BASE_URL` | API endpoint URL | `https://api.uteamup.com` |
| `UTEAMUP_LOG_LEVEL` | Log level: TRACE, DEBUG, INFO, WARN, ERROR | `INFO` |
| `UTEAMUP_LOG_FORMAT` | Log format: text, json | `text` |
| `UTEAMUP_DEBUG` | Legacy debug mode (`1` or `true`) | `false` |
| `UTEAMUP_REQUEST_TIMEOUT` | Request timeout in milliseconds | `30000` |
| `UTEAMUP_MAX_RETRIES` | Max retry attempts for network errors | `3` |
| `UTEAMUP_MAX_REQUEST_BYTES` | Maximum bytes in one JSON-RPC request | `1048576` |
| `UTEAMUP_MAX_RESPONSE_BYTES` | Maximum bytes buffered from one backend response | `10485760` |
| `UTEAMUP_TOKEN_CACHE_DIR` | Persistent token cache directory | - |
| `UTEAMUP_TOKEN_REFRESH_MARGIN` | Token refresh margin in seconds | `300` |

### API Base URL

The configured base URL must be a bare HTTPS origin. Credentials, paths, query
parameters, fragments, and plain HTTP endpoints are rejected.

Always use `https://api.uteamup.com`, including when running the Node proxy
locally. The full MCP endpoint is `/mcp`; the read-only endpoint is
`/mcp/read-only`.

### Permissions

Your AI assistant's permissions are controlled by the **role assigned to your API key**. To change what the AI can do:

1. Go to **Tenant Settings** → **API Keys** in UteamUP
2. Edit your API key
3. Change the **Role** (e.g., Admin, Supervisor, Read-Only)
4. Changes take effect immediately - no reconnection needed

**Tip:** Create separate API keys with different roles for different use cases (e.g., one for read-only queries, one for full access).

---

## Troubleshooting

### Common Issues

#### "Missing required environment variables"

**Cause:** `UTEAMUP_API_KEY` or `UTEAMUP_SECRET` not set in MCP configuration.

**Solution:**
1. Check your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows)
2. Verify the `env` section includes both `UTEAMUP_API_KEY` and `UTEAMUP_SECRET`
3. Ensure there are no typos in the environment variable names
4. Restart Claude Desktop after making changes

---

#### "Authentication failed: Invalid API Key or Secret"

**Cause:** Wrong credentials or API key has been revoked.

**Solution:**
1. Verify your credentials in UteamUP:
   - Go to **Tenant Settings** → **API Keys**
   - Check that your API key is **Active** (not expired or revoked)
2. If credentials are lost, create a new API key:
   - Click **"Create API Key"**
   - Enable **"MCP Enabled"**
   - Copy the new credentials
3. Update your MCP configuration with the new credentials
4. Restart Claude Desktop

---

#### "MCP access denied: Your API key does not have MCP enabled"

**Cause:** The API key was created without MCP support.

**Solution:**
1. Create a new API key with MCP enabled:
   - Go to **Tenant Settings** → **API Keys**
   - Click **"Set up AI Integration"** or **"Create API Key"**
   - **Important:** Check the **"MCP Enabled"** toggle
   - Click **Create API Key**
2. Update your MCP configuration with the new credentials
3. Restart Claude Desktop

**Note:** You cannot enable MCP on an existing API key. You must create a new one.

---

#### "ECONNREFUSED" or "Connection refused"

**Cause:** Cannot reach the API server.

**Solutions:**
1. **Check your internet connection**
2. **Verify the base URL:**
   - Production: `https://api.uteamup.com` (default, no env var needed)
3. **Check if UteamUP is down:**
   - Contact gisli@uteamup.com

---

#### "UNABLE_TO_VERIFY_LEAF_SIGNATURE" or certificate errors

**Cause:** The connection cannot validate the server's TLS certificate.

**Solution:**
1. Verify the API base URL is `https://api.uteamup.com`
2. Check the device's date and trusted certificate configuration
3. Contact gisli@uteamup.com if the certificate error persists

---

#### Tools list is empty or incomplete

**Cause:** The credential, role, or company configuration does not grant the requested tools.

**Solution:**
1. Go to **Tenant Settings** → **API Keys** in UteamUP
2. Confirm the key is active and MCP-enabled for the intended company
3. Ask a company administrator to check the specific read permissions needed for your workflow
4. For the remote read-only connector, use a restricted read-only role; write or wildcard grants are not eligible
5. Reconnect the client to refresh its tool list after an authorized permission change

---

### Debugging

#### Structured Logging

Enable different log levels and formats:

```json
{
  "mcpServers": {
    "uteamup": {
      "command": "npx",
      "args": ["-y", "@uteamup/mcp-server"],
      "env": {
        "UTEAMUP_API_KEY": "your-key",
        "UTEAMUP_SECRET": "your-secret",
        "UTEAMUP_LOG_LEVEL": "DEBUG",
        "UTEAMUP_LOG_FORMAT": "json"
      }
    }
  }
}
```

**Log Levels:**
- `TRACE`: Most verbose, includes all request/response bodies (redacted)
- `DEBUG`: Detailed debugging information
- `INFO`: General informational messages (default)
- `WARN`: Warning messages
- `ERROR`: Error messages only

**Log Formats:**
- `text`: Pretty-printed human-readable logs (development)
- `json`: Structured JSON logs (production)

**Sensitive Data:** All credentials, tokens, and secrets are automatically redacted in logs.

**Note:** Logs are written to stderr, not stdout (which is reserved for JSON-RPC messages).

---

### Still Having Issues?

1. **Check the logs:**
   - Claude Desktop: View → Developer → Developer Tools → Console
   - Look for `[MCP Proxy]` messages

2. **Verify credentials format:**
   - API Key: exactly 32 characters
   - Secret: at least 64 characters
   - No extra spaces or quotes

3. **Test manually:**
   ```bash
   export UTEAMUP_API_KEY="your-key"
   export UTEAMUP_SECRET="your-secret"
   export UTEAMUP_DEBUG="1"
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npx @uteamup/mcp-server
   ```

4. **Get help:**
   - Email: gisli@uteamup.com
   - Documentation: https://github.com/UteamUP/uteamup-mcp#readme
   - GitHub Issues: https://github.com/UteamUP/uteamup-mcp/issues

---

## Development

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/UteamUP/uteamup-mcp.git
cd uteamup-mcp

# Install dependencies
npm install

# Run tests only at the final whole-goal gate (see MCPGuidelines.md)
UTEAMUP_FINAL_GOAL_GATE=1 npm test

# Test with debug logging
export UTEAMUP_LOG_LEVEL=DEBUG
export UTEAMUP_API_KEY="your-demo-workspace-key"
export UTEAMUP_SECRET="your-demo-workspace-secret"
export UTEAMUP_API_BASE_URL="https://api.uteamup.com"
node index.js

# CLI Utilities
node index.js --help                # Show help
node index.js --version             # Show version
node index.js --validate-config     # Validate environment variables
node index.js --test-auth           # Test OAuth authentication

# Test with a sample request
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node index.js
```

### Testing Locally with Claude Desktop

```bash
# Create a local link
npm link

# Update Claude Desktop config to use local version
{
  "mcpServers": {
    "uteamup-local": {
      "command": "node",
      "args": ["/absolute/path/to/uteamup-mcp/index.js"],
      "env": {
        "UTEAMUP_API_KEY": "your-key",
        "UTEAMUP_SECRET": "your-secret",
        "UTEAMUP_DEBUG": "1"
      }
    }
  }
}
```

### Project Structure

```
uteamup-mcp/
├── index.js           # Main entry point (OAuth + MCP client)
├── package.json       # Package metadata
├── README.md          # This file
├── LICENSE            # MIT license
├── CHANGELOG.md       # Version history
├── .gitignore         # Git ignore rules
├── .npmignore         # Files to exclude from npm package
└── test/              # Test files (not published)
    ├── oauth.test.js
    └── integration.test.js
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only integration tests (requires credentials)
npm run test:integration

# Run with coverage
npm test -- --coverage
```

### Code Style

This project uses:
- **ESLint** for linting
- **Prettier** for formatting
- **CommonJS** modules (not ESM) for maximum compatibility

```bash
# Lint code
npm run lint

# Format code
npm run format
```

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Commit Message Format

```
type(scope): subject

Types: feat, fix, docs, refactor, test, chore
Scope: oauth, client, docs, etc.

Example:
feat(oauth): add automatic token refresh on expiry
fix(client): handle network timeouts gracefully
docs(readme): update troubleshooting section
```

---

## License

MIT © UteamUP

See [LICENSE](LICENSE) for details.

---

## Support

- **Documentation:** https://github.com/UteamUP/uteamup-mcp#readme
- **Email:** gisli@uteamup.com
- **Issues:** https://github.com/UteamUP/uteamup-mcp/issues

---

## Related Links

- [UteamUP Website](https://uteamup.com)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
