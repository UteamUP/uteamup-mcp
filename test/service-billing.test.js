/** GUID-only operational service-billing MCP proxy contracts. */

"use strict";

const nock = require("nock");
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require("./helpers/mcp-test-helpers");
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require("./helpers/mcp-error-tests");

describe("service billing MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_service_billing";
  const runGuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const invoiceGuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const agreementGuid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const customerGuid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const sourceGuid = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const priceRuleGuid = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const exportGuid = "99999999-9999-4999-8999-999999999999";
  const idempotencyKey = "11111111-1111-4111-8111-111111111111";
  const updatedAt = "2026-07-16T11:00:00Z";

  const invoice = {
    externalGuid: invoiceGuid,
    billingRunGuid: runGuid,
    agreementGuid,
    agreementTitle: "Solid Energy field service agreement",
    customerGuid,
    customerName: "Solid Energy",
    invoiceNumber: null,
    status: "draft",
    currency: "ISK",
    subtotal: 20000,
    discountTotal: 0,
    taxTotal: 4800,
    total: 24800,
    periodStart: "2026-07-01T00:00:00Z",
    periodEnd: "2026-08-01T00:00:00Z",
    createdAt: updatedAt,
    updatedAt,
    lines: [
      {
        externalGuid: "22222222-2222-4222-8222-222222222222",
        lineType: "labor",
        sourceType: "timeEntry",
        sourceGuid,
        priceRuleGuid,
        workorderGuid: "33333333-3333-4333-8333-333333333333",
        description: "Approved field labour",
        unit: "hour",
        currency: "ISK",
        quantity: 2,
        unitPrice: 10000,
        percentage: 0,
        netAmount: 20000,
        taxAmount: 4800,
        totalAmount: 24800,
        sourceOccurredAt: "2026-07-15T09:00:00Z",
        sourceUpdatedAt: "2026-07-15T10:00:00Z",
      },
    ],
  };
  const run = {
    externalGuid: runGuid,
    agreementGuid,
    agreementTitle: invoice.agreementTitle,
    customerGuid,
    customerName: invoice.customerName,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    status: "draft",
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    evidenceCollectedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
    invoice,
    exceptions: [],
  };
  const runList = { items: [run], totalCount: 1, page: 1, pageSize: 50 };
  const invoiceList = {
    items: [invoice],
    totalCount: 1,
    page: 1,
    pageSize: 50,
  };
  const runCreateModel = {
    idempotencyKey,
    agreementGuid,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
  };
  const runTransitionModel = {
    idempotencyKey,
    expectedUpdatedAt: updatedAt,
    reason: "Reviewed",
  };
  const invoiceTransitionModel = {
    idempotencyKey,
    expectedUpdatedAt: updatedAt,
    occurredAt: "2026-07-16T12:00:00Z",
  };
  const invoiceIssueModel = {
    ...invoiceTransitionModel,
    invoiceNumber: "SE-2026-0001",
  };
  const invoiceCorrectionModel = {
    ...invoiceTransitionModel,
    reason: "Reviewed correction",
  };
  const accountingExportModel = {
    idempotencyKey,
    expectedInvoiceUpdatedAt: updatedAt,
    connectorKey: "neutral-csv",
  };
  const accountingRetryModel = { idempotencyKey };
  const accountingReconcileModel = {
    idempotencyKey,
    externalReference: "ERP-1042",
    status: "accepted",
    reason: null,
  };
  const accountingReconciliation = {
    reconciliationGuid: "77777777-7777-4777-8777-777777777777",
    exportGuid,
    externalReference: accountingReconcileModel.externalReference,
    status: accountingReconcileModel.status,
    reason: null,
    reconciledAt: updatedAt,
    reconciledByGuid: "88888888-8888-4888-8888-888888888888",
  };
  const accountingExport = {
    exportGuid,
    invoiceGuid,
    retryOfExportGuid: null,
    connectorKey: "neutral-csv",
    status: "succeeded",
    fileName: "service-invoice-SE-2026-0001.csv",
    contentType: "text/csv",
    payloadHash: "0123456789abcdef",
    externalReference: "uteamup:invoice:0123456789abcdef",
    failureCode: null,
    failureReason: null,
    requestedAt: updatedAt,
    requestedByGuid: "88888888-8888-4888-8888-888888888888",
    reconciliation: accountingReconciliation,
  };
  const accountingDownload = {
    fileName: accountingExport.fileName,
    contentType: accountingExport.contentType,
    base64Data: Buffer.from("invoiceGuid,invoiceNumber\n").toString("base64"),
    fileSizeBytes: 26,
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply, args);

  test.each([
    [
      "UteamupServiceBillingRunList",
      { agreementGuid, status: "draft", page: 1, pageSize: 50 },
      runList,
    ],
    ["UteamupServiceBillingRunGet", { runGuid }, run],
    ["UteamupServiceBillingRunCreate", { model: runCreateModel }, run],
    [
      "UteamupServiceBillingRunApprove",
      { runGuid, model: runTransitionModel },
      run,
    ],
    [
      "UteamupServiceBillingRunCancel",
      { runGuid, model: runTransitionModel },
      run,
    ],
    [
      "UteamupServiceInvoiceList",
      { agreementGuid, status: "draft", page: 1, pageSize: 50 },
      invoiceList,
    ],
    ["UteamupServiceInvoiceGet", { invoiceGuid }, invoice],
    [
      "UteamupServiceInvoiceIssue",
      { invoiceGuid, model: invoiceIssueModel },
      invoice,
    ],
    [
      "UteamupServiceInvoiceSend",
      { invoiceGuid, model: invoiceTransitionModel },
      invoice,
    ],
    [
      "UteamupServiceInvoicePaid",
      { invoiceGuid, model: invoiceTransitionModel },
      invoice,
    ],
    [
      "UteamupServiceInvoiceVoid",
      { invoiceGuid, model: invoiceCorrectionModel },
      invoice,
    ],
    [
      "UteamupServiceInvoiceCredit",
      { invoiceGuid, model: invoiceCorrectionModel },
      invoice,
    ],
    ["UteamupServiceAccountingExportList", { invoiceGuid }, [accountingExport]],
    [
      "UteamupServiceAccountingExportCreate",
      { invoiceGuid, model: accountingExportModel },
      accountingExport,
    ],
    [
      "UteamupServiceAccountingExportRetry",
      { invoiceGuid, exportGuid, model: accountingRetryModel },
      accountingExport,
    ],
    [
      "UteamupServiceAccountingExportReconcile",
      { invoiceGuid, exportGuid, model: accountingReconcileModel },
      accountingReconciliation,
    ],
    [
      "UteamupServiceAccountingExportDownload",
      { invoiceGuid, exportGuid },
      accountingDownload,
    ],
  ])(
    "%s preserves reviewed GUID-safe evidence",
    async (toolName, args, data) => {
      const result = await call(toolName, args, successReply(data));
      expect(result.status).toBe(200);
      const parsed = JSON.parse(result.body.result.content[0].text);
      expect(parsed).toEqual(data);
      expect(JSON.stringify(parsed)).not.toMatch(
        /"(?:id|tenantId|runId|invoiceId|agreementId|customerId|sourceId|priceRuleId|userId)"/,
      );
      expect(args).not.toHaveProperty("tenantGuid");
      expect(args).not.toHaveProperty("userGuid");
    },
  );

  test.each([
    [
      "UteamupServiceBillingRunList",
      { page: 1, pageSize: 50 },
      {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
      },
    ],
    [
      "UteamupServiceInvoiceList",
      { page: 1, pageSize: 50 },
      {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
      },
    ],
    ["UteamupServiceAccountingExportList", { invoiceGuid }, []],
  ])(
    "%s preserves an empty page without fabricating records",
    async (toolName, args, data) => {
      const result = await call(toolName, args, successReply(data));
      expect(JSON.parse(result.body.result.content[0].text)).toEqual(data);
    },
  );

  test("preserves backend JSON-RPC errors", async () => {
    const result = await call(
      "UteamupServiceBillingRunGet",
      { runGuid },
      errorReply(-32603, "Billing evidence unavailable"),
    );
    expect(result.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: "UteamupServiceBillingRunList", args: { page: 1, pageSize: 50 } },
    { name: "UteamupServiceBillingRunGet", args: { runGuid } },
    { name: "UteamupServiceBillingRunCreate", args: { model: runCreateModel } },
    {
      name: "UteamupServiceBillingRunApprove",
      args: { runGuid, model: runTransitionModel },
    },
    {
      name: "UteamupServiceBillingRunCancel",
      args: { runGuid, model: runTransitionModel },
    },
    { name: "UteamupServiceInvoiceList", args: { page: 1, pageSize: 50 } },
    { name: "UteamupServiceInvoiceGet", args: { invoiceGuid } },
    {
      name: "UteamupServiceInvoiceIssue",
      args: { invoiceGuid, model: invoiceIssueModel },
    },
    {
      name: "UteamupServiceInvoiceSend",
      args: { invoiceGuid, model: invoiceTransitionModel },
    },
    {
      name: "UteamupServiceInvoicePaid",
      args: { invoiceGuid, model: invoiceTransitionModel },
    },
    {
      name: "UteamupServiceInvoiceVoid",
      args: { invoiceGuid, model: invoiceCorrectionModel },
    },
    {
      name: "UteamupServiceInvoiceCredit",
      args: { invoiceGuid, model: invoiceCorrectionModel },
    },
    { name: "UteamupServiceAccountingExportList", args: { invoiceGuid } },
    {
      name: "UteamupServiceAccountingExportCreate",
      args: { invoiceGuid, model: accountingExportModel },
    },
    {
      name: "UteamupServiceAccountingExportRetry",
      args: { invoiceGuid, exportGuid, model: accountingRetryModel },
    },
    {
      name: "UteamupServiceAccountingExportReconcile",
      args: { invoiceGuid, exportGuid, model: accountingReconcileModel },
    },
    {
      name: "UteamupServiceAccountingExportDownload",
      args: { invoiceGuid, exportGuid },
    },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
