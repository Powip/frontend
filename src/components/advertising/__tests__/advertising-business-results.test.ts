import type { MetaCatalogResponse } from "@/services/advertisingMetaService";
import type {
  AdvertisingBusinessAnalytics,
  AdvertisingBusinessRow,
} from "@/services/advertisingOrdersService";
import {
  businessResult,
  divideOrderDecimals,
  subtractOrderDecimals,
} from "../advertising-business-results";
import { metaCoverageLabel } from "../advertising-meta-model";
import { financeInputValue, formatOrderAmount } from "../advertising-orders-model";

const row: AdvertisingBusinessRow = {
  id: "123",
  name: "Anuncio",
  accountId: "account",
  adCurrency: "PEN",
  adTimeZone: "America/Lima",
  currency: "PEN",
  orderCount: 2,
  deliveredCount: 2,
  cancelledCount: 0,
  revenue: "100.00",
  paidRevenue: "100.00",
  units: null,
  incompleteCostCount: 0,
  costTotal: "40.00",
  contributionBeforeAds: "60.00",
};
const analytics: AdvertisingBusinessAnalytics = {
  source: "powip-orders",
  from: "2026-10-01",
  to: "2026-10-10",
  timeZone: "America/Lima",
  basis: "paid",
  groupBy: "ad",
  rows: [row],
  currencies: ["PEN"],
  totalGroups: 1,
  truncated: false,
  quality: {
    basis: "created",
    from: "2026-10-01",
    to: "2026-10-10",
    ordersCreated: 2,
    unknownCurrencyCount: 0,
    unattributedCount: 0,
    missingDeliveredDateCount: 0,
    missingPaidDateCount: 0,
    partiallyPaidCount: 0,
    incompleteCostCount: 0,
  },
  limitations: [],
  netProfit: null,
  roas: null,
};
const meta = {
  source: "meta",
  from: analytics.from,
  to: analytics.to,
  rows: [
    {
      id: "123",
      accountId: "account",
      level: "ad",
      name: "Anuncio",
      currency: "PEN",
      timeZone: "America/Lima",
      insights: {
        spend: "20.00",
        coverage: {
          status: "complete",
          coveredDays: 10,
          totalDays: 10,
          provisionalDays: 0,
          reconciliation: {
            status: "matched",
            comparedDays: 10,
            mismatchedDays: 0,
            missingLedgerDays: 0,
            provisionalDays: 0,
            totalDays: 10,
          },
        },
        impressions: null,
        clicks: null,
        actions: null,
      },
    },
  ],
} as MetaCatalogResponse;

