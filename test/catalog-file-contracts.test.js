'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Catalog image, document and reporter follow-up contracts', () => {
  const baseUrl = 'https://api.uteamup.com';
  const itemGuid = '11111111-1111-4111-8111-111111111111';
  const documentGuid = '22222222-2222-4222-8222-222222222222';
  const token = 'synthetic-catalog-contract-token';
  const cases = ['Part', 'Tool', 'Chemical'].flatMap(kind => {
    const item = { [`${kind.toLowerCase()}Guid`]: itemGuid };
    return [
      { name: `Uteamup${kind}SetImageFromDocument`, args: { ...item, documentGuid } },
      { name: `Uteamup${kind}UploadImage`, args: { ...item, fileName: 'profile.png', contentType: 'image/png', base64Content: 'AQID' } },
      { name: `Uteamup${kind}AddDocument`, args: { ...item, documentGuid } },
      { name: `Uteamup${kind}RemoveDocument`, args: { ...item, documentGuid } }
    ];
  }).concat([
    { name: 'UteamupDocumentUpdate', args: { documentGuid, fileName: 'renamed.pdf' } },
    { name: 'uteamup_bug_report_add_comment', args: { reportGuid: itemGuid, message: 'Given a replacement bulb, preserve the fitting.' } },
    { name: 'UteamupPartGet', args: { partGuid: itemGuid } },
    { name: 'UteamupVendorGet', args: { vendorGuid: itemGuid } },
    { name: 'UteamupPartUpdate', args: { partGuid: itemGuid, manufacturer: 'Duracell', modelNumber: 'MN1500', sku: 'DUR-AA', unitOfMeasure: 'each', currencyGuid: documentGuid } },
    { name: 'UteamupPartCreate', args: { name: 'AA battery', value: 10, currencyGuid: documentGuid } }
  ]);
  const call = (name, args, reply, expectedArgs) => callMcpTool(baseUrl, token, name, args, reply, expectedArgs);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it.each(cases)('forwards $name with the exact public arguments', async ({ name, args }) => {
    const response = await call(name, args, successReply({ accepted: true }), args);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ accepted: true });
  });

  it('preserves original and all thumbnail sizes for a catalog image', async () => {
    const image = { original: 'https://images.example/profile/orig.jpg',
      small: 'https://images.example/profile/64.jpg', medium: 'https://images.example/profile/256.jpg',
      large: 'https://images.example/profile/512.jpg' };
    const response = await call('UteamupPartSetImageFromDocument', { partGuid: itemGuid, documentGuid }, successReply(image));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(image);
  });

  it('preserves a coded input refusal instead of reporting image replacement success', async () => {
    const response = await call('UteamupPartUploadImage', { partGuid: itemGuid, fileName: 'profile.avif',
      contentType: 'image/avif', base64Content: 'AQID' }, errorReply(-32602, 'invalid_argument: Only PNG and JPEG images are allowed.'));
    expect(response.body.error.message).toContain('invalid_argument');
  });

  it('keeps reporter replies shared and does not add internal thread data', async () => {
    const args = { reportGuid: itemGuid, message: 'Extra reproduction steps' };
    const response = await call('uteamup_bug_report_add_comment', args,
      successReply({ externalGuid: documentGuid, bodyHtml: 'Extra reproduction steps', isVisibleToReporter: true }), args);
    const reply = JSON.parse(response.body.result.content[0].text);
    expect(reply.isVisibleToReporter).toBe(true);
    expect(reply).not.toHaveProperty('internalComments');
    expect(reply).not.toHaveProperty('statusHistory');
  });

  it('does not replace a non-owner refusal with an admin operation', async () => {
    const response = await call('uteamup_bug_report_add_comment', { reportGuid: itemGuid, message: 'Follow-up' },
      errorReply(-32603, 'not_found: Bug report not found.'));
    expect(response.body.error.message).toContain('not_found');
  });

  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(baseUrl, cases);
  describe503ServiceUnavailable(baseUrl, cases);
});
