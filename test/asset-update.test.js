/**
 * UteamupAssetUpdate MCP tool test.
 *
 * Backend tool: UpdateAssetCommand + Handler, the full replace of an asset. A reference outside
 * the caller's tenant is refused with a tool error that carries the refusal code.
 * [McpServerTool] sets no Name, so the SDK exposes the method snake-cased: uteamup_asset_update.
 *
 * This proves proxy forwarding only: the backend's tool error comes back over the /mcp JSON-RPC
 * contract unchanged. That the backend emits the code is covered by
 * UpdateAssetCommandHandlerTests in the backend test project.
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupAssetUpdate MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_update';
  const TOOL_NAME = 'uteamup_asset_update';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL_NAME, toolArgs, mockReply, expectedArgs);

  // The backend tool still takes the integer asset id; it has no assetGuid argument yet.
  const assetId = 42;
  const foreignVendorGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('forwards an invalid_reference tool error unchanged', async () => {
    const args = { id: assetId, model: { name: 'Feed pump', vendorGuid: foreignVendorGuid } };
    // The shape ModelContextProtocol 2.2.0 gives a tool that throws McpException: the SDK puts its
    // own prefix before the backend's "code: reason" text.
    const toolError = {
      content: [
        {
          type: 'text',
          text:
            `An error occurred invoking '${TOOL_NAME}': invalid_reference: These associated items do not ` +
            `exist in this tenant — VendorGuid: ${foreignVendorGuid} (Parameter 'VendorGuid')`,
        },
      ],
      isError: true,
    };

    const response = await call(
      args,
      { status: 200, body: { jsonrpc: '2.0', result: toolError, id: 1 } },
      args,
    );

    // nock only matches when params.arguments deep-equal `args`, so a 200 also proves the
    // refused vendorGuid reached the backend verbatim.
    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(response.body.result).toEqual(toolError);
    expect(response.body.result.content[0].text).toContain('invalid_reference: ');
  });

  const complianceTools = [{ name: TOOL_NAME, args: { id: assetId, model: { name: 'Feed pump' } } }];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
