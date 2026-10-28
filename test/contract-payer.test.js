'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Contract payer attribution', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  test.each([
    { payerType: 'Company' },
    { payerType: 'Private', payerName: 'Named individual' },
    { payerType: 'External', payerName: 'Named organization' },
    { payerType: '', payerName: null },
    {},
  ])('preserves payer attribution and explicit clearing through the proxy: %j', async payer => {
    const contractGuid = '11111111-1111-4111-8111-111111111111';
    const model = { title: 'Maintenance agreement', currency: 'ISK', ...payer };
    const args = { contractGuid, model };
    const response = await callMcpTool('https://api.uteamup.com', 'test-token',
      'UteamupContractUpdateByGuid', args, successReply({ externalGuid: contractGuid, ...payer }), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ externalGuid: contractGuid, ...payer });
    expect(nock.isDone()).toBe(true);
  });
});
