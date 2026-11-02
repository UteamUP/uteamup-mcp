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
    { name: 'UteamupPartCreate', args: { name: 'AA battery', value: 10, currencyGuid: documentGuid } },
    { name: 'GetInventoryItem', args: { itemGuid, itemType: 'Part' } },
    { name: 'UpdateInventoryItem', args: { itemGuid, itemType: 'Part', description: 'Corrected specification' } },
    { name: 'UteamupStockCreateItem', args: { stockGuid: itemGuid, partGuid: documentGuid, type: 'Part',
      name: 'Bulk material', minimumAmount: 1, maximumAmount: 10, initialStock: 1.234567 } },
    { name: 'uteamup_product_web_files_import', args: { itemKind: 'Part', itemGuid,
      url: 'https://images.example/photo.png', setAsProfileImage: true } }
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

  it('preserves an ambiguous legacy inventory identifier refusal', async () => {
    const response = await call('UpdateInventoryItem', { id: 5, name: 'Changed' },
      errorReply(-32602, 'invalid_argument: The inventory identifier is ambiguous. Pass itemGuid and itemType.'));
    expect(response.body.error.message).toContain('ambiguous');
    expect(response.body.error.message).toContain('itemGuid');
  });

  it('preserves a duplicate single stock item refusal', async () => {
    const response = await call('UteamupStockCreateItem', { stockGuid: itemGuid, partGuid: documentGuid,
      type: 'Part', name: 'Existing catalog item' }, errorReply(-32603, 'duplicate_resource: This location already contains that part.'));
    expect(response.body.error.message).toContain('duplicate_resource');
  });

  it('returns profile URLs only after an explicit successful web import', async () => {
    const args = { itemKind: 'Part', itemGuid, url: 'https://images.example/photo.png', setAsProfileImage: true };
    const image = { url: 'https://images.example/profile/256.jpg', original: 'https://images.example/profile/orig.jpg' };
    const response = await call('uteamup_product_web_files_import', args,
      successReply({ documentGuid, attachedToItem: true, image }), args);
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ documentGuid, attachedToItem: true, image });
  });

  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(baseUrl, cases);
  describe503ServiceUnavailable(baseUrl, cases);
});
