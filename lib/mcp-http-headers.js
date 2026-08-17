'use strict';

/**
 * Streamable HTTP headers mirrored from a JSON-RPC MCP message (SEP-2243).
 *
 * The C# SDK 2.x backend requires these on protocol 2026-07-28+. Down-level
 * initialize-handshake clients omit protocol version in the body; we omit
 * MCP-Protocol-Version in that case so SDK 2.x keeps its back-compat path.
 */

const PROTOCOL_VERSION_META_KEY = 'io.modelcontextprotocol/protocolVersion';
const NAMED_METHODS = new Set(['tools/call', 'prompts/get', 'resources/read']);

function readProtocolVersion(request) {
  const params = request && typeof request.params === 'object' && request.params !== null
    ? request.params
    : null;
  if (!params) {
    return undefined;
  }

  const meta = params._meta;
  if (meta && typeof meta === 'object' && typeof meta[PROTOCOL_VERSION_META_KEY] === 'string') {
    const fromMeta = meta[PROTOCOL_VERSION_META_KEY].trim();
    if (fromMeta) {
      return fromMeta;
    }
  }

  if (request.method === 'initialize' && typeof params.protocolVersion === 'string') {
    const fromInit = params.protocolVersion.trim();
    if (fromInit) {
      return fromInit;
    }
  }

  return undefined;
}

function readTargetName(request) {
  if (!NAMED_METHODS.has(request.method)) {
    return undefined;
  }

  const params = request.params;
  if (!params || typeof params !== 'object') {
    return undefined;
  }

  const raw = request.method === 'resources/read' ? params.uri : params.name;
  if (typeof raw !== 'string') {
    return undefined;
  }

  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

/**
 * @param {object} request JSON-RPC 2.0 MCP request or notification
 * @returns {Record<string, string>}
 */
function buildMcpForwardHeaders(request) {
  const headers = {};
  if (!request || typeof request.method !== 'string' || request.method.length === 0) {
    return headers;
  }

  headers['Mcp-Method'] = request.method;

  const version = readProtocolVersion(request);
  if (version) {
    headers['MCP-Protocol-Version'] = version;
  }

  const name = readTargetName(request);
  if (name) {
    headers['Mcp-Name'] = name;
  }

  return headers;
}

module.exports = {
  PROTOCOL_VERSION_META_KEY,
  buildMcpForwardHeaders
};
