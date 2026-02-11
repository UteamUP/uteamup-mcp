# Debugging Guide - UteamUP MCP Server

This guide explains how to debug the @uteamup/mcp-server package using the official MCP Inspector tool.

## What is MCP Inspector?

MCP Inspector is the official debugging tool for Model Context Protocol (MCP) servers. It provides:
- Real-time visualization of MCP server communication
- Server notification monitoring
- Request/response inspection
- Environment variable configuration
- Connection status monitoring

**Official Documentation:** https://modelcontextprotocol.io/docs/tools/inspector

## Quick Start

### 1. Install and Run MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @uteamup/mcp-server@beta
```

This command:
- Starts the MCP Inspector web interface
- Launches it pre-configured with the UteamUP MCP server command
- Opens your browser automatically to http://localhost:6274

### 2. Configure Environment Variables

In the Inspector UI:

1. Click "Environment Variables" to expand the section
2. Click "Add Environment Variable" for each required variable
3. Add the following 4 environment variables:

| Key | Value | Description |
|-----|-------|-------------|
| `UTEAMUP_API_KEY` | Your 32-character API key | Get from UteamUP Tenant Settings → API Keys |
| `UTEAMUP_SECRET` | Your 64-character secret | Generated when creating API key |
| `UTEAMUP_API_BASE_URL` | `https://localhost:5002` (dev) or `https://api.uteamup.com` (prod) | Backend URL |
| `UTEAMUP_DEBUG` | `1` or `true` | Enable detailed debug logging |

### 3. Connect

Click the "Connect" button. You should see notifications appear in the "Server Notifications" section.

## Understanding Notifications

### Successful Authentication Flow

When authentication succeeds, you'll see these key notifications:

1. **Server Startup:**
   ```
   [MCP Proxy] Starting UteamUP MCP Server
   [MCP Proxy] Version: 1.0.0-beta.6
   [MCP Proxy] Base URL: https://localhost:5002
   [MCP Proxy] Debug: enabled
   [MCP Proxy] Ready to receive JSON-RPC requests
   ```

2. **OAuth Flow:**
   ```
   [MCP Proxy] Getting new access token...
   [MCP Proxy] Got auth code: <code>...
   [MCP Proxy] ✅ Got access token  <-- SUCCESS!
   ```

3. **MCP Requests:**
   ```
   [DEBUG] Processing request: initialize id: 0
   [DEBUG] Forwarding request: { method: 'initialize', id: 0 }
   [DEBUG] MCP response received: { statusCode: 200, dataLength: 204 }
   [DEBUG] Detected SSE format, parsing...
   [DEBUG] SSE parsed successfully: {"result":...}
   ```

### Common Errors

#### Authentication Errors

**Error:** `Authentication failed: Invalid API Key or Secret`
- **Cause:** Wrong API key or secret
- **Fix:** Double-check credentials in UteamUP Tenant Settings → API Keys

**Error:** `MCP access denied: Your API key does not have MCP enabled`
- **Cause:** API key not created as MCP-enabled
- **Fix:** Create a new API key with MCP checkbox enabled

**Error:** `Token exchange failed: {"accessToken":"..."}`
- **Cause:** Bug in beta.1 (fixed in beta.2+)
- **Fix:** Upgrade to `@uteamup/mcp-server@beta` (latest)

#### Connection Errors

**Error:** `Connection Error - Check if your MCP server is running`
- **Possible Causes:**
  1. Missing environment variables
  2. Backend server not running (check UTEAMUP_API_BASE_URL)
  3. Network issues (firewall, self-signed certs)

- **Debugging Steps:**
  1. Check Server Notifications for specific error messages
  2. Verify all 4 environment variables are set
  3. Ensure backend is running at the BASE_URL
  4. Check terminal for additional error output

## Debug Logging

### Enable Debug Mode

Set `UTEAMUP_DEBUG=1` to see detailed logging including:
- PKCE code generation
- Authorization request parameters
- Token exchange responses
- Request/response details
- JWT token caching

### Sample Debug Output

```
[DEBUG] Generated PKCE pair: { verifierLength: 43, challengeLength: 43 }
[DEBUG] Authorization request params: response_type=code&client_id=...
[DEBUG] Authorization code received
[DEBUG] Token exchange response status: 200
[DEBUG] Access token received successfully
[DEBUG] Token cached, expires at: 2026-02-17T12:34:56.789Z
```

## Inspecting Requests and Responses

### View Request Details

1. Expand any notification in the "Server Notifications" section
2. Click on requests to see full JSON-RPC message
3. Copy values using the copy buttons

