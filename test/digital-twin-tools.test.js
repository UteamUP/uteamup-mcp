/** Digital twin MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('digital twin MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_digital_twin';

  const ASSET_GUID = '3f2a91c4-7b6e-4d55-9a01-0c4d2f8b1e77';
  const TWIN_GUID = '9c1b7d20-55af-4e93-8f6a-2d7e10b34c58';
  const ANCHOR_GUID = 'b41e6f38-2c9d-4a71-95b8-6e0c3f27ad19';
  const COMPONENT_GUID = 'd7a35e91-4f28-4c60-8b13-9a5f2c81e604';

  const getTool = { name: 'UteamupDigitalTwinGet', args: { assetGuid: ASSET_GUID } };
  const liveTool = { name: 'UteamupDigitalTwinLiveValues', args: { twinGuid: TWIN_GUID } };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('passes through the twin with its anchors, keyed only by GUID', async () => {
    const response = await call(getTool.name, getTool.args, successReply({
      externalGuid: TWIN_GUID,
      assetGuid: ASSET_GUID,
      assetName: 'Boiler feed pump skid',
      modelDocumentGuid: 'a2c9f471-8e15-4bd3-b0a7-51c6e8290f43',
      modelFileName: 'pump-skid.glb',
      name: 'Boiler feed pump skid',
      modelFormat: 'GLB',
      dimensionUnit: 'mm',
      upAxis: 'Z',
      triangleCount: 412000,
      anchors: [{
        externalGuid: ANCHOR_GUID,
        digitalTwinGuid: TWIN_GUID,
        targetAssetGuid: COMPONENT_GUID,
        targetAssetName: 'Suction side bearing',
        targetAssetCode: '1LBA20 CP001',
        nodeName: 'Pump_1LBA20CP001_Bearing',
        x: 120.5, y: 0, z: -40,
        markerShape: 'Sphere',
        sourceMeterGuid: 'e6b04a17-9c32-4f8d-a5e1-73f9d2c60b85',
        unit: 'C',
        warningThreshold: 70,
        criticalThreshold: 85,
        isVisible: true,
        displayOrder: 0,
      }],
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(TWIN_GUID);
    expect(data.modelFormat).toBe('GLB');
    expect(data.anchors[0].targetAssetCode).toBe('1LBA20 CP001');
    // The node name is what re-binds an anchor after a model re-upload, so it must survive the proxy.
    expect(data.anchors[0].nodeName).toBe('Pump_1LBA20CP001_Bearing');
    // Integer ids must never cross the boundary.
    expect(data.anchors[0]).not.toHaveProperty('targetAssetId');
    expect(data.anchors[0]).not.toHaveProperty('digitalTwinId');
  });

  test('passes through an asset with no twin as a null result rather than an error', async () => {
    const response = await call(getTool.name, getTool.args, successReply(null));
    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
  });

  test('passes through live values with status, source and open work order counts', async () => {
    const response = await call(liveTool.name, liveTool.args, successReply({
      digitalTwinGuid: TWIN_GUID,
      generatedAt: '2026-08-22T14:05:00Z',
      telemetryAvailable: true,
      anchors: [
        {
          anchorGuid: ANCHOR_GUID,
          targetAssetGuid: COMPONENT_GUID,
          value: 82.4,
          unit: 'C',
          observedAt: '2026-08-22T14:04:31Z',
          status: 'warning',
          source: 'telemetry',
          openWorkorderCount: 2,
          recentHistory: [
            { value: 79.1, observedAt: '2026-08-22T13:34:31Z' },
            { value: 82.4, observedAt: '2026-08-22T14:04:31Z' },
          ],
        },
        {
          anchorGuid: 'f0a1c7d5-6b23-4e88-9c41-2a7e50d3b916',
          targetAssetGuid: null,
          value: null,
          unit: null,
          observedAt: null,
          status: 'noData',
          source: null,
          openWorkorderCount: 0,
          recentHistory: [],
        },
      ],
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.telemetryAvailable).toBe(true);
    expect(data.anchors[0].status).toBe('warning');
    expect(data.anchors[0].source).toBe('telemetry');
    expect(data.anchors[0].openWorkorderCount).toBe(2);
    expect(data.anchors[0].recentHistory).toHaveLength(2);
    // An unbound anchor is reported as noData, not omitted — the marker still exists on the model.
    expect(data.anchors[1].status).toBe('noData');
  });

  test('reports telemetry as unavailable rather than failing when the tenant has no IoT', async () => {
    const response = await call(liveTool.name, liveTool.args, successReply({
      digitalTwinGuid: TWIN_GUID,
      generatedAt: '2026-08-22T14:05:00Z',
      telemetryAvailable: false,
      anchors: [{
        anchorGuid: ANCHOR_GUID,
        targetAssetGuid: COMPONENT_GUID,
        value: 61.2,
        unit: 'C',
        observedAt: '2026-08-22T13:50:00Z',
        status: 'ok',
        source: 'meter',
        openWorkorderCount: 0,
        recentHistory: [],
      }],
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    // The distinction matters: "no sensors" and "sensors you may not read" must not look identical
    // to a client, and meter-backed anchors must still report.
    expect(data.telemetryAvailable).toBe(false);
    expect(data.anchors[0].source).toBe('meter');
    expect(data.anchors[0].value).toBe(61.2);
  });

  test('passes through permission denial', async () => {
    const response = await call(
      getTool.name,
      getTool.args,
      errorReply(-32000, 'Permission denied: DigitalTwin.View required'),
    );
    expect(response.body.error.message).toMatch(/DigitalTwin\.View/i);
  });

  test('passes through the feature gate refusal', async () => {
    const response = await call(
      liveTool.name,
      liveTool.args,
      errorReply(-32000, 'Feature not enabled: Digital Twin'),
    );
    expect(response.body.error.message).toMatch(/Digital Twin/i);
  });

  const tools = [getTool, liveTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
