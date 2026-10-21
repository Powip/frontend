import axiosAuth from "@/lib/axiosAuth";
import {
  getCommercialLeadReport,
  leadReportCsv,
} from "../commercialLeadReportsService";
import type { CommercialLeadReport } from "@/types/commercialLeadReports";
import { GATEWAY } from "@/lib/gateway";
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
const report: CommercialLeadReport = {
  period: {
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    timeZone: "America/Lima",
    cohort: "RECEIVED",
    conversionBasis: "CURRENT_STATUS",
  },
  scope: { storeIds: ["store-A"], includeUnassignedStore: false },
  totals: { received: 1, open: 1, lost: 0, converted: 0, sellerConverted: 0, webPrepaidConverted: 0, legacyConverted: 0, conversionRate: 0, pipelineReceived: 1, pipelineConversionRate: 0 },
  byType: [
    {
      typeCode: "FUTURO",
      name: '=HYPERLINK("bad")',
      active: true,
      received: 1,
      pipelineReceived: 1,
      open: 1,
      lost: 0,
      converted: 0,
      conversionRate: 0,
      sellerConverted: 0,
      webPrepaidConverted: 0,
      legacyConverted: 0,
      pipelineConversionRate: 0,
    },
  ],
  bySeller: [],
  byConfirmer: [],
  amountsByCurrency: [
    {
      currency: "PEN",
      estimatedAmount: "10.00",
      convertedEstimatedAmount: "0",
    },
  ],
  daily: [],
  confirmedInPeriod: { count: 0, seller: 0, webPrepaid: 0, legacy: 0, withoutDate: 1 },
  coverage: { classifiedOrders: 1, legacyUnclassifiedOrders: 2, ordersDateBasis: "CREATED", withoutConfirmationDateScope: "ALL_SCOPED_CONVERTED_LEADS", unknownCurrencyRecords: 0 },
};
it("uses authenticated canonical report route, explicit scope, filters and abort signal", async () => {
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: report });
  const signal = new AbortController().signal;
  const params = {
    storeId: "store-A",
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
    typeCode: "FUTURO",
  };
  await expect(getCommercialLeadReport(params, signal)).resolves.toBe(report);
  expect(axiosAuth.get).toHaveBeenCalledWith(
    `${GATEWAY.ventas}/leads/reports/summary`,
    { params, signal },
  );
});
it("exports explicit cohort/currency/coverage and neutralizes configurable spreadsheet formulas", () => {
  const csv = leadReportCsv(report);
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  expect(csv).toContain('"PEN","10.00","0"');
  expect(csv).toContain("Convertidos sin fecha en todo el alcance");
  expect(csv).toContain("Cohorte");
});
