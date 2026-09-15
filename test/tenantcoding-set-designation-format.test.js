/**
 * UteamupTenantcodingSetDesignationFormat MCP tool test.
 *
 * Backend tool: SetTenantCodingDesignationFormatCommand + Handler — gives the tenant's active coding
 * system its own level separator and level names (First Water writes "=LB1.M2.M2.CL1.QMA01"). The
 * first call copies the global standard system into a tenant-owned one that takes over the tenant's
 * own codes. Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupTenantcodingSetDesignationFormat MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_set_designation_format';
  const TOOL = 'UteamupTenantcodingSetDesignationFormat';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL, toolArgs, mockReply, expectedArgs);

  const levelNames = ['Þrep 1 – Staðsetning', 'Þrep 2 – Yfirkerfi', 'Þrep 3', 'Þrep 4', 'Þrep 5', 'Þrep 6'];
  const args = { separatorChar: '.', levelNames };

  const sampleConfig = {
    externalGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    tenantGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    codingSystemGuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    codingSystemName: 'RDS/IEC 81346',
    codingSystemType: 'rds',
    isActive: true,
    totalCodedAssets: 732,
    totalAssets: 732,
  };

  // ---- happy path -------------------------------------------------------

  it('returns the tenant config pointing at the tenant-owned coding system', async () => {
    const response = await call(args, successReply(sampleConfig));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.codingSystemGuid).toBe(sampleConfig.codingSystemGuid);
    expect(data.codingSystemName).toBe('RDS/IEC 81346');
    expect(data.totalCodedAssets).toBe(732);
  });

  // ---- argument round-trip ---------------------------------------------

  it('forwards the separator and the level names in order', async () => {
    const response = await call(args, successReply(sampleConfig), args);

    // nock only matches when the forwarded arguments equal expectedArgs.
    expect(response.status).toBe(200);
  });

  // ---- refusals ----------------------------------------------------------

  it('surfaces the separator refusal for an aspect sign', async () => {
    const response = await call(
      { ...args, separatorChar: '+' },
      errorReply(
        -32602,
        'The separator must be one character that is not a letter, a digit, a space or an aspect sign (=, +, -, :).',
      ),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/aspect sign/i);
  });

  it('surfaces a display-code clash without changing anything', async () => {
    const response = await call(
      args,
      errorReply(-32000, "Two codes would both display as 'A.B'. Choose a separator that does not appear inside codes."),
    );

    expect(response.body.error.message).toMatch(/would both display as/i);
  });

  // ---- empty: the tool never returns an empty result; a tenant without a coding system is refused ----

  it('surfaces the refusal for a tenant without a coding system', async () => {
    const response = await call(args, errorReply(-32000, 'No coding system is configured for this tenant.'));

    expect(response.body.error).toBeDefined();
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/No coding system/i);
  });

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(args, errorReply(-32000, 'Permission denied: Coding.Update required'));

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Coding\.Update/);
  });

  // ---- regression guard: no userId / tenantId arg ----------------------

  it('does NOT expose userId or tenantId as a tool argument (identity comes from the Bearer token)', async () => {
    const response = await call(
      { ...args, userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply(sampleConfig),
    );

    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [{ name: TOOL, args }];

  describeJsonRpcCompliance(
    (name, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, toolArgs, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
