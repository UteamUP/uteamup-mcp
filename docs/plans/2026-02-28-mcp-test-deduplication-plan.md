# MCP Test Deduplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract duplicated test helpers and error-handling boilerplate from 12 MCP tool test files into shared modules, and normalize all files to include JSON-RPC 2.0 compliance, 401, and 503 error tests.

**Architecture:** Two new shared modules under `test/helpers/`: one for the HTTP helper + reply factories, one for error-handling test factories. Each test file imports from these instead of inlining ~40-90 lines of identical code. Files missing error tests get them via factory calls.

**Tech Stack:** Node.js, Jest, nock, CommonJS modules

---

### Task 1: Create shared test helper module

**Files:**
- Create: `test/helpers/mcp-test-helpers.js`

**Step 1: Write the helper module**

Create `test/helpers/mcp-test-helpers.js` with these exports:

```js
'use strict';

const nock = require('nock');
const https = require('https');

const TEST_BASE_URL = 'https://api.test.com';

/**
 * Send a JSON-RPC 2.0 tools/call to /mcp via nock-mocked HTTPS.
 *
 * @param {string} baseUrl    - The base URL (typically TEST_BASE_URL)
 * @param {string} accessToken - Bearer token for Authorization header
 * @param {string} toolName   - MCP tool name (e.g. 'UteamupShiftInstanceGet')
 * @param {object} toolArgs   - Tool arguments object
 * @param {{ status: number, body: object }} mockReply - nock reply config
 * @returns {Promise<{ status: number, body: object|string }>}
 */
function callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply) {
  nock(baseUrl)
    .post('/mcp', body => body.method === 'tools/call' && body.params?.name === toolName)
    .reply(mockReply.status, JSON.stringify(mockReply.body), {
      'Content-Type': 'application/json'
    });

  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: toolName, arguments: toolArgs },
    id: Math.floor(Math.random() * 10000)
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(request);
    const req = https.request(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, body: responseData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send a raw JSON-RPC request and return only the status code.
 * Used by 401/503 tests that only care about HTTP status.
 */
function sendRawRequest(baseUrl, toolName, toolArgs, id) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id: id ?? Math.floor(Math.random() * 9000) + 1000
    });

    const req = https.request(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** Build a JSON-RPC 2.0 success mock reply */
function successReply(data, id = 1) {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
      id
    }
  };
}

/** Build a JSON-RPC 2.0 error mock reply */
function errorReply(code, message, id = 1) {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      error: { code, message },
      id
    }
  };
}

module.exports = {
  TEST_BASE_URL,
  callMcpTool,
  sendRawRequest,
  successReply,
  errorReply
};
```

**Step 2: Run existing tests to confirm nothing breaks**

Run: `cd /Users/gisligudmundsson/UteamUP_Development/ActiveProjects/UteamUP_MCP && npm test`
Expected: All tests pass (the new file is not imported yet, so no impact).

**Step 3: Commit**

```
feat(test): add shared MCP test helper module
```

---

### Task 2: Create shared error-handling test factory module

**Files:**
- Create: `test/helpers/mcp-error-tests.js`

**Step 1: Write the error test factory module**

Create `test/helpers/mcp-error-tests.js`:

