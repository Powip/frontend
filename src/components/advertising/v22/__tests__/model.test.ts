import type {
  AdsRules,
  AdsRow,
  AdsSales,
  AdsSummary,
  AdsProduct,
  SalesMetric,
} from "@/services/advertisingV22Service";
import {
  adFinancial,
  adAge,
  comparisonPeriod,
  creativeAverage,
  diagnosis,
  emptySales,
  financial,
  monthlyModel,
  productFinancialRows,
  sumSales,
  summarize,
  channelData,
  channelRow,
  adStatus,
  canScale,
  profitUsage,
  trafficLight,
} from "../model";

const rules: AdsRules = {
  noResultsDays: 3,
  minSpend: "60",
  nearLimitPct: 70,
  highFrequency: 3.5,
  winPct: 60,
  testMultiplier: 2,
  testMinSales: 3,
};
it("requires observed delivery days rather than treating calendar age as activity", () => {
  const ad = { firstDeliveryDate: "2026-10-01" } as AdsRow;
  expect(adAge(ad, "2026-10-16")).toBeNull();
  expect(adAge({ ...ad, daysActive: 3 }, "2026-10-16")).toBe(3);
});
const metrics = (changes: Partial<SalesMetric> = {}): SalesMetric => ({
  ...emptySales(),
  eligibleDelivered: 0,
  eligibleDeliveredUnits: 0,
  inTransitRevenue: "0",
  inTransitProductCost: "0",
  inTransitShippingCost: "0",
  ...changes,
});
function summary(): AdsSummary {
  return {
    source: "powip-advertising-v22",
    from: "2026-10-01",
    to: "2026-10-16",
    today: "2026-10-16",
    timeZone: "America/Lima",
    currency: "PEN",
    stores: [{ id: "store", name: "Tienda" }],
    channels: [],
    days: [1, 2, 16].map((day) => ({
      date: `2026-10-${String(day).padStart(2, "0")}`,
      accountId: "account",
      adId: "ad",
      adsetId: "set",
      campaignId: "campaign",
      storeId: "store",
      channel: "web",
      currency: "PEN",
      spend: "100",
      results: 10,
      impressions: "2000",
      linkClicks: "100",
      provisional: day === 16,
    })),
    unassignedSpend: "0",
    adProducts: [],
    settings: {
      version: 1,
      rules,
      budgets: [{ storeId: "store", month: "2026-10", amount: "1000" }],
      whatsapp: { enabled: false, time: "08:00", numbers: [], includes: [] },
      permissions: [],
      tags: { hooks: [], creators: [] },
      capabilities: { view: true, spend: true, profit: true, edit: true, configure: true },
    },
    quality: { warnings: [] },
  };
}
function sales(): AdsSales {
  const total = metrics({
    orders: 12,
    confirmed: 10,
    delivered: 6,
    inTransit: 4,
    units: 18,
    deliveredUnits: 9,
    eligibleDelivered: 6,
    eligibleDeliveredUnits: 9,
    billedRevenue: "600",
    eligibleRevenue: "600",
    eligibleProductCost: "180",
    eligibleShippingCost: "60",
    inTransitRevenue: "400",
    inTransitProductCost: "120",
    inTransitShippingCost: "40",
  });
  return {
    source: "powip-orders-v22",
    from: "2026-10-01",
    to: "2026-10-16",
    currency: "PEN",
    totals: total,
    byStore: [{ ...total, storeId: "store" }],
    byChannel: [{ ...total, storeId: "store", channel: "web" }],
    byAd: [],
    byProduct: [],
    daily: [{ ...total, storeId: "store", channel: "web", date: "2026-10-01" }],
    deliveryHistory: [{ storeId: "store", deliveryRate: 0.75 }],
    productVelocity: [],
    quality: {},
  };
}
const row = (changes: Partial<AdsRow> = {}): AdsRow => ({
  id: "ad",
  accountId: "account",
  campaignId: "campaign",
  adsetId: "set",
  level: "ad",
  name: "Video",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  objective: "SALES",
  currency: "PEN",
  timeZone: "America/Lima",
  store: { id: "store", name: "Tienda" },
  creative: { format: "video" },
  insights: {
    spend: "300",
    impressions: "2000",
    clicks: "100",
    actions: [],
    inlineLinkClicks: "100",
    ctr: "5",
    frequency: "1.5",
    video3s: "1000",
    thruplay: "500",
    resultMetrics: {
      messages: { count: "0", costPerResult: null, status: "complete" },
      webPurchases: { count: "30", costPerResult: "10", status: "complete" },
    },
    coverage: {
      status: "complete",
      coveredDays: 16,
      totalDays: 16,
      provisionalDays: 1,
      lastSuccessfulAt: null,
      lastErrorCode: null,
    },
  },
  ...changes,
});

