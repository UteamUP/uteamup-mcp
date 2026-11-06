/**
 * UteamupContractArchive / UteamupContractRestore and UteamupProjectArchive / UteamupProjectRestore MCP tool tests.
 *
 * Backend tools: ArchiveContractCommand / RestoreContractCommand + ContractArchiveCommandHandler, and
 * ArchiveProjectCommand / RestoreProjectCommand + ProjectArchiveCommandHandler. A contract or project with
 * history is archived instead of deleted: it leaves lists and pickers and keeps its history. A contract
 * archive sets its existing IsDeleted flag; a project archive sets Status 5 (Archived) and a restore brings it
 * back On hold (2). Both need the delete permission (Contract.Delete, Project.Delete).
 *
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Contract and project archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_contract_project_archive';

  const CONTRACT = 'cccccccc-0000-4000-8000-000000000001';
  const PROJECT = 'dddddddd-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('archives a contract and returns when it was archived', async () => {
    const response = await call(
      'UteamupContractArchive',
      { contractGuid: CONTRACT },
      successReply({ guid: CONTRACT, archivedAt: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(CONTRACT);
    expect(data.archivedAt).toBeTruthy();
  });

  it('restores a contract, clearing its archive date', async () => {
    const response = await call(
      'UteamupContractRestore',
      { contractGuid: CONTRACT },
      successReply({ guid: CONTRACT, archivedAt: null }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.archivedAt).toBeNull();
  });

  it('surfaces a missing Contract.Delete as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupContractArchive',
      { contractGuid: CONTRACT },
      errorReply(-32000, 'Permission denied: Contract.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Contract\.Delete/);
  });

  it('surfaces a contract outside the tenant as not_found', async () => {
    const response = await call(
      'UteamupContractRestore',
      { contractGuid: CONTRACT },
      errorReply(-32000, 'not_found: Contract unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('archives a project, which becomes status 5 (Archived)', async () => {
    const response = await call(
      'UteamupProjectArchive',
      { projectGuid: PROJECT },
      successReply({ guid: PROJECT, status: 5 }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(PROJECT);
    expect(data.status).toBe(5);
  });

  it('restores a project On hold, because its earlier status is not stored', async () => {
    const response = await call(
      'UteamupProjectRestore',
      { projectGuid: PROJECT },
      successReply({ guid: PROJECT, status: 2 }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.status).toBe(2);
  });

  it('surfaces a project the caller cannot see as not_found, and a concurrent change as project_changed', async () => {
    const missing = await call(
      'UteamupProjectArchive',
      { projectGuid: PROJECT },
      errorReply(-32000, 'not_found: Project unavailable.'),
    );
    const changed = await call(
      'UteamupProjectArchive',
      { projectGuid: PROJECT },
      errorReply(-32000, 'project_changed: The project changed. Read it again and retry.'),
    );

    expect(missing.body.error.message).toMatch(/not_found/);
    expect(changed.body.error.message).toMatch(/project_changed/);
  });

  it('surfaces a missing Project.Delete as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupProjectRestore',
      { projectGuid: PROJECT },
      errorReply(-32000, 'Permission denied: Project.Delete required'),
    );

    expect(response.body.error.message).toMatch(/Project\.Delete/);
  });

  const errorTools = [
    { name: 'UteamupContractArchive', args: { contractGuid: CONTRACT } },
    { name: 'UteamupContractRestore', args: { contractGuid: CONTRACT } },
    { name: 'UteamupProjectArchive', args: { projectGuid: PROJECT } },
    { name: 'UteamupProjectRestore', args: { projectGuid: PROJECT } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