```js
'use strict';

const nock = require('nock');
const { sendRawRequest } = require('./mcp-test-helpers');

/**
 * Generate a "JSON-RPC 2.0 compliance" describe block.
 *
 * @param {Function} callFn - bound callMcpTool(toolName, toolArgs, mockReply)
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describeJsonRpcCompliance(callFn, tools) {
  const complianceTools = tools.map((t, i) => ({ ...t, idBase: 200 + i }));

  describe('JSON-RPC 2.0 compliance', () => {
    test.each(complianceTools)(
      '$name — response has id and result, no error (JSON-RPC 2.0 success shape)',
      async ({ name, args, idBase }) => {
        const response = await callFn(
          name,
          args,
          {
            status: 200,
            body: {
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: '{}' }] },
              id: idBase
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.body.jsonrpc).toBe('2.0');
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
        expect(response.body.id).toBe(idBase);
      }
    );
  });
}

/**
 * Generate a "401 Unauthorized handling" describe block.
 *
 * @param {string} baseUrl - test base URL
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describe401Unauthorized(baseUrl, tools) {
  describe('401 Unauthorized handling', () => {
    test.each(tools)(
      '$name — 401 response from backend is surfaced correctly',
      async ({ name, args }) => {
        nock(baseUrl)
          .post('/mcp')
          .reply(401, 'Unauthorized');

        const statusCode = await sendRawRequest(baseUrl, name, args);
        expect(statusCode).toBe(401);
      }
    );
  });
}

/**
 * Generate a "503 Service Unavailable handling" describe block.
 *
 * @param {string} baseUrl - test base URL
 * @param {Array<{ name: string, args: object }>} tools - tool definitions
 */
function describe503ServiceUnavailable(baseUrl, tools) {
  describe('503 Service Unavailable handling', () => {
    test.each(tools)(
      '$name — 503 response is surfaced correctly, not a crash',
      async ({ name, args }) => {
        nock(baseUrl)
          .post('/mcp')
          .reply(503, 'Service Unavailable');

        const statusCode = await sendRawRequest(baseUrl, name, args);
        expect(statusCode).toBe(503);
      }
    );
  });
}

module.exports = {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
};
```

**Step 2: Run existing tests to confirm nothing breaks**

Run: `cd /Users/gisligudmundsson/UteamUP_Development/ActiveProjects/UteamUP_MCP && npm test`
Expected: All tests still pass.

**Step 3: Commit**

```
feat(test): add shared error-handling test factories
```

---

### Task 3: Refactor schedule.test.js

**Files:**
- Modify: `test/schedule.test.js`

**Step 1: Add imports at top of file (after existing requires)**

Replace the inline `callMcpTool` function and the 3 error-handling describe blocks. Keep all domain-specific tests unchanged.

At the top, after `const https = require('https');`, add:
```js
const { callMcpTool: _callMcpTool, TEST_BASE_URL } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
```

**Step 2: Remove inline callMcpTool function** (approximately lines 30-75 — the entire `function callMcpTool(...)` block inside the describe)

Replace it with:
```js
  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);
```

Then find-replace all calls from `callMcpTool(` to `call(` within the file.

**Step 3: Define the shared tool list** at the bottom of the describe, before the error sections:

```js
  const allTools = [
    { name: 'UteamupScheduleGetMySchedule', args: { startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupScheduleGetTeamSchedule', args: { teamId: 1, startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupScheduleGetAvailableTechnicians', args: { date: '2026-02-24' } }
  ];
```

**Step 4: Remove the 3 inline describe blocks** (JSON-RPC compliance ~lines 567-608, 401 ~lines 613-654, 503 ~lines 659-701) and replace with:

```js
  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
```

Keep the "Permission denied handling" describe block (lines 706+) as-is — it's domain-specific.

**Step 5: Run tests**

Run: `cd /Users/gisligudmundsson/UteamUP_Development/ActiveProjects/UteamUP_MCP && npx jest test/schedule.test.js --verbose`
Expected: All tests pass with same count.

**Step 6: Commit**

```
refactor(test): extract shared helpers from schedule.test.js
```

---

### Task 4: Refactor schedule-ai-tools.test.js

**Files:**
- Modify: `test/schedule-ai-tools.test.js`

