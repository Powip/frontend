import type { MetaCatalogResponse, MetaCatalogRow } from "@/services/advertisingMetaService";
import type { AdvertisingBusinessAnalytics } from "@/services/advertisingOrdersService";
import {
  advertisingMetaBusinessValues,
  advertisingMetaExtraColumns,
  advertisingMetaTableCsv,
  advertisingMetaTableValues,
} from "../advertising-meta-table-model";

const ad = {
  id: "ad",
  accountId: "account",
  level: "ad",
  name: "Anuncio",
  currency: "PEN",
  timeZone: "America/Lima",
  insights: {
    spend: "20",
    impressions: "1000",
    clicks: "25",
    actions: null,
    coverage: {
      status: "complete",
      coveredDays: 2,
      totalDays: 2,
      provisionalDays: 0,
      reconciliation: {
        status: "matched",
        comparedDays: 2,
        mismatchedDays: 0,
        missingLedgerDays: 0,
        provisionalDays: 0,
        totalDays: 2,
      },
    },
    resultMetrics: {
      webPurchases: { status: "complete", count: "8", costPerResult: "2.5" },
    },
  },
} as MetaCatalogRow;
const meta = {
  source: "meta",
  from: "2026-10-01",
  to: "2026-10-02",
  rows: [ad],
} as MetaCatalogResponse;
function analytics(basis: "created" | "delivered" | "paid"): AdvertisingBusinessAnalytics {
  return {
    source: "powip-orders",
    from: meta.from,
    to: meta.to,
    basis,
    timeZone: ad.timeZone,
    groupBy: "ad",
    storeId: "store",
    channelId: "all",
    currencies: ["PEN"],
    totalGroups: 1,
    truncated: false,
    limitations: [],
    netProfit: null,
    roas: null,
    rows: [
      {
        id: "ad",
        name: "Anuncio",
        accountId: "account",
        currency: "PEN",
        adCurrency: "PEN",
        adTimeZone: ad.timeZone,
        orderCount: 6,
        deliveredCount: 3,
        cancelledCount: 1,
        revenue: "180",
        paidRevenue: "100",
        units: null,
        incompleteCostCount: 0,
        costTotal: "20",
        contributionBeforeAds: "80",
      },
    ],
    quality: {
      basis: "created",
      from: meta.from,
      to: meta.to,
      ordersCreated: 6,
      unknownCurrencyCount: 0,
      unattributedCount: 0,
      missingDeliveredDateCount: 0,
      missingPaidDateCount: 0,
      partiallyPaidCount: 0,
      incompleteCostCount: 0,
    },
    cohortCoverage: {
      basis,
      complete: true,
      reasons: [],
      missingDeliveredDateCount: 0,
      missingPaidDateCount: 0,
    },
  };
}

it("uses confirmed events for each business metric without calling cancelled orders returns", () => {
  const values = advertisingMetaBusinessValues(
    ad,
    meta,
    {
      sales: analytics("created"),
      delivered: analytics("delivered"),
      paid: analytics("paid"),
    },
    "store",
  );
  expect(values).toMatchObject({
    sales: "6",
    delivered: "3",
    roas: "5.00×",
    returned: "Pendiente",
    leads: "Pendiente",
    platformPurchases: "8",
  });
  expect(values.platformCpa).not.toBe("Pendiente");
});

it.each([
  "period",
  "currency",
  "timezone",
  "store",
  "channel",
  "cohort",
  "truncated",
  "basis",
  "source",
  "duplicate",
  "count",
])("keeps business data pending when %s cannot be compared", (change) => {
  const delivery = analytics("delivered");
  if (change === "period") delivery.to = "2026-10-03";
  if (change === "currency") delivery.rows[0].adCurrency = "USD";
  if (change === "timezone") delivery.timeZone = "UTC";
  if (change === "store") delivery.storeId = "other";
  if (change === "channel") delivery.channelId = "channel";
  if (change === "cohort" && delivery.cohortCoverage) delivery.cohortCoverage.complete = false;
  if (change === "truncated") delivery.truncated = true;
  if (change === "basis") delivery.basis = "created";
  if (change === "source") delivery.source = "other" as "powip-orders";
  if (change === "duplicate") delivery.rows.push({ ...delivery.rows[0] });
  if (change === "count") delivery.rows[0].deliveredCount = -1;
  expect(advertisingMetaBusinessValues(ad, meta, { delivered: delivery }, "store").delivered).toBe(
    "Pendiente",
  );
});

