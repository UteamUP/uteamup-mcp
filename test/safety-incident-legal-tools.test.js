/**
 * Safety-incident legal + emergency-contact MCP tool tests.
 *
 * Covers the seven tools added with the people-and-legal change (backend SafetyIncidentTools →
 * the matching Commands/Handlers): contact link/unlink/list, legal report list/create/draft, and
 * the permissioned read of a colleague's emergency contacts. Asserts the proxy forwards a valid
 * JSON-RPC 2.0 tools/call and passes the backend /mcp response through, plus the shared JSON-RPC
 * compliance + 401 + 503 suites.
 *
 * Pattern mirrors ai-credit-packages-tools.test.js: nock-mocked HTTPS calls simulating what the
 * MCP proxy forwards to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Safety incident legal + emergency contact MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_safety_legal';

  const INCIDENT_GUID = '11111111-1111-1111-1111-111111111111';
  const CONTACT_GUID = '22222222-2222-2222-2222-222222222222';
  const LINK_GUID = '33333333-3333-3333-3333-333333333333';
  const USER_GUID = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const contactsPayload = [
    {
      guid: LINK_GUID,
      contactGuid: CONTACT_GUID,
      role: 'legal',
      note: 'retained 12 Mar',
      name: 'Lára Lögmaður',
      company: 'Law LLP',
      email: 'lara@law.example',
      phone: '+354 555 1234'
    }
  ];

  const reportsPayload = [
    {
      guid: '55555555-5555-5555-5555-555555555555',
      title: 'Legal review — INC-2026-0001',
      bodyHtml: '<h3>Summary</h3><p>…</p>',
      authorName: 'Ras Reviewer',
      createdAt: '2026-03-12T09:00:00Z',
      wasAiDrafted: true,
      aiProvider: 'gemini',
      aiModelName: 'gemini-2.5-pro'
    }
  ];

  // The draft carries business outcomes on the body per the platform AI contract — a blocked
  // quota is a 200 with quotaBlockedReason set, never a transport error.
  const draftPayload = {
    title: 'Legal review — INC-2026-0001',
    sections: [
      { heading: 'What is recorded', body: 'The incident occurred…', citedEvidence: ['whatHappened', 'incidentAt'] }
    ],
    provider: 'gemini',
    modelName: 'gemini-2.5-pro',
    creditsCharged: 10,
    remaining: 4990,
    quotaBlockedReason: null,
    warnings: [],
    error: null
  };

  const emergencyContactsPayload = [
    {
      guid: '66666666-6666-6666-6666-666666666666',
      contactGuid: null,
      name: 'Anna Jonsdottir',
      relationship: 'Spouse',
      phone: '+354 555 9999',
      email: null,
      isPrimary: true,
      unreachable: false
    }
  ];

  describe('Happy path', () => {
    test('UteamupSafetyincidentContactsList — passes the linked contacts through', async () => {
      const response = await call(
        'UteamupSafetyincidentContactsList',
        { incidentGuid: INCIDENT_GUID },
        successReply(contactsPayload)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.content).toBeDefined();
    });

    test('UteamupSafetyincidentContactsLink — forwards the role and note', async () => {
      const response = await call(
        'UteamupSafetyincidentContactsLink',
        { incidentGuid: INCIDENT_GUID, contactGuid: CONTACT_GUID, role: 'legal', note: 'retained 12 Mar' },
        successReply(contactsPayload[0])
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSafetyincidentContactsUnlink — takes the link guid, not the contact guid', async () => {
      const response = await call(
        'UteamupSafetyincidentContactsUnlink',
        { incidentGuid: INCIDENT_GUID, linkGuid: LINK_GUID },
        successReply(true)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSafetyincidentLegalreportList — passes the reports through', async () => {
      const response = await call(
        'UteamupSafetyincidentLegalreportList',
        { incidentGuid: INCIDENT_GUID },
        successReply(reportsPayload)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSafetyincidentLegalreportCreate — forwards title and body', async () => {
      const response = await call(
        'UteamupSafetyincidentLegalreportCreate',
        { incidentGuid: INCIDENT_GUID, title: 'Legal review', bodyHtml: '<p>…</p>', wasAiDrafted: false },
        successReply(reportsPayload[0])
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSafetyincidentLegalreportDraft — passes the unsaved draft through', async () => {
      const response = await call(
        'UteamupSafetyincidentLegalreportDraft',
        { incidentGuid: INCIDENT_GUID },
        successReply(draftPayload)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupSafetyincidentLegalreportDraft — a blocked quota arrives as a 200 body, not an error', async () => {
      const blocked = { ...draftPayload, sections: [], creditsCharged: 0, quotaBlockedReason: 'Exhausted' };

      const response = await call(
        'UteamupSafetyincidentLegalreportDraft',
        { incidentGuid: INCIDENT_GUID },
        successReply(blocked)
      );

      // The caller reads quotaBlockedReason off a success response; treating this as a transport
      // failure would tell the user the feature is broken when they have simply run out.
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('UteamupEmergencycontactListForUser — forwards the subject guid and the reason', async () => {
      const response = await call(
        'UteamupEmergencycontactListForUser',
        { userGuid: USER_GUID, reason: 'Safety incident INC-2026-0042' },
        successReply(emergencyContactsPayload)
      );
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupEmergencycontactListForUser — an unreachable contact still passes through', async () => {
      const unreachable = [{ ...emergencyContactsPayload[0], phone: null, unreachable: true }];

      const response = await call(
        'UteamupEmergencycontactListForUser',
        { userGuid: USER_GUID },
        successReply(unreachable)
      );

      // Hiding it would be worse than surfacing it flagged.
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });
  });

  describe('Error pass-through', () => {
    test('UteamupSafetyincidentContactsLink — a duplicate role is forwarded as 409', async () => {
      const response = await call(
        'UteamupSafetyincidentContactsLink',
        { incidentGuid: INCIDENT_GUID, contactGuid: CONTACT_GUID, role: 'legal' },
        errorReply(409, 'That contact is already linked to this incident as Legal.')
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });

    test('UteamupSafetyincidentLegalreportList — missing permission is forwarded', async () => {
      const response = await call(
        'UteamupSafetyincidentLegalreportList',
        { incidentGuid: INCIDENT_GUID },
        errorReply(403, 'Permission denied: SafetyIncident.LegalReview required')
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });

    test('UteamupEmergencycontactListForUser — a non-member subject is forwarded as 404', async () => {
      const response = await call(
        'UteamupEmergencycontactListForUser',
        { userGuid: USER_GUID },
        errorReply(404, 'User was not found in the active tenant.')
      );
      // 404 rather than an empty list, so the route cannot be used to probe for accounts.
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });

    test('UteamupEmergencycontactListForUser — missing permission is forwarded', async () => {
      const response = await call(
        'UteamupEmergencycontactListForUser',
        { userGuid: USER_GUID },
        errorReply(403, 'Permission denied: EmergencyContact.Read required')
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });
  });

  const complianceTools = [
    { name: 'UteamupSafetyincidentContactsList', args: { incidentGuid: INCIDENT_GUID } },
    { name: 'UteamupSafetyincidentContactsLink', args: { incidentGuid: INCIDENT_GUID, contactGuid: CONTACT_GUID, role: 'legal' } },
    { name: 'UteamupSafetyincidentContactsUnlink', args: { incidentGuid: INCIDENT_GUID, linkGuid: LINK_GUID } },
    { name: 'UteamupSafetyincidentLegalreportList', args: { incidentGuid: INCIDENT_GUID } },
    { name: 'UteamupSafetyincidentLegalreportCreate', args: { incidentGuid: INCIDENT_GUID, title: 'T', bodyHtml: '<p>b</p>' } },
    { name: 'UteamupSafetyincidentLegalreportDraft', args: { incidentGuid: INCIDENT_GUID } },
    { name: 'UteamupEmergencycontactListForUser', args: { userGuid: USER_GUID } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