Same pattern as Task 3:
1. Add imports for helpers at top
2. Replace inline `callMcpTool` with `call` wrapper using `_callMcpTool`
3. Define `allTools` array:
```js
  const allTools = [
    { name: 'UteamupWorkforceSuggestAssignment', args: { workorderId: 1 } },
    { name: 'UteamupWorkforceGetCapacity', args: { teamId: 1, startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupWorkforceGetAvailableTechnicians', args: { date: '2026-02-24' } },
    { name: 'UteamupWorkforceExplainAssignment', args: { assignmentId: 1 } },
    { name: 'UteamupWorkforceRankTechniciansForWorkOrder', args: { workorderId: 1 } },
    { name: 'UteamupWorkforceCheckTechnicianAvailability', args: { technicianUserId: 'user-test', dateStr: '2026-03-02' } },
    { name: 'UteamupWorkforceSuggestWeekPlan', args: { teamId: 1, weekStartDate: '2026-03-02' } }
  ];
```
4. Remove 3 inline describe blocks, replace with factory calls
5. Run: `npx jest test/schedule-ai-tools.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from schedule-ai-tools.test.js`

---

### Task 5: Refactor schedule-assignment.test.js

**Files:**
- Modify: `test/schedule-assignment.test.js`

This file is special — its error handling is inside a custom `describe('Error handling', ...)` block with domain-specific tests (404, permission denied, retry-on-503). Those custom tests MUST stay. Its JSON-RPC compliance section also has a custom SSE test and a request-envelope test. Those MUST stay too.

1. Add imports for helpers at top
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupScheduleAssignmentGetWeekSchedule', args: { weekStart: '2026-03-02' } },
    { name: 'UteamupScheduleAssignmentCreate', args: { workOrderId: 42, technicianId: 'user-bob-456', scheduledStart: '2026-03-02T09:00:00', scheduledEnd: '2026-03-02T12:00:00' } },
    { name: 'UteamupScheduleAssignmentAutoAssign', args: { startDate: '2026-03-02', endDate: '2026-03-07' } },
    { name: 'UteamupScheduleAssignmentGetTechnicianSchedule', args: { technicianId: 'user-abc-123', weekStart: '2026-03-02' } },
    { name: 'UteamupScheduleAssignmentGetUnassignedWorkOrders', args: { from: '2026-03-02', to: '2026-03-07' } }
  ];
```
4. Keep the existing `describe('Error handling', ...)` and `describe('JSON-RPC 2.0 protocol compliance', ...)` blocks exactly as they are
5. **Add** factory calls at the bottom (these provide the standardized `test.each` coverage that this file currently lacks):
```js
  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
```
6. Run: `npx jest test/schedule-assignment.test.js --verbose`
7. Commit: `refactor(test): extract shared helpers from schedule-assignment.test.js`

---

### Task 6: Refactor shift-instances.test.js

**Files:**
- Modify: `test/shift-instances.test.js`

**Missing sections:** 503 (will be added via factory)

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupShiftInstanceListByRange', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupShiftInstanceGet', args: { id: 5 } },
    { name: 'UteamupShiftInstanceCreate', args: { shiftId: 1, instanceDate: '2026-03-15' } },
    { name: 'UteamupShiftInstanceUpdate', args: { id: 5, shiftId: 1, instanceDate: '2026-03-05' } },
    { name: 'UteamupShiftInstanceDelete', args: { id: 5 } },
    { name: 'UteamupShiftInstanceGenerate', args: { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: false, skipExisting: true } },
    { name: 'UteamupShiftInstanceApprove', args: { id: 5 } },
    { name: 'UteamupShiftInstanceSetStatus', args: { id: 5, status: 'InProgress' } }
  ];
```
4. Remove inline JSON-RPC compliance + 401 blocks, replace with 3 factory calls (adds 503)
5. Run: `npx jest test/shift-instances.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from shift-instances.test.js`

---

### Task 7: Refactor shift-requests.test.js

