# @uteamup/mcp-server

> MCP server client for UteamUP - enables Claude Desktop/Code integration with automatic OAuth 2.0 authentication

[![npm version](https://img.shields.io/npm/v/@uteamup/mcp-server.svg)](https://www.npmjs.com/package/@uteamup/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Links

- **📦 [npm Package](https://www.npmjs.com/package/@uteamup/mcp-server)** - Install with `npx -y @uteamup/mcp-server`
- **📖 [Documentation](https://docs.uteamup.com/mcp)** - Full MCP integration guide
- **🐛 [Issues](https://github.com/uteamup/mcp-server/issues)** - Report bugs and request features
- **💬 [Support](mailto:support@uteamup.com)** - Get help

## What is this?

This package enables AI assistants like Claude Desktop and Claude Code to connect to your UteamUP CMMS system using the Model Context Protocol (MCP). It handles OAuth 2.0 authentication automatically, so you can manage work orders, assets, inventory, and more through natural conversation.

**Key Features:**
- ✅ Automatic OAuth 2.0 + PKCE authentication
- ✅ Token caching (7-day expiration, auto-refresh)
- ✅ Works with Claude Desktop, Claude Code, and any MCP-compatible client
- ✅ Zero configuration - just provide API credentials
- ✅ Comprehensive error messages
- ✅ Development mode support (self-signed certificates)
- ✅ Server-Sent Events (SSE) response parsing
- ✅ Proper JSON-RPC 2.0 notification handling
- ✅ **NEW:** Structured logging with Pino (JSON/text formats)
- ✅ **NEW:** Configuration validation with Zod
- ✅ **NEW:** Performance monitoring and metrics
- ✅ **NEW:** Retry logic with exponential backoff
- ✅ **NEW:** CLI utilities (--help, --version, --validate-config, --test-auth)
- ✅ **NEW:** Comprehensive test suite (70 tests)

**Current Status:** `v1.0.0-beta.7` - Production-ready with enhanced debugging! See [CHANGELOG.md](CHANGELOG.md) for details.

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

**macOS/Linux:** Edit `~/.config/claude/mcp.json`
**Windows:** Edit `%APPDATA%\Claude\mcp.json`

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

**Optional:** For development/testing against a local backend:
```json
{
  "mcpServers": {
    "uteamup-dev": {
      "command": "npx",
      "args": ["-y", "@uteamup/mcp-server"],
      "env": {
        "UTEAMUP_API_KEY": "your-api-key",
        "UTEAMUP_SECRET": "your-secret",
        "UTEAMUP_API_BASE_URL": "https://devback.uteamup.com"
      }
    }
  }
}
```

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
| `UTEAMUP_TOKEN_CACHE_DIR` | Persistent token cache directory | - |
| `UTEAMUP_TOKEN_REFRESH_MARGIN` | Token refresh margin in seconds | `300` |

### API Base URLs

| Environment | URL | When to Use |
|-------------|-----|-------------|
| **Production** | `https://api.uteamup.com` | Default - for normal use |
| **Development** | `https://devback.uteamup.com` | Testing against dev backend |
| **Local** | `https://localhost:5002` | Local development with self-signed cert |

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
1. Check your MCP configuration file (`~/.config/claude/mcp.json` or `%APPDATA%\Claude\mcp.json`)
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
   - Development: Set `UTEAMUP_API_BASE_URL=https://devback.uteamup.com`
3. **Check if UteamUP is down:**
   - Contact support@uteamup.com
4. **For local development:**
   - Ensure backend is running: `cd UteamUP_Backend/UteamUP_API && make watch`
   - Use `UTEAMUP_API_BASE_URL=https://localhost:5002`

---

#### "UNABLE_TO_VERIFY_LEAF_SIGNATURE" or certificate errors

**Cause:** Self-signed certificate (development mode).

**Solution:** This package automatically accepts self-signed certificates for development. If you're seeing this error:
1. Verify `UTEAMUP_API_BASE_URL` is set correctly
2. If using local backend, ensure it's running on HTTPS
3. For production, this should never happen - contact support

---

#### Tools list is empty or incomplete

**Cause:** API key role has limited permissions.

**Solution:**
1. Go to **Tenant Settings** → **API Keys** in UteamUP
2. Edit your API key
3. Change the role to one with more permissions (e.g., Admin or Supervisor)
4. Available tools depend on your role's permissions
5. Changes take effect immediately

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
   - Email: support@uteamup.com
   - Documentation: https://docs.uteamup.com/mcp
   - GitHub Issues: https://github.com/uteamup/mcp-server/issues

---

## Development

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/UteamUP/uteamup-mcp-proxy.git
cd uteamup-mcp-proxy

# Install dependencies
npm install

# Run tests
npm test

# Test with debug logging
export UTEAMUP_LOG_LEVEL=DEBUG
export UTEAMUP_API_KEY="your-dev-key"
export UTEAMUP_SECRET="your-dev-secret"
export UTEAMUP_API_BASE_URL="https://localhost:5002"
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
      "args": ["/absolute/path/to/uteamup-mcp-proxy/index.js"],
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
uteamup-mcp-proxy/
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

- **Documentation:** https://docs.uteamup.com/mcp
- **Email:** support@uteamup.com
- **Issues:** https://github.com/uteamup/mcp-server/issues

---

## Related Links

- [UteamUP Website](https://uteamup.com)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