it("does not infer zero or campaign sales from missing ad attribution", () => {
  expect(advertisingMetaBusinessValues(ad, meta, {}, "store").sales).toBe("Pendiente");
  expect(
    advertisingMetaBusinessValues(
      { ...ad, level: "campaign" },
      meta,
      { sales: analytics("created") },
      "store",
    ).sales,
  ).toBe("Pendiente");
  const partial = {
    ...ad,
    insights: {
      ...ad.insights,
      resultMetrics: {
        ...ad.insights.resultMetrics,
        webPurchases: {
          status: "partial" as const,
          count: "8",
          costPerResult: "2.5",
        },
      },
    },
  };
  expect(advertisingMetaBusinessValues(partial, meta, {}, "store").platformPurchases).toBe(
    "Pendiente",
  );
});

it("exports the specified business extras with the same headers and values as the table", () => {
  expect(advertisingMetaExtraColumns("ad").map((column) => column.label)).toEqual([
    "Leads",
    "Ventas",
    "Entregados",
    "Devueltos",
    "ROAS",
    "Meta dice",
  ]);
  expect(advertisingMetaExtraColumns("campaign").map((column) => column.label)).toEqual([
    "Ventas",
    "Entregados",
    "ROAS",
    "CPA plataforma",
  ]);
  const business = advertisingMetaBusinessValues(
    ad,
    meta,
    {
      sales: analytics("created"),
      delivered: analytics("delivered"),
      paid: analytics("paid"),
    },
    "store",
  );
  const csv = advertisingMetaTableCsv(
    [
      {
        row: ad,
        values: advertisingMetaTableValues(ad, "webPurchases", null, 3, business),
      },
    ],
    true,
    "ad",
  );
  const [headers, values] = csv.split("\r\n").map((line) => line.match(/"(?:[^"]|"")*"/g) ?? []);
  expect(values[headers.indexOf('"Ventas"')]).toBe('"6"');
  expect(values[headers.indexOf('"Devueltos"')]).toBe('"Pendiente"');
  expect(values[headers.indexOf('"ROAS"')]).toBe('"5.00×"');
  expect(headers).toHaveLength(values.length);
});

it("muestra cantidades confirmadas sin inventar ratios cuando el gasto está pendiente", () => {
  const pending = {
    ...meta,
    rows: [
      {
        ...ad,
        insights: {
          ...ad.insights,
          spend: null,
          coverage: { ...ad.insights.coverage, status: "partial" as const },
        },
      },
    ],
  };
  const values = advertisingMetaBusinessValues(
    pending.rows[0],
    pending,
    { sales: analytics("created"), delivered: analytics("delivered"), paid: analytics("paid") },
    "store",
  );
  expect(values.sales).toBe("6");
  expect(values.delivered).toBe("3");
  expect(values.roas).toBe("Pendiente");
});
it("consume campañas verificadas con igual cohorte y cuenta, sin reutilizar los grupos de anuncios", () => {
  const campaign = { ...ad, id: "campaign", level: "campaign" as const };
  const campaignMeta = { ...meta, rows: [campaign] };
  function byCampaign(basis: "created" | "delivered" | "paid") {
    const response = analytics(basis);
    return {
      ...response,
      groupBy: "campaign" as const,
      rows: [{ ...response.rows[0], id: "campaign" }],
    };
  }
  const values = advertisingMetaBusinessValues(
    campaign,
    campaignMeta,
    { sales: byCampaign("created"), delivered: byCampaign("delivered"), paid: byCampaign("paid") },
    "store",
  );
  expect(values).toMatchObject({
    sales: "6",
    delivered: "3",
    roas: "5.00×",
    returned: "Pendiente",
  });
  expect(
    advertisingMetaBusinessValues(
      campaign,
      campaignMeta,
      {
        delivered: {
          ...byCampaign("delivered"),
          rows: [{ ...byCampaign("delivered").rows[0], accountId: "foreign" }],
        },
      },
      "store",
    ).delivered,
  ).toBe("Pendiente");
});
it("usa sólo leads confirmados por Meta y conserva desconocidos si la métrica falta o es parcial", () => {
  const leads = {
    ...ad,
    insights: {
      ...ad.insights,
      resultMetrics: {
        ...ad.insights.resultMetrics,
        leads: { count: "7", costPerResult: "2.85", status: "complete" as const },
      },
    },
  };
  expect(advertisingMetaBusinessValues(leads, null, {}, "all").leads).toBe("7");
  expect(
    advertisingMetaBusinessValues(
      {
        ...leads,
        insights: {
          ...leads.insights,
          resultMetrics: {
            ...leads.insights.resultMetrics,
            leads: { ...leads.insights.resultMetrics.leads, status: "partial" },
          },
        },
      },
      null,
      {},
      "all",
    ).leads,
  ).toBe("Pendiente");
  expect(advertisingMetaBusinessValues(ad, null, {}, "all").leads).toBe("Pendiente");
});
