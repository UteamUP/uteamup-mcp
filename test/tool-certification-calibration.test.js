'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Tool certification and calibration MCP contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'tool-certification-calibration-token';
  const TOOL_GUID = '88888888-8888-4888-8888-888888888888';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists a tool certification by tool GUID with the tool subject', async () => {
    const response = await call(
      'UteamupAssetcertificationGetByToolGuid',
      { toolGuid: TOOL_GUID },
      successReply([{
        guid: '11111111-1111-4111-8111-111111111111',
        toolGuid: TOOL_GUID,
        toolName: 'Torque wrench',
        subjectKind: 'tool',
        name: 'Annual inspection',
      }]),
      { toolGuid: TOOL_GUID },
    );

    const [certification] = JSON.parse(response.body.result.content[0].text);
    expect(certification.subjectKind).toBe('tool');
    expect(certification.toolGuid).toBe(TOOL_GUID);
    expect(certification).not.toHaveProperty('toolId');
  });

  test('lists a tool calibration by tool GUID', async () => {
    const response = await call(
      'UteamupAssetcalibrationGetByToolGuid',
      { toolGuid: TOOL_GUID },
      successReply([{
        guid: '22222222-2222-4222-8222-222222222222',
        toolGuid: TOOL_GUID,
        subjectKind: 'tool',
        name: 'Torque calibration',
      }]),
      { toolGuid: TOOL_GUID },
    );

    const [calibration] = JSON.parse(response.body.result.content[0].text);
    expect(calibration.subjectKind).toBe('tool');
    expect(calibration).not.toHaveProperty('assetGuid');
  });

  test('forwards a toolGuid create payload unchanged and without integer keys', async () => {
    const args = {
      model: {
        toolGuid: TOOL_GUID,
        certificationType: 'Inspection',
        name: 'Sling inspection',
        frequencyType: 'Yearly',
        frequencyValue: 1,
        status: 'Active',
      },
    };

    const response = await call(
      'UteamupAssetcertificationCreate',
      args,
      successReply({ guid: '33333333-3333-4333-8333-333333333333', toolGuid: TOOL_GUID, subjectKind: 'tool' }),
      args,
    );

    const created = JSON.parse(response.body.result.content[0].text);
    expect(created.subjectKind).toBe('tool');
    expect(args.model).not.toHaveProperty('assetGuid');
    expect(args.model).not.toHaveProperty('toolId');
  });

  const tools = [
    { name: 'UteamupAssetcertificationGetByToolGuid', args: { toolGuid: TOOL_GUID } },
    { name: 'UteamupAssetcalibrationGetByToolGuid', args: { toolGuid: TOOL_GUID } },
    {
      name: 'UteamupAssetcalibrationCreate',
      args: {
        model: {
          toolGuid: TOOL_GUID,
          name: 'Torque calibration',
          frequencyType: 'Yearly',
          frequencyValue: 1,
          status: 'Scheduled',
        },
      },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
