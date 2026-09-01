'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Meter reading statutory-ledger MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'meter-statutory-token';
  const assetGuid = '3e1cd135-07d1-46ff-8f5f-549da5390e78';
  const attributeDefinitionGuid = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const readingGuid = 'b2c3d4e5-f6a7-4b5c-8d7e-9f0a1b2c3d4e';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('statutory record returns legal status and context provenance', async () => {
    const response = await call(
      'UteamupMeterreadingRecordStatutory',
      {
        assetGuid,
        attributeDefinitionGuid,
        request: { readingValue: 84213, context: 'rentalCheckout' },
      },
      successReply({
        externalGuid: readingGuid,
        assetGuid,
        attributeDefinitionGuid,
        readingValue: 84213,
        legalStatus: 'statutory',
        statutoryContext: 'rentalCheckout',
        quality: 'normal',
        meterGeneration: 0,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.legalStatus).toBe('statutory');
    expect(result.statutoryContext).toBe('rentalCheckout');
    expect(result).not.toHaveProperty('id');
  });

  test('correction returns the new chain row, never a mutated original', async () => {
    const response = await call(
      'UteamupMeterreadingCorrect',
      { assetGuid, readingGuid, request: { correctedValue: 84231, notes: 'transposed digits' } },
      successReply({
        externalGuid: 'c3d4e5f6-a7b8-4c5d-8e7f-0a1b2c3d4e5f',
        assetGuid,
        readingValue: 84231,
        quality: 'normal',
        correctionOfGuid: readingGuid,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.correctionOfGuid).toBe(readingGuid);
    expect(result.readingValue).toBe(84231);
  });

  test('meter replacement bumps the generation', async () => {
    const response = await call(
      'UteamupMeterreadingReplaceMeter',
      { assetGuid, attributeDefinitionGuid, request: { initialValue: 0, notes: 'cluster swap' } },
      successReply({
        externalGuid: 'd4e5f6a7-b8c9-4d5e-8f7a-1b2c3d4e5f6a',
        assetGuid,
        readingValue: 0,
        meterGeneration: 1,
        quality: 'normal',
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.meterGeneration).toBe(1);
  });

  test('permission denials surface unchanged', async () => {
    const response = await call(
      'UteamupMeterreadingRecordStatutory',
      { assetGuid, attributeDefinitionGuid, request: { readingValue: 1, context: 'periodicCadence' } },
      errorReply(-32603, 'Permission denied: MeterReading.Update required'),
    );

    expect(response.body.error.message).toContain('MeterReading.Update');
  });

  const tools = [
    {
      name: 'UteamupMeterreadingRecordStatutory',
      args: { assetGuid, attributeDefinitionGuid, request: { readingValue: 84213, context: 'periodicCadence' } },
    },
    {
      name: 'UteamupMeterreadingCorrect',
      args: { assetGuid, readingGuid, request: { correctedValue: 84231 } },
    },
    {
      name: 'UteamupMeterreadingReplaceMeter',
      args: { assetGuid, attributeDefinitionGuid, request: { initialValue: 0 } },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