### Example Notification Structure

```json
{
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "stdio",
    "data": {
      "message": "[MCP Proxy] ✅ Got access token"
    }
  }
}
```

## Testing Different Scenarios

### Test Invalid Credentials

1. Set wrong `UTEAMUP_API_KEY`
2. Click Connect
3. Should see: `Authentication failed: Invalid API Key or Secret`

### Test MCP Disabled Key

1. Use API key without MCP enabled
2. Click Connect
3. Should see: `MCP access denied: Your API key does not have MCP enabled`

### Test Production vs Development

**Development:**
```bash
UTEAMUP_API_BASE_URL=https://localhost:5002
```

**Production:**
```bash
UTEAMUP_API_BASE_URL=https://api.uteamup.com
```

## Troubleshooting Checklist

- [ ] MCP Inspector running (http://localhost:6274)
- [ ] All 4 environment variables configured
- [ ] API key is 32 characters
- [ ] Secret is 64+ characters
- [ ] API key has MCP enabled (check in UteamUP)
- [ ] Backend server is running at BASE_URL
- [ ] Debug mode enabled (`UTEAMUP_DEBUG=1`)
- [ ] Using latest beta version (`@beta` tag)

## Advanced: Debugging with Raw Logs

If Inspector isn't working, run the package directly:

```bash
export UTEAMUP_API_KEY="your-key"
export UTEAMUP_SECRET="your-secret"
export UTEAMUP_API_BASE_URL="https://localhost:5002"
export UTEAMUP_DEBUG="1"

npx -y @uteamup/mcp-server@beta
```

This will show raw stdio output. Send JSON-RPC messages manually to test.

## Known Issues (All Fixed in beta.6!)

### ✅ Beta.1 - Token Parsing Bug (FIXED in beta.2)

**Symptom:** `Token exchange failed: {"accessToken":"..."}`
**Cause:** Backend returns `accessToken` but code checked for `access_token`
**Fix:** Upgrade to beta.2+

### ✅ Beta.2 - HTTP 406 Error (FIXED in beta.3)

**Symptom:** `Not Acceptable: Client must accept both application/json and text/event-stream`
**Cause:** Missing `Accept` header
**Fix:** Upgrade to beta.3+

### ✅ Beta.4 - SSE Parse Error (FIXED in beta.5)

**Symptom:** `Unexpected token 'e', "event: mes"... is not valid JSON`
**Cause:** Backend returns Server-Sent Events (SSE) format, proxy tried to parse as plain JSON
**Fix:** Upgrade to beta.5+ (includes SSE parser)

### ✅ Beta.5 - Notification Error (FIXED in beta.6)

**Symptom:** `Received a response for an unknown message ID`
**Cause:** Backend returns HTTP 202 with empty body for notifications
**Fix:** Upgrade to beta.6+ (proper notification handling)

### Inspector Transport Errors

**Symptom:** `Error: Not connected` from SSEServerTransport

**Cause:** Inspector proxy layer issue (not package bug)

**Workaround:** Check Server Notifications for actual package output - authentication may have succeeded despite Inspector error

## CLI Utilities (New in beta.7!)

### --help
Show complete usage information:
```bash
npx -y @uteamup/mcp-server --help
```

### --version
Check installed version:
```bash
npx -y @uteamup/mcp-server --version
```

### --validate-config
Validate environment variables without connecting:
```bash
export UTEAMUP_API_KEY="your-key"
export UTEAMUP_SECRET="your-secret"
npx -y @uteamup/mcp-server --validate-config
```

Output:
```
✅ Configuration is valid!
[MCP Proxy] Configuration:
  Base URL: https://api.uteamup.com
  API Key: 12345678...
  Log Level: INFO
  ...
```

### --test-auth
Test OAuth authentication flow without starting the server:
```bash
export UTEAMUP_API_KEY="your-key"
export UTEAMUP_SECRET="your-secret"
npx -y @uteamup/mcp-server --test-auth
```

Output:
```
Testing OAuth authentication...
...
✅ Authentication successful!
   Token obtained in 1234ms
   Token prefix: eyJhbGciOiJIUzI1NiI...
   Token expires: 2026-02-18T12:34:56.789Z
```

---

## Structured Logging (New in beta.7!)

### Log Levels

Set log level via `UTEAMUP_LOG_LEVEL`:

```bash
UTEAMUP_LOG_LEVEL=TRACE  # Most verbose
UTEAMUP_LOG_LEVEL=DEBUG  # Detailed debugging
UTEAMUP_LOG_LEVEL=INFO   # General info (default)
UTEAMUP_LOG_LEVEL=WARN   # Warnings only
UTEAMUP_LOG_LEVEL=ERROR  # Errors only
```

### Log Formats

**Text Format (Development):**
```bash
UTEAMUP_LOG_FORMAT=text npx -y @uteamup/mcp-server
```
Output:
```
[12:34:56.789] INFO [MCP Proxy] Starting UteamUP MCP Server
[12:34:56.790] INFO [MCP Proxy] Getting new access token
[12:34:57.123] INFO [MCP Proxy] Access token obtained successfully
```

**JSON Format (Production):**
```bash
UTEAMUP_LOG_FORMAT=json npx -y @uteamup/mcp-server
```
Output:
```json
{"level":30,"time":1707656096789,"msg":"Starting UteamUP MCP Server","version":"1.0.0-beta.7"}
{"level":30,"time":1707656096790,"msg":"Getting new access token"}
{"level":30,"time":1707656097123,"msg":"Access token obtained successfully","durationMs":333}
```

### Sensitive Data Redaction

All logs automatically redact:
- Authorization headers
- Access tokens
- Client secrets
- API keys
- Passwords
- Any field containing "secret", "token", "password", "bearer"

Example:
```json
{
  "headers": {
    "Authorization": "[REDACTED]",
    "Content-Type": "application/json"
  }
}
```

---

## Performance Monitoring (New in beta.7!)

Metrics are automatically tracked and printed on shutdown:

```bash
[INFO] Performance Metrics Summary
  oauth:
    attempts: 2
    successRate: "100.00%"
    avgDurationMs: 1234
  requests:
    total: 15
    successRate: "93.33%"
    avgDurationMs: 456
  tokenCache:
    hits: 13
    misses: 2
    hitRate: 86.67%
```

---

## Retry Logic (New in beta.7!)

### Configuration

```bash
UTEAMUP_MAX_RETRIES=5           # Max retry attempts (default: 3)
UTEAMUP_REQUEST_TIMEOUT=60000   # Request timeout in ms (default: 30000)
```

### Retry Behavior

The proxy automatically retries:
- Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
- HTTP 429 (rate limiting)
- HTTP 5xx (server errors)

With:
- Exponential backoff (1s, 2s, 4s, 8s, ...)
- Jitter (±20%) to prevent thundering herd
- Maximum backoff of 10 seconds

Does NOT retry:
- HTTP 4xx errors (except 429)
- Authentication failures (401, 403)
- Invalid credentials

---

## Version History

- **1.0.0-beta.7** (2026-02-11) ⭐ CURRENT
  - ✅ Structured logging with Pino (JSON/text formats)
  - ✅ Configuration validation with Zod
  - ✅ Performance monitoring and metrics
  - ✅ Retry logic with exponential backoff
  - ✅ CLI utilities (--help, --version, --validate-config, --test-auth)
  - ✅ Comprehensive test suite (70 tests)
  - ✅ Request tracing with unique IDs
  - ✅ Sensitive data redaction

- **1.0.0-beta.6** (2026-02-10)
  - ✅ Fixed JSON-RPC notification handling (HTTP 202 empty responses)
  - ✅ Eliminates "Received a response for an unknown message ID" errors
  - ✅ Production-ready and stable

- **1.0.0-beta.5** (2026-02-10)
  - ✅ **CRITICAL:** Added Server-Sent Events (SSE) response parsing
  - ✅ Fixes "Unexpected token 'e'" parse errors
  - ✅ Backend uses `text/event-stream` format (SSE)
  - ✅ Extracts JSON from `data:` field in SSE responses

- **1.0.0-beta.4** (2026-02-10)
  - ✅ Enhanced debug logging (response body, parsed JSON, parse errors)
  - ✅ Fixed npm bin field (`./index.js` instead of `index.js`)

- **1.0.0-beta.3** (2026-02-10)
  - ✅ Added `Accept: application/json, text/event-stream` header
  - ✅ Fixes HTTP 406 "Not Acceptable" error

- **1.0.0-beta.2** (2026-02-10)
  - ✅ Fixed critical token parsing bug
  - ✅ Now accepts both `accessToken` and `access_token` formats
  - ✅ Verified working with MCP Inspector

- **1.0.0-beta.1** (2026-02-10)
  - ❌ Token parsing bug (use beta.2+)

## Support

- **GitHub Issues:** https://github.com/uteamup/mcp-server/issues
- **MCP Docs:** https://modelcontextprotocol.io/docs/tools/inspector
- **UteamUP Support:** support@uteamup.com