it("compares confirmed paid orders and keeps delivery costs in the delivery basis", () => {
  expect(businessResult(row, analytics, meta)).toMatchObject({
    spend: "20.00",
    paidRoas: "5.00",
    contributionAfterAds: "40.00",
    cpe: null,
  });
  expect(businessResult(row, { ...analytics, basis: "delivered" }, meta)).toMatchObject({
    cpe: "10.000000",
    paidRoas: null,
    contributionAfterAds: null,
  });
});
it.each([
  { ...analytics, timeZone: "UTC" },
  { ...analytics, from: "2026-09-01" },
  { ...analytics, truncated: true },
])("does not compare periods, zones or truncated aggregates that are incompatible", (data) => {
  expect(businessResult(row, data, meta).paidRoas).toBeNull();
  expect(businessResult(row, data, meta).spend).toBeNull();
});
it("never invents spend, a currency or a missing cost", () => {
  expect(businessResult(row, analytics, null).spend).toBeNull();
  expect(businessResult({ ...row, currency: null }, analytics, meta).paidRoas).toBeNull();
  expect(businessResult({ ...row, currency: "USD" }, analytics, meta).paidRoas).toBeNull();
  expect(
    businessResult(
      { ...row, incompleteCostCount: 1, contributionBeforeAds: null },
      analytics,
      meta,
    ),
  ).toMatchObject({ paidRoas: "5.00", contributionAfterAds: null });
});
it("does not calculate with partial or provisional Meta coverage", () => {
  const partial = {
    ...meta,
    rows: [
      {
        ...meta.rows[0],
        insights: {
          ...meta.rows[0].insights,
          coverage: {
            ...meta.rows[0].insights.coverage,
            status: "partial" as const,
            coveredDays: 9,
          },
        },
      },
    ],
  };
  expect(businessResult(row, analytics, partial).spend).toBeNull();
  const provisional = {
    ...meta,
    rows: [
      {
        ...meta.rows[0],
        insights: {
          ...meta.rows[0].insights,
          coverage: { ...meta.rows[0].insights.coverage, provisionalDays: 1 },
        },
      },
    ],
  };
  expect(businessResult(row, analytics, provisional).paidRoas).toBeNull();
});
it.each(["mismatch", "pending", undefined] as const)(
  "blocks financial metrics until account and ad spend match (%s)",
  (status) => {
    const data = {
      ...meta,
      rows: [
        {
          ...meta.rows[0],
          insights: {
            ...meta.rows[0].insights,
            coverage: {
              ...meta.rows[0].insights.coverage,
              reconciliation: status
                ? {
                    status,
                    comparedDays: 10,
                    totalDays: 10,
                    mismatchedDays: status === "mismatch" ? 1 : 0,
                    missingLedgerDays: 0,
                    provisionalDays: 0,
                  }
                : undefined,
            },
          },
        },
      ],
    };
    expect(businessResult(row, analytics, data)).toMatchObject({
      spend: null,
      cpe: null,
      paidRoas: null,
      contributionAfterAds: null,
      reason: status === "mismatch" ? "Gasto por revisar" : "Gasto por confirmar",
    });
  },
);
it.each([
  { comparedDays: 9 },
  { totalDays: 9 },
  { mismatchedDays: 1 },
  { missingLedgerDays: 1 },
  { provisionalDays: 1 },
])("fails closed for inconsistent matched reconciliation counts (%j)", (override) => {
  const coverage = meta.rows[0].insights.coverage;
  const invalid = {
    ...coverage,
    reconciliation: {
      status: "matched" as const,
      comparedDays: 10,
      mismatchedDays: 0,
      missingLedgerDays: 0,
      provisionalDays: 0,
      totalDays: 10,
      ...override,
    },
  };
  const data = {
    ...meta,
    rows: [
      {
        ...meta.rows[0],
        insights: {
          ...meta.rows[0].insights,
          coverage: invalid,
        },
      },
    ],
  };
  expect(metaCoverageLabel(invalid)).toBe("Gasto por confirmar");
  expect(businessResult(row, analytics, data)).toMatchObject({
    spend: null,
    cpe: null,
    paidRoas: null,
    contributionAfterAds: null,
    reason: "Gasto por confirmar",
  });
});
it("never reconciles zero days or a different inclusive reporting period", () => {
  const coverage = meta.rows[0].insights.coverage;
  const zero = {
    ...coverage,
    totalDays: 0,
    coveredDays: 0,
    reconciliation: {
      status: "matched" as const,
      comparedDays: 0,
      totalDays: 0,
      mismatchedDays: 0,
      missingLedgerDays: 0,
      provisionalDays: 0,
    },
  };
  expect(metaCoverageLabel(zero)).toBe("Gasto por confirmar");
  const differentPeriod = {
    ...meta,
    rows: [
      {
        ...meta.rows[0],
        insights: {
          ...meta.rows[0].insights,
          coverage: {
            ...coverage,
            totalDays: 9,
            coveredDays: 9,
            reconciliation: {
              status: "matched" as const,
              comparedDays: 9,
              totalDays: 9,
              mismatchedDays: 0,
              missingLedgerDays: 0,
              provisionalDays: 0,
            },
          },
        },
      },
    ],
  };
  expect(businessResult(row, analytics, differentPeriod).paidRoas).toBeNull();
});
it("shows review or pending labels without implying a completed financial check", () => {
  const coverage = meta.rows[0].insights.coverage;
  expect(metaCoverageLabel(coverage)).toBe("Datos completos");
  expect(
    metaCoverageLabel({
      ...coverage,
      reconciliation: {
        status: "mismatch",
        comparedDays: 10,
        mismatchedDays: 1,
        missingLedgerDays: 0,
        provisionalDays: 0,
        totalDays: 10,
      },
    }),
  ).toBe("Gasto por revisar");
  expect(metaCoverageLabel({ ...coverage, reconciliation: undefined })).toBe("Gasto por confirmar");
});
it("does not divide by zero or show profit for cancelled orders", () => {
  const zero = {
    ...meta,
    rows: [{ ...meta.rows[0], insights: { ...meta.rows[0].insights, spend: "0.00" } }],
  };
  expect(businessResult(row, analytics, zero).paidRoas).toBeNull();
  expect(
    businessResult({ ...row, cancelledCount: 1 }, analytics, meta).contributionAfterAds,
  ).toBeNull();
  expect(
    businessResult({ ...row, deliveredCount: 0 }, { ...analytics, basis: "delivered" }, meta).cpe,
  ).toBeNull();
});
it("keeps decimal arithmetic exact for large amounts and negative results", () => {
  expect(subtractOrderDecimals("9007199254740993.19", "9007199254740993.29")).toBe("-0.10");
  expect(divideOrderDecimals("9007199254740993.00", "3", 2)).toBe("3002399751580331.00");
  expect(formatOrderAmount("-0.10", "PEN")).toMatch(/−.*0.10/);
});
it("distinguishes a blank review from a confirmed zero", () => {
  expect(financeInputValue(" ")).toBeNull();
  expect(financeInputValue("0")).toBe("0");
  expect(formatOrderAmount(null, "PEN")).toBe("Pendiente");
  expect(formatOrderAmount("0.00", null)).toBe("Sin moneda");
});