describe("Publicidad v2.2 financial contract", () => {
  it("classifies a known zero or negative margin as losing money when selling still costs money", () => {
    for (const maximum of [0, -10]) {
      const value = {
        ...financial(30, metrics({ delivered: 3, eligibleDelivered: 3 }), null),
        maximum,
        costSale: 10,
      };
      expect(adStatus(row({ daysActive: 5 }), value, rules, "2026-10-16", 3)).toBe("Pierdes plata");
      expect(trafficLight(profitUsage(10, maximum)).label).toBe("Pierdes plata");
    }
  });
  it("does not publish a product gain when no product cost is known", () => {
    expect(
      financial(100, metrics({ delivered: 2, missingCostOrders: 2, eligibleDelivered: 0 }), 0.8)
        .gain,
    ).toBeNull();
  });
  it("uses the configured frequency threshold in the creative diagnosis", () => {
    const candidate = row();
    candidate.insights.frequency = "4";
    const average = { hook: 0.5, hold: 0.5, ctr: 5, conversion: 0.3 };
    expect(diagnosis(candidate, average, 0.3, 5).label).toContain("Funciona");
    expect(diagnosis(candidate, average, 0.3, 3).label).toContain("Se está cansando");
  });
  it("keeps unsynchronized spend unknown instead of turning an empty response into zero", () => {
    const source = summary();
    source.days = [];
    source.quality.coverage = "pending";
    expect(summarize(source, sales(), "store").spend).toBeNull();
    expect(monthlyModel(source, sales(), "store", "2026-10").forecast).toBeNull();
    expect(monthlyModel(source, sales(), "store", "2026-10").days[0].cumulativeGain).toBeNull();
    for (const week of monthlyModel(source, sales(), "store", "2026-10").weeks) {
      expect(week.spend).toBeNull();
      expect(week.gain).toBeNull();
      expect(week.projectedGain).toBeNull();
      expect(week.cumulativeSpend).toBeNull();
      expect(week.cumulativeGain).toBeNull();
    }
  });
  it("uses company product names across commercial stores and warehouse stock owners", () => {
    const orders = sales();
    orders.byProduct = [
      { ...metrics({ delivered: 2, eligibleDelivered: 2 }), productId: "shared", storeId: "store" },
      { ...metrics({ delivered: 1, eligibleDelivered: 1 }), productId: "shared", storeId: "other" },
    ];
    const catalog = [
      {
        id: "shared",
        name: "Producto compartido",
        storeId: "warehouse",
        unitCost: "10",
        netPrice: null,
        availableStock: "20",
        variants: [],
      },
    ] as AdsProduct[];
    const rows = productFinancialRows(summary(), orders, catalog, "all");
    expect(rows.map((row) => [row.name, row.storeId, row.delivered])).toEqual([
      ["Producto compartido", "store", 2],
      ["Producto compartido", "other", 1],
    ]);
  });
  it("shows reconciled spend while today's metrics remain provisional", () => {
    const source = summary();
    source.quality = {
      warnings: ["CURRENT_DAY_PROVISIONAL"],
      coverage: "partial",
      spendAvailable: true,
    };
    const month = monthlyModel(source, sales(), "store", "2026-10");
    expect(month.total.spend).toBe(300);
    expect(month.days[0].spend).toBe(100);
    expect(month.weeks[0].spend).toBe(200);
    expect(month.weeks[0].gain).toBe(160);
  });
  it("keeps a weekly subtotal and its profit unknown when any contributing day is unknown", () => {
    const source = summary();
    source.quality.spendAvailable = true;
    source.days[1].spend = null;
    const month = monthlyModel(source, sales(), "store", "2026-10");
    expect(month.weeks[0].spend).toBeNull();
    expect(month.weeks[0].gain).toBeNull();
    expect(month.weeks[0].projectedGain).toBeNull();
    expect(month.weeks.at(-1)?.cumulativeGain).toBeNull();
  });
  it("projects each store with its own delivery rate before adding stores", () => {
    const source = sales();
    source.byChannel = [
      {
        ...metrics({
          orders: 1,
          delivered: 1,
          eligibleDelivered: 1,
          billedRevenue: "100",
          eligibleRevenue: "100",
          eligibleProductCost: "20",
          eligibleShippingCost: "10",
        }),
        storeId: "store",
        channel: "web",
      },
      {
        ...metrics({
          orders: 100,
          inTransit: 100,
          inTransitUnits: 100,
          inTransitRevenue: "10000",
          inTransitProductCost: "2000",
          inTransitShippingCost: "1000",
        }),
        storeId: "second",
        channel: "web",
      },
    ];
    source.deliveryHistory = [
      { storeId: "store", deliveryRate: 1 },
      { storeId: "second", deliveryRate: 0 },
    ];
    expect(summarize(summary(), source, "all").projectedSales).toBe(1);
    expect(summarize(summary(), source, "all").projectedGain).toBe(-230);
  });
  it("does not estimate the same delivered orders again when attribution is partial", () => {
    const source = sales();
    source.totals.attributedOrders = 1;
    source.byAd = [
      {
        ...metrics({
          delivered: 1,
          eligibleDelivered: 1,
          billedRevenue: "100",
          eligibleRevenue: "100",
          eligibleProductCost: "20",
          eligibleShippingCost: "10",
          attributedOrders: 1,
        }),
        adId: "ad",
        storeId: "store",
        channel: "web",
      },
    ];
    expect(adFinancial(row(), summary(), source).delivered).toBe(1);
    expect(adFinancial(row({ id: "another" }), summary(), source).delivered).toBe(0);
  });
  it("filters mixed campaigns before calculating spend, sales and exported metrics", () => {
    const raw = summary();
    raw.days[0].channel = "messages";
    const source = sales();
    source.byChannel.push({
      ...metrics({ delivered: 2, eligibleDelivered: 2 }),
      storeId: "store",
      channel: "messages",
    });
    const scoped = channelData(raw, source, "web");
    const campaign = channelRow(row({ id: "campaign", level: "campaign" }), raw, "web");
    expect(campaign.insights.spend).toBe("200");
    expect(campaign.insights.frequency).toBeNull();
    expect(adFinancial(campaign, scoped.summary, scoped.sales).delivered).toBe(6);
  });
  it("compares month-to-date with the same elapsed days of the previous month", () => {
    expect(comparisonPeriod("2026-10-01", "2026-10-31", "2026-10-16")).toEqual({
      from: "2026-09-01",
      to: "2026-09-16",
      effectiveTo: "2026-10-16",
    });
    expect(comparisonPeriod("2026-09-01", "2026-09-30", "2026-10-16")).toEqual({
      from: "2026-08-01",
      to: "2026-08-30",
      effectiveTo: "2026-09-30",
    });
  });
  it("keeps real cost beside projected cost and projects with actual transit revenue and costs", () => {
    const value = financial(300, sales().totals, 0.75);
    expect(value.costSale).toBe(50);
    expect(value.projectedCost).toBeCloseTo(300 / 9);
    expect(value.maximum).toBe(60);
    expect(value.gain).toBe(60);
    expect(value.projectedGain).toBe(240);
    expect(value.projectedRoas).toBe(3);
  });
  it("does not fabricate projections when delivery history or a product cost is missing", () => {
    expect(financial(300, sales().totals, null).projectedCost).toBeNull();
    expect(
      financial(
        300,
        metrics({ delivered: 2, eligibleDelivered: 2, eligibleProductCost: null }),
        0.7,
      ).maximum,
    ).toBeNull();
  });
  it("uses only elapsed calendar days for spend forecast and only settled order days as closed", () => {
    const month = monthlyModel(summary(), sales(), "store", "2026-10");
    expect(month.dailyAverage).toBeCloseTo(200 / 15);
    expect(month.forecast).toBeCloseTo(300 + (200 / 15) * 15);
    expect(month.days).toHaveLength(31);
    expect(month.closedDays).toBe(14);
    expect(month.profitableDays).toBe(13);
  });
  it("uses delivered sales of the same channel and period for ad estimates", () => {
    const value = adFinancial(row(), summary(), sales());
    expect(value.delivered).toBe(6);
    expect(value.costSale).toBe(50);
    expect(value.roas).toBe(2);
  });
  it("uses observed net product revenue instead of the catalog list price", () => {
    const source = sales();
    source.byProduct = [
      {
        ...metrics({ billedRevenue: "600", billedUnits: 6 }),
        storeId: "store",
        channel: "web",
        productId: "product",
      },
    ];
    const value = adFinancial(row(), summary(), source, {
      id: "product",
      name: "Producto",
      storeId: "store",
      netPrice: "1000",
      unitCost: "40",
      availableStock: "100",
      variants: [],
    });
    expect(value.maximum).toBe(80);
  });
  it.each([
    { unitCost: null, ownNet: true },
    { unitCost: "40", ownNet: false },
    { unitCost: null, ownNet: false },
  ])(
    "keeps a specific product margin unknown without its own observed net revenue and cost: %o",
    ({ unitCost, ownNet }) => {
      const source = sales();
      source.byProduct = [
        {
          ...metrics({ billedRevenue: "600", billedUnits: 6 }),
          storeId: "store",
          channel: "web",
          productId: "other",
        },
        ...(ownNet
          ? [
              {
                ...metrics({ billedRevenue: "300", billedUnits: 3 }),
                storeId: "store",
                channel: "web" as const,
                productId: "product",
              },
            ]
          : []),
      ];
      const candidate = row({
        daysActive: 6,
        recentCostStable: true,
        stockDays: 30,
        budget: { level: "adset", objectId: "set", noRecentIncrease: true },
      });
      const value = adFinancial(candidate, summary(), source, {
        id: "product",
        name: "Producto sin evidencia propia",
        storeId: "store",
        netPrice: null,
        unitCost,
        availableStock: "100",
        variants: [],
      });
      expect(value.maximum).toBeNull();
      expect(value.gain).toBeNull();
      expect(value.usage).toBeNull();
      if (!ownNet) {
        expect(value.revenue).toBeNull();
        expect(value.ticket).toBeNull();
        expect(value.roas).toBeNull();
      }
      expect(adStatus(candidate, value, rules, "2026-10-16", 30)).toBe("Sin datos suficientes");
      expect(canScale(candidate, value, rules, "2026-10-16")).toBe(false);
    },
  );
  it("does not borrow another product's margin when an assigned product catalog is unavailable", () => {
    const data = summary();
    data.adProducts = [
      {
        adId: "ad",
        accountId: "account",
        productId: "specific",
        storeId: "store",
        origin: "manual",
      },
    ];
    for (const days of [data.days, []]) {
      const value = adFinancial(row(), { ...data, days }, sales());
      expect(value.maximum).toBeNull();
      expect(value.gain).toBeNull();
      expect(value.revenue).toBeNull();
      expect(value.usage).toBeNull();
    }
  });
  it("never mixes foreign ad currency with PEN product margins or revenue ratios", () => {
    const value = adFinancial(row({ currency: "USD" }), summary(), sales());
    expect(value.spend).toBe(300);
    expect(value.gain).toBeNull();
    expect(value.maximum).toBeNull();
    expect(value.roas).toBeNull();
  });
  it("does not sum conversations and purchases into one result", () => {
    const data = summary();
    data.days[0].channel = "messages";
    const source = sales();
    source.byChannel = [
      {
        ...metrics({
          delivered: 2,
          eligibleDelivered: 2,
          eligibleRevenue: "100",
          eligibleProductCost: "20",
          eligibleShippingCost: "10",
          billedRevenue: "100",
        }),
        storeId: "store",
        channel: "messages",
      },
      { ...source.byChannel[0], delivered: 4, eligibleDelivered: 4 },
    ];
    const value = adFinancial(row(), data, source);
    expect(value.delivered).toBe(6);
  });
  it("activates conversion diagnosis with enough clicks and preserves low-sample gray behavior", () => {
    const candidate = row();
    candidate.insights.resultMetrics!.webPurchases.count = "1";
    const average = { hook: 0.5, hold: 0.5, ctr: 5, conversion: 0.5 };
    expect(diagnosis(candidate, average).label).toContain("Se pierde después del clic");
    candidate.insights.inlineLinkClicks = "20";
    candidate.insights.impressions = "500";
    expect(diagnosis(candidate, average).label).toBe("Poca data para diagnosticar");
  });
  it("weights the independent creative baseline by impressions", () => {
    const one = row();
    const two = row();
    two.insights.impressions = "6000";
    two.insights.video3s = "600";
    expect(creativeAverage([one, two]).hook).toBeCloseTo(0.2);
  });
});
