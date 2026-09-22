/**
 * Review-first tenant designation profile MCP tools. The backend owns tenant isolation,
 * canonical-aspect validation, alias ambiguity checks, review-token binding and idempotency;
 * this suite protects the generic proxy contract and exact nested payload round-trip.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('tenant coding profile review tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'tenant-coding-profile-token';
  const validateTool = 'UteamupTenantcodingProfileValidate';
  const applyTool = 'UteamupTenantcodingProfileApply';
  const proposeTool = 'UteamupTenantcodingProfileProposeFromDocuments';
  const proposeArgs = {
    documentGuids: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ],
  };
  const profile = {
    profileName: 'First Water RDS',
    context: 'Landeldi / Custom RDS',
    baseCodingSystemGuid: '11111111-1111-1111-1111-111111111111',
    aspects: [
      {
        canonicalAspect: 'Function',
        displayName: 'Function',
        preferredPrefix: '=',
        acceptedNameAliases: ['Process', 'Hlutverk'],
        acceptedPrefixAliases: ['~'],
        separator: '.',
        levels: [
          { name: 'Site' },
          { name: 'System' },
          { name: 'Functional group' },
          { name: 'Object' },
          { name: 'Device' },
        ],
      },
      {
        canonicalAspect: 'Location',
        displayName: 'Location',
        preferredPrefix: '+',
        acceptedNameAliases: ['Area'],
        acceptedPrefixAliases: [],
        separator: '.',
        levels: [
          { name: 'Site' },
          { name: 'System' },
          { name: 'Area' },
          { name: 'Space' },
        ],
      },
    ],
  };
  const fingerprint = 'a'.repeat(64);
  const reviewToken = 'actor-and-tenant-bound-review-token';
  const validateArgs = { profile };
  const applyArgs = { review: { profile, fingerprint, reviewToken } };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('validate forwards all label, prefix and alias fields and returns the review envelope', async () => {
    const reviewed = {
      isValid: true,
      fingerprint,
      reviewToken,
      reviewExpiresAtUtc: '2026-09-22T22:00:00Z',
      normalizedProfile: profile,
      errors: [],
      warnings: [],
    };
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      validateTool,
      validateArgs,
      successReply(reviewed),
      validateArgs,
    );

    expect(response.status).toBe(200);
    const value = JSON.parse(response.body.result.content[0].text);
    expect(value.isValid).toBe(true);
    expect(value.normalizedProfile.aspects[0].acceptedNameAliases).toEqual(['Process', 'Hlutverk']);
    expect(value.fingerprint).toHaveLength(64);
  });

  test('validate preserves a review-only invalid result instead of treating it as transport failure', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      validateTool,
      validateArgs,
      successReply({
        isValid: false,
        fingerprint,
        reviewToken: null,
        normalizedProfile: profile,
        errors: [{ code: 'ambiguous_prefix', path: 'aspects[1]', message: 'Prefix resolves to more than one aspect.' }],
        warnings: [],
      }),
    );

    const value = JSON.parse(response.body.result.content[0].text);
    expect(value.isValid).toBe(false);
    expect(value.reviewToken).toBeNull();
    expect(value.errors).toHaveLength(1);
  });

  test('apply forwards the exact reviewed envelope and returns an idempotent receipt', async () => {
    const receipt = {
      profile: {
        profileGuid: '22222222-2222-2222-2222-222222222222',
        tenantGuid: '33333333-3333-3333-3333-333333333333',
        ...profile,
        fingerprint,
      },
      fingerprint,
      reviewGuid: '44444444-4444-4444-4444-444444444444',
      appliedAtUtc: '2026-09-22T21:00:00Z',
      replayed: true,
    };
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      applyTool,
      applyArgs,
      successReply(receipt),
      applyArgs,
    );

    const value = JSON.parse(response.body.result.content[0].text);
    expect(value.replayed).toBe(true);
    expect(value.profile.profileName).toBe('First Water RDS');
  });

  test('apply surfaces actor/tenant token mismatch without changing the payload', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      applyTool,
      applyArgs,
      errorReply(-32000, 'The profile review token does not belong to this tenant or actor.'),
    );

    expect(response.body.error.message).toMatch(/tenant or actor/i);
  });

  test('proposal forwards multiple tenant Document GUIDs and returns source-backed review data', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      proposeTool,
      proposeArgs,
      successReply({
        proposedProfile: profile,
        sourceFingerprint: 'b'.repeat(64),
        creditsCharged: 20,
        fileOutcomes: [{ fileName: 'rules.xlsx', status: 'succeeded' }],
        evidence: [{ canonicalAspect: 'Function', excerpt: 'Function =', fileName: 'rules.xlsx' }],
      }),
      proposeArgs,
    );
    const value = JSON.parse(response.body.result.content[0].text);
    expect(value.proposedProfile.aspects[0].canonicalAspect).toBe('Function');
    expect(value.evidence[0].fileName).toBe('rules.xlsx');
    expect(value.creditsCharged).toBe(20);
  });

  test('proposal keeps empty evidence as a review result, not a transport error', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      proposeTool,
      proposeArgs,
      successReply({ proposedProfile: null, evidence: [], fileOutcomes: [], error: 'No rules found.' }),
    );
    const value = JSON.parse(response.body.result.content[0].text);
    expect(value.proposedProfile).toBeNull();
    expect(value.evidence).toEqual([]);
  });

  test('proposal surfaces permission denial', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      proposeTool,
      proposeArgs,
      errorReply(-32000, 'Coding.Update and AI.Use permissions are required.'),
    );
    expect(response.body.error.message).toMatch(/AI.Use/);
  });

  test('identity cannot be supplied as tool arguments', async () => {
    const spoofed = {
      ...validateArgs,
      tenantGuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      userId: 'spoofed-user',
    };
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      validateTool,
      spoofed,
      successReply({ isValid: true, fingerprint, reviewToken, errors: [], warnings: [] }),
      spoofed,
    );
    expect(response.status).toBe(200);
  });

  const tools = [
    { name: validateTool, args: validateArgs },
    { name: applyTool, args: applyArgs },
    { name: proposeTool, args: proposeArgs },
  ];
  describeJsonRpcCompliance(
    (name, args, reply) => callMcpTool(baseUrl, accessToken, name, args, reply),
    tools,
  );
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