**Files:**
- Modify: `test/shift-requests.test.js`

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper. Also replace inline `successReply`/`errorReply` with imports if present.
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupShiftRequestList', args: {} },
    { name: 'UteamupShiftRequestGet', args: { id: 1 } },
    { name: 'UteamupShiftRequestCreate', args: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' } },
    { name: 'UteamupShiftRequestUpdate', args: { id: 1, reason: 'Updated' } },
    { name: 'UteamupShiftRequestDelete', args: { id: 1 } },
    { name: 'UteamupShiftRequestApprove', args: { id: 1, notes: 'Approved' } },
    { name: 'UteamupShiftRequestDeny', args: { id: 1, notes: 'Denied' } }
  ];
```
4. Remove inline 3 blocks, replace with factory calls
5. Run: `npx jest test/shift-requests.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from shift-requests.test.js`

---

### Task 8: Refactor shift-handover-acceptance.test.js

**Files:**
- Modify: `test/shift-handover-acceptance.test.js`

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupShiftHandoverAccept', args: { id: 10, notes: 'Accepted.' } },
    { name: 'UteamupShiftHandoverDeclineAcceptance', args: { id: 10, notes: 'Declined.' } },
    { name: 'UteamupShiftHandoverGetPendingAcceptances', args: {} },
    { name: 'UteamupShiftHandoverCreate', args: { shiftId: 1, outgoingOperatorId: 'user-alice-001', incomingOperatorId: 'user-bob-002', summary: 'Test.' } }
  ];
```
4. Remove inline 3 blocks, replace with factory calls
5. Run: `npx jest test/shift-handover-acceptance.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from shift-handover-acceptance.test.js`

---

### Task 9: Refactor shift-user-assignments.test.js

**Files:**
- Modify: `test/shift-user-assignments.test.js`

**Missing sections:** 503 (will be added via factory)

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper. Also replace inline `successReply` if present.
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupShiftUserAssignmentListByInstance', args: { shiftInstanceId: 5 } },
    { name: 'UteamupShiftUserAssignmentListByUserAndDate', args: { userId: 'user-alice-001', date: '2026-03-01' } },
    { name: 'UteamupShiftUserAssignmentCreate', args: { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 } },
    { name: 'UteamupShiftUserAssignmentUpdate', args: { id: 10, status: 'Confirmed' } },
    { name: 'UteamupShiftUserAssignmentDelete', args: { id: 10 } },
    { name: 'UteamupShiftUserAssignmentMarkUnavailable', args: { id: 10, reason: 'Sick leave' } }
  ];
```
4. Remove inline JSON-RPC + 401 blocks, replace with 3 factory calls (adds 503)
5. Run: `npx jest test/shift-user-assignments.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from shift-user-assignments.test.js`

---

### Task 10: Refactor tenant-holidays.test.js

**Files:**
- Modify: `test/tenant-holidays.test.js`

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupTenantHolidayListByYear', args: { year: 2026 } },
    { name: 'UteamupTenantHolidayCreate', args: { date: '2026-12-25', name: 'Christmas Day', isNational: true, countryCode: 'IS', isRecurringAnnually: true } },
    { name: 'UteamupTenantHolidayUpdate', args: { id: 1, name: 'Updated Name', isActive: true } },
    { name: 'UteamupTenantHolidayDelete', args: { id: 1 } },
    { name: 'UteamupTenantHolidayImport', args: { year: 2026, countryCode: 'IS' } }
  ];
```
4. Remove inline 3 blocks, replace with factory calls
5. Run: `npx jest test/tenant-holidays.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from tenant-holidays.test.js`

---

### Task 11: Refactor workforce-ai.test.js

**Files:**
- Modify: `test/workforce-ai.test.js`

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupWorkforceAIGetSchedulingSuggestions', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupWorkforceAIGetReplacementSuggestion', args: { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' } },
    { name: 'UteamupWorkforceAIGetWOWorkerMatches', args: { shiftInstanceId: 5 } },
    { name: 'UteamupWorkforceAIGetShiftBriefing', args: { shiftInstanceId: 5, userId: 'user-alice-001' } },
    { name: 'UteamupWorkforceAIChat', args: { query: 'test query', history: [] } }
  ];
