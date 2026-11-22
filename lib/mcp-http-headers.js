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
const MAX_HEADER_VALUE_LENGTH = 256;

function containsUnsafeHeaderChar(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code > 0xff) {
      return true;
    }
  }
  return false;
}

function sanitizeHeaderValue(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (containsUnsafeHeaderChar(value)) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.length > MAX_HEADER_VALUE_LENGTH
    ? trimmed.slice(0, MAX_HEADER_VALUE_LENGTH)
    : trimmed;
}

function stripUriQueryAndFragment(uri) {
  const queryIndex = uri.indexOf('?');
  const fragmentIndex = uri.indexOf('#');
  let endIndex = uri.length;
  if (queryIndex !== -1 && queryIndex < endIndex) {
    endIndex = queryIndex;
  }
  if (fragmentIndex !== -1 && fragmentIndex < endIndex) {
    endIndex = fragmentIndex;
  }
  return uri.slice(0, endIndex);
}

function readProtocolVersion(request) {
  const params = request && typeof request.params === 'object' && request.params !== null
    ? request.params
    : null;
  if (!params) {
    return undefined;
  }

  const meta = params._meta;
  if (meta && typeof meta === 'object' && typeof meta[PROTOCOL_VERSION_META_KEY] === 'string') {
    const fromMeta = sanitizeHeaderValue(meta[PROTOCOL_VERSION_META_KEY]);
    if (fromMeta) {
      return fromMeta;
    }
  }

  if (request.method === 'initialize' && typeof params.protocolVersion === 'string') {
    const fromInit = sanitizeHeaderValue(params.protocolVersion);
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

  if (containsUnsafeHeaderChar(raw)) {
    return undefined;
  }

  const candidate = request.method === 'resources/read'
    ? stripUriQueryAndFragment(raw)
    : raw;
  return sanitizeHeaderValue(candidate);
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

  const method = sanitizeHeaderValue(request.method);
  if (method) {
    headers['Mcp-Method'] = method;
  }

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
  MAX_HEADER_VALUE_LENGTH,
  PROTOCOL_VERSION_META_KEY,
  buildMcpForwardHeaders
};