```
4. Remove inline 3 blocks, replace with factory calls
5. Run: `npx jest test/workforce-ai.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from workforce-ai.test.js`

---

### Task 12: Refactor workforce-categories.test.js

**Files:**
- Modify: `test/workforce-categories.test.js`

**Missing sections:** 503 (will be added via factory)

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupWorkforceCategoryList', args: {} },
    { name: 'UteamupWorkforceCategoryGet', args: { id: 1 } },
    { name: 'UteamupWorkforceCategoryCreate', args: { name: 'Test', colorCode: '#000000' } },
    { name: 'UteamupWorkforceCategoryUpdate', args: { id: 1, name: 'Updated' } },
    { name: 'UteamupWorkforceCategoryDelete', args: { id: 1 } },
    { name: 'UteamupWorkforceCategoryGetMembers', args: { categoryId: 1 } },
    { name: 'UteamupWorkforceCategoryAddMember', args: { categoryId: 1, userId: 'user-001', role: 'Member' } },
    { name: 'UteamupWorkforceCategoryRemoveMember', args: { categoryId: 1, memberId: 10 } }
  ];
```
4. Remove inline JSON-RPC + 401 blocks, replace with 3 factory calls (adds 503)
5. Run: `npx jest test/workforce-categories.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from workforce-categories.test.js`

---

### Task 13: Refactor workforce-planning.test.js

**Files:**
- Modify: `test/workforce-planning.test.js`

**Missing sections:** 503 (will be added via factory)

Note: This file has a custom "request envelope" test inside its JSON-RPC compliance block. Keep that test as a standalone test, separate from the factory.

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupWorkforcePlanningGetGrid', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupWorkforcePlanningGetWorkOrders', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } }
  ];
```
4. Remove inline JSON-RPC `test.each` + 401 blocks
5. Keep the custom "request envelope" test as a standalone test
6. Add 3 factory calls (adds 503)
7. Run: `npx jest test/workforce-planning.test.js --verbose`
8. Commit: `refactor(test): extract shared helpers from workforce-planning.test.js`

---

### Task 14: Refactor labour-rate.test.js

**Files:**
- Modify: `test/labour-rate.test.js`

**Missing sections:** All 3 (JSON-RPC, 401, 503 — all will be added via factory)

1. Add imports
2. Replace inline `callMcpTool` with `call` wrapper
3. Define `allTools`:
```js
  const allTools = [
    { name: 'UteamupLabourRateGetMyEffectiveRate', args: {} },
    { name: 'UteamupLabourRateGetRules', args: {} },
    { name: 'UteamupLabourRateGetModifiers', args: {} },
    { name: 'UteamupLabourRateCreateModifier', args: { name: 'Test', rateDefinitionType: 'Flat', rateValue: 25.00 } },
    { name: 'UteamupLabourRateUpdateModifier', args: { id: 1, name: 'Updated', rateDefinitionType: 'Flat', rateValue: 30.00 } },
    { name: 'UteamupLabourRateDeleteModifier', args: { id: 1 } }
  ];
```
4. Add 3 factory calls at the bottom of the describe (before closing `});`)
5. Run: `npx jest test/labour-rate.test.js --verbose`
6. Commit: `refactor(test): extract shared helpers from labour-rate.test.js`

---

### Task 15: Run full test suite and verify

**Step 1: Run all MCP tests**

Run: `cd /Users/gisligudmundsson/UteamUP_Development/ActiveProjects/UteamUP_MCP && npm test`
Expected: All tests pass. Test count should be HIGHER than before (due to added 503 tests for 4 files and all 3 sections for labour-rate).

**Step 2: Count lines to verify reduction**

Run: `wc -l test/*.test.js test/helpers/*.js | sort -rn | head -20`
Expected: Total lines significantly lower than original 16,788.

**Step 3: Commit (if needed — squash fixups)**

If any fixes were needed, commit them:
```
fix(test): address test failures from deduplication refactor
```
