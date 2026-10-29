import type {
  AdsDay,
  AdsProduct,
  AdsRow,
  AdsSales,
  AdsSummary,
  SalesMetric,
} from "@/services/advertisingV22Service";
import {
  adFinancial,
  adStatus,
  canScale,
  channelData,
  createAdFinancialCalculator,
  emptySales,
  financialBasis,
  financial,
  financialCauses,
} from "../model";

const rules = {
  noResultsDays: 3,
  minSpend: "60",
  nearLimitPct: 70,
  highFrequency: 3.5,
  winPct: 60,
  testMultiplier: 2,
  testMinSales: 3,
};
function metric(changes: Partial<SalesMetric> = {}): SalesMetric {
  return {
    ...emptySales(),
    orders: 10,
    confirmed: 10,
    delivered: 10,
    units: 10,
    deliveredUnits: 10,
    billedUnits: 10,
    eligibleBilledUnits: 10,
    eligibleDelivered: 10,
    eligibleDeliveredUnits: 10,
    billedRevenue: "1000",
    eligibleRevenue: "1000",
    productCost: "400",
    shippingCost: "100",
    eligibleProductCost: "400",
    eligibleShippingCost: "100",
    ...changes,
  };
}
function row(id = "a", level: AdsRow["level"] = "ad"): AdsRow {
  return {
    id,
    level,
    accountId: "account",
    campaignId: "campaign",
    adsetId: "set",
    name: id,
    objective: "OUTCOME_SALES",
    status: "ACTIVE",
    effectiveStatus: "ACTIVE",
    currency: "PEN",
    daysActive: 6,
    timeZone: "America/Lima",
    store: { id: "store", name: "Tienda" },
    recentCostStable: true,
    stockDays: 30,
    budget: { level: "adset", objectId: "set", noRecentIncrease: true },
    insights: {
      spend: "100",
      frequency: "1",
      impressions: "1000",
      clicks: "10",
      actions: [],
      inlineLinkClicks: "10",
      ctr: "1",
      coverage: {
        status: "complete",
        coveredDays: 16,
        totalDays: 16,
        provisionalDays: 0,
        lastSuccessfulAt: null,
        lastErrorCode: null,
      },
    },
  } as AdsRow;
}
function fixture() {
  const days = ["a", "b"].map((adId) => ({
    adId,
    accountId: "account",
    adsetId: "set",
    campaignId: "campaign",
    date: "2026-10-01",
    storeId: "store",
    channel: "web",
    currency: "PEN",
    spend: "100",
    results: 5,
    impressions: "1000",
    linkClicks: "10",
    provisional: false,
  })) as AdsDay[];
  const summary = {
    days,
    adProducts: [],
    quality: { warnings: [], spendAvailable: true },
    currency: "PEN",
  } as unknown as AdsSummary;
  const total = metric();
  const sales = {
    source: "powip-orders-v22",
    from: "2026-10-01",
    to: "2026-10-16",
    currency: "PEN",
    totals: total,
    byChannel: [{ ...total, storeId: "store", channel: "web" }],
    byAd: [],
    byProduct: [],
    byStore: [{ ...total, storeId: "store" }],
    daily: [],
    deliveryHistory: [],
    productVelocity: [],
    quality: {},
  } as AdsSales;
  return { summary, sales };
}
function productFixture() {
  const { summary, sales } = fixture();
  summary.adProducts = [
    { adId: "a", accountId: "account", productId: "p", storeId: "store", origin: "manual" },
    { adId: "b", accountId: "account", productId: "q", storeId: "store", origin: "manual" },
  ];
  sales.byProduct = [
    {
      ...metric({
        billedRevenue: "600",
        eligibleRevenue: "600",
        eligibleProductCost: "200",
        eligibleShippingCost: "50",
        billedUnits: 6,
        eligibleBilledUnits: 6,
        deliveredUnits: 6,
      }),
      productId: "p",
      storeId: "store",
      channel: "web",
    },
    {
      ...metric({
        billedRevenue: "400",
        eligibleRevenue: "400",
        eligibleProductCost: "200",
        eligibleShippingCost: "50",
        billedUnits: 4,
        eligibleBilledUnits: 4,
        deliveredUnits: 4,
      }),
      productId: "q",
      storeId: "store",
      channel: "web",
    },
  ];
  return { summary, sales };
}
it("reconciles two product pools and groups without duplicating net revenue, units or contribution", () => {
  const { summary, sales } = productFixture();
  const calculate = createAdFinancialCalculator(summary, sales);
  const a = calculate(row("a")),
    b = calculate(row("b"));
  const group = calculate({
    ...row("campaign", "campaign"),
    insights: { ...row().insights, spend: "200" },
  });
  expect(a.revenue).toBe(600);
  expect(b.revenue).toBe(400);
  expect(a.revenue! + b.revenue!).toBe(1000);
  expect(a.delivered + b.delivered).toBe(10);
  expect(a.deliveredUnits + b.deliveredUnits).toBe(10);
  expect(a.gain! + b.gain!).toBe(300);
  expect(group).toMatchObject({ revenue: 1000, gain: 300, roas: 5, delivered: 10, maximum: 50 });
});
it("splits one product between all of its ads by results, including a group with a single product", () => {
  const { summary, sales } = productFixture();
  summary.adProducts[1].productId = "p";
  summary.days[0].results = 2;
  summary.days[1].results = 8;
  sales.byProduct = [{ ...metric(), productId: "p", storeId: "store", channel: "web" }];
  const calculate = createAdFinancialCalculator(summary, sales);
  expect(calculate(row("a")).revenue).toBe(200);
  expect(calculate(row("b")).revenue).toBe(800);
  expect(
    calculate({ ...row("campaign", "campaign"), insights: { ...row().insights, spend: "200" } }),
  ).toMatchObject({
    revenue: 1000,
    gain: 300,
    maximum: 50,
  });
});
it("does not lend an identified product's pool to an unlinked or unknown product ad", () => {
  const { summary, sales } = productFixture();
  summary.adProducts[1].productId = "absent";
  const calculate = createAdFinancialCalculator(summary, sales);
  expect(calculate(row("a")).revenue).toBe(600);
  expect(calculate(row("b"))).toMatchObject({ revenue: null, roas: null, gain: null });
  summary.adProducts.pop();
  const unlinked = createAdFinancialCalculator(summary, sales)(row("b"));
  expect(unlinked.revenue).toBeNull();
  expect(financialCauses(unlinked)).toContain(
    "Vincula el producto del anuncio para usar sus ingresos y costos.",
  );
});
it("uses the channel pool when no product pool is linked and conserves that pool", () => {
  const { summary, sales } = fixture();
  const calculate = createAdFinancialCalculator(summary, sales);
  expect(calculate(row("a"))).toMatchObject({ revenue: 500, gain: 150, roas: 5, delivered: 5 });
  expect(calculate(row("a")).revenue! + calculate(row("b")).revenue!).toBe(1000);
});
it("estimates the unmeasured product residual despite a legacy executive flag, conserving revenue and contribution", () => {
  const { summary, sales } = productFixture();
  // A legacy executive payload does not override v2.3's explicitly estimated pools.
  sales.executive = {
    basis: "created",
    currency: "PEN",
    standard: { totals: { attributedOrders: 0 }, byAccount: [], byChannel: [], daily: [] },
    shopifyCod: null,
  } as NonNullable<AdsSales["executive"]>;
  const calculate = createAdFinancialCalculator(summary, sales);
  const a = calculate(row("a")), b = calculate(row("b"));
  const campaign = calculate({ ...row("campaign", "campaign"), insights: { ...row().insights, spend: "200" } });
  expect(a).toMatchObject({ revenue: 600, gain: 250, roas: 6, delivered: 5 });
  expect(b).toMatchObject({ revenue: 400, gain: 50, roas: 4, delivered: 5 });
  expect(a.revenue! + b.revenue!).toBe(1000);
  expect(a.delivered + b.delivered).toBe(10);
  expect(a.gain! + b.gain!).toBe(campaign.gain);
  expect(campaign).toMatchObject({ revenue: 1000, gain: 300, roas: 5, delivered: 10 });
  for (const value of [a, b, campaign]) {
    expect(financialBasis(value)).toBe("Estimado por canal");
    expect(value.evidence).toMatchObject({ basis: "estimated", partial: false, issues: [] });
  }
  summary.days[1].results = null;
  const unknown = createAdFinancialCalculator(summary, sales)(row("a"));
  expect(unknown).toMatchObject({ revenue: null, gain: null, roas: null });
  expect(unknown.evidence?.issues).toContain("results");
});
it("keeps ROAS independent of missing historical costs and never uses catalog cost as a past cost", () => {
  const { summary, sales } = productFixture();
  sales.byProduct[0] = {
    ...sales.byProduct[0],
    eligibleRevenue: "0",
    eligibleProductCost: null,
    eligibleShippingCost: null,
    eligibleBilledUnits: 0,
    missingCostOrders: 10,
  };
  const catalog = { id: "p", unitCost: "1", netPrice: "9999" } as AdsProduct;
  const value = adFinancial(row(), summary, sales, catalog);
  expect(value).toMatchObject({ revenue: 600, roas: 6, gain: null, maximum: null });
  expect(value.evidence?.costCoverage).toBe(0);
  expect(adStatus(row(), value, rules, "2026-10-17", 5)).toBe("Sin datos suficientes");
});
it("uses historical costs across differently priced variants, independent of a missing catalog scalar", () => {
  const { summary, sales } = productFixture();
  const value = adFinancial(row(), summary, sales, { id: "p", unitCost: null } as AdsProduct);
  expect(value).toMatchObject({ gain: 250, maximum: 70, revenue: 600 });
});
it("excludes unknown-cost sales from contribution rather than extrapolating the eligible margin", () => {
  const { summary, sales } = fixture();
  const partial = metric({
    eligibleRevenue: "500",
    eligibleProductCost: "200",
    eligibleShippingCost: "50",
    eligibleDelivered: 5,
    eligibleBilledUnits: 5,
    missingCostOrders: 5,
  });
  sales.byChannel = [{ ...partial, storeId: "store", channel: "web" }];
  summary.days[1].results = 0;
  const value = adFinancial(row(), summary, sales);
  expect(value).toMatchObject({ revenue: 1000, gain: 150, maximum: 50 });
  expect(value.evidence).toMatchObject({ partial: true, costCoverage: 0.5 });
  expect(financialCauses(value)).toContain(
    "Ganancia con costos registrados; faltan costos en parte de las ventas.",
  );
  expect(canScale(row(), value, rules, "2026-10-17")).toBe(false);
  expect(adStatus(row(), value, rules, "2026-10-17", 5)).toBe("Sin datos suficientes");
});
it("keeps verified sales on their ad and estimates only the remaining channel revenue once", () => {
  const { summary, sales } = fixture();
  sales.totals.attributedOrders = 2;
  sales.byChannel[0].attributedOrders = 2;
  sales.byAd = [{
    ...metric({ orders: 2, confirmed: 2, delivered: 2, units: 2, deliveredUnits: 2,
      billedUnits: 2, eligibleBilledUnits: 2, eligibleDelivered: 2, eligibleDeliveredUnits: 2,
      attributedOrders: 2, billedRevenue: "200", eligibleRevenue: "200", productCost: "80", shippingCost: "20",
      eligibleProductCost: "80", eligibleShippingCost: "20" }),
    adId: "b", accountId: "account", storeId: "store", channel: "web",
  }];
  const calculate = createAdFinancialCalculator(summary, sales);
  const a = calculate(row("a")), b = calculate(row("b"));
  expect(a).toMatchObject({ revenue: 800, roas: 8, gain: 300, delivered: 8 });
  expect(a.evidence?.basis).toBe("estimated");
  expect(b).toMatchObject({ revenue: 200, roas: 2, gain: 0, delivered: 2 });
  expect(b.evidence?.basis).toBe("measured");
  expect(a.revenue! + b.revenue!).toBe(1000);
  expect(a.delivered + b.delivered).toBe(10);
  // Unknown Meta results cannot erase a sale with a verified account and ad.
  summary.days[1].results = null;
  const unchanged = createAdFinancialCalculator(summary, sales);
  expect(unchanged(row("b")).revenue).toBe(200);
  expect(unchanged(row("b")).evidence?.basis).toBe("measured");
  expect(unchanged(row("a")).revenue).toBe(800);
});
it("keeps another channel's identified sales outside the filtered web residual", () => {
  const { summary, sales } = fixture();
  sales.totals.attributedOrders = 2;
  const messages = { ...metric({ orders: 2, confirmed: 2, delivered: 2, units: 2, deliveredUnits: 2,
    billedUnits: 2, eligibleBilledUnits: 2, eligibleDelivered: 2, eligibleDeliveredUnits: 2,
    attributedOrders: 2, billedRevenue: "200", eligibleRevenue: "200", productCost: "80", shippingCost: "20",
    eligibleProductCost: "80", eligibleShippingCost: "20" }), storeId: "store", channel: "messages" as const };
  sales.byChannel.push(messages);
  sales.byAd.push({ ...messages, adId: "messages-ad", accountId: "account" });
  summary.days.push({ ...summary.days[0], adId: "messages-ad", channel: "messages", results: 2, spend: "50" });
  const scoped = channelData(summary, sales, "web");
  const calculate = createAdFinancialCalculator(scoped.summary, scoped.sales);
  const a = calculate(row("a")), b = calculate(row("b"));
  expect(a.evidence?.basis).toBe("estimated");
  expect(a.revenue).toBe(500);
  expect(b.revenue).toBe(500);
  expect(a.revenue! + b.revenue!).toBe(1000);
  expect(a.delivered + b.delivered).toBe(10);
  expect(scoped.sales.byAd).toHaveLength(0);
});
it.each(["result", "coverage", "store"])(
  "does not estimate through unknown %s evidence",
  (missing) => {
    const { summary, sales } = fixture();
    if (missing === "result") summary.days[1].results = null;
    if (missing === "coverage") summary.quality.spendAvailable = false;
    if (missing === "store") summary.days[0].storeId = null;
    const value = adFinancial(row(), summary, sales);
    expect(value.revenue).toBeNull();
    expect(value.gain).toBeNull();
  },
);
it("keeps identical Meta IDs in different accounts separate", () => {
  const { summary, sales } = fixture();
  summary.days[1] = { ...summary.days[1], accountId: "another", adId: "a" };
  sales.totals.attributedOrders = 10;
  sales.byChannel[0].attributedOrders = 10;
  sales.byAd = [
    {
      ...metric({ orders: 2, billedRevenue: "200", attributedOrders: 2 }),
      adId: "a",
      accountId: "account",
      storeId: "store",
      channel: "web",
    },
    {
      ...metric({ orders: 8, billedRevenue: "800", attributedOrders: 8 }),
      adId: "a",
      accountId: "another",
      storeId: "store",
      channel: "web",
    },
  ];
  expect(adFinancial(row(), summary, sales).revenue).toBe(200);
});

it("does not treat an ambiguous legacy ad ID as measured in either account, and conserves its estimated residual", () => {
  const { summary, sales } = fixture();
  summary.days[1] = { ...summary.days[1], accountId: "another", adId: "a" };
  sales.byAd = [{ ...metric({ attributedOrders: 0 }), adId: "a", accountId: null, storeId: "store", channel: "web" }];
  const calculate = createAdFinancialCalculator(summary, sales);
  const a = calculate(row()), b = calculate({ ...row(), accountId: "another" });
  expect(a).toMatchObject({ revenue: 500, gain: 150, delivered: 5 });
  expect(b).toMatchObject({ revenue: 500, gain: 150, delivered: 5 });
  expect(a.evidence?.basis).toBe("estimated");
  expect(b.evidence?.basis).toBe("estimated");
  expect(a.revenue! + b.revenue!).toBe(1000);
  // Adding a verified (account, ad) pair owns only that pair; its revenue leaves the residual.
  sales.byAd.push({ ...metric({ orders: 2, confirmed: 2, delivered: 2, units: 2, deliveredUnits: 2,
    billedUnits: 2, eligibleBilledUnits: 2, eligibleDelivered: 2, eligibleDeliveredUnits: 2,
    attributedOrders: 2, billedRevenue: "200", eligibleRevenue: "200", productCost: "80", shippingCost: "20",
    eligibleProductCost: "80", eligibleShippingCost: "20" }),
    adId: "a", accountId: "account", storeId: "store", channel: "web" });
  sales.totals.attributedOrders = sales.byChannel[0].attributedOrders = 2;
  const verified = createAdFinancialCalculator(summary, sales);
  const own = verified(row()), other = verified({ ...row(), accountId: "another" });
  expect(own).toMatchObject({ revenue: 200, delivered: 2 });
  expect(own.evidence?.basis).toBe("measured");
  expect(other).toMatchObject({ revenue: 800, delivered: 8 });
  expect(other.evidence?.basis).toBe("estimated");
  expect(own.revenue! + other.revenue!).toBe(1000);
  expect(own.delivered + other.delivered).toBe(10);
});
it("does not report measured profitability from a catalog amount when spend reconciliation is incomplete", () => {
  const { summary, sales } = fixture();
  summary.quality.spendAvailable = false;
  sales.totals.attributedOrders = 10;
  sales.byChannel[0].attributedOrders = 10;
  sales.byAd = [
    {
      ...metric({ attributedOrders: 10 }),
      adId: "a",
      accountId: "account",
      storeId: "store",
      channel: "web",
    },
  ];
  const value = adFinancial(row(), summary, sales);
  expect(value).toMatchObject({ spend: null, roas: null, gain: null });
  expect(value.evidence?.partial).toBe(true);
  expect(adStatus(row(), value, rules, "2026-10-17", 10)).toBe("Sin datos suficientes");
});

it("accepts explicitly reconciled own-account spend while keeping a multi-account store conservative", () => {
  const { summary, sales } = fixture();
  summary.quality.spendAvailable = false;
  sales.totals.attributedOrders = 10;
  sales.byChannel[0].attributedOrders = 10;
  sales.byAd = [
    {
      ...metric({ attributedOrders: 10 }),
      adId: "a",
      accountId: "account",
      storeId: "store",
      channel: "web",
    },
  ];
  const own = row();
  own.insights.coverage.spendAvailable = true;
  expect(adFinancial(own, summary, sales)).toMatchObject({ spend: 100, roas: 10, gain: 400 });
  expect(adFinancial({ ...own, id: "store", level: "store" }, summary, sales)).toMatchObject({
    spend: null,
    roas: null,
    gain: null,
  });
});
it("does not invent a stored product link from a catalog prop and allocate its pool twice", () => {
  const { summary, sales } = fixture();
  sales.byProduct = [{ ...metric(), productId: "p", storeId: "store", channel: "web" }];
  const product = { id: "p", unitCost: "40" } as AdsProduct;
  expect(adFinancial(row("a"), summary, sales, product)).toMatchObject({
    revenue: null,
    gain: null,
  });
  expect(adFinancial(row("b"), summary, sales, product)).toMatchObject({
    revenue: null,
    gain: null,
  });
});
it("shows actual attributed income as measured partial without a profitability verdict on incomplete attribution", () => {
  const { summary, sales } = fixture();
  sales.totals.attributedOrders = 4;
  sales.byChannel[0].attributedOrders = 4;
  sales.byAd = [
    {
      ...metric({
        orders: 4,
        delivered: 4,
        deliveredUnits: 4,
        billedUnits: 4,
        eligibleBilledUnits: 4,
        attributedOrders: 4,
        eligibleDelivered: 4,
        billedRevenue: "400",
        eligibleRevenue: "400",
        eligibleProductCost: "160",
        eligibleShippingCost: "40",
      }),
      adId: "a",
      accountId: "account",
      storeId: "store",
      channel: "web",
    },
  ];
  const value = adFinancial(row(), summary, sales);
  expect(value).toMatchObject({ revenue: 400, roas: 4, gain: 100 });
  expect(financialBasis(value)).toBe("Medido parcial");
  expect(value.evidence?.attributionCoverage).toBe(0.4);
  expect(adStatus(row(), value, rules, "2026-10-17", 5)).toBe("Sin datos suficientes");
  expect(canScale(row(), value, rules, "2026-10-17")).toBe(false);
});
it("allocates prepaid recognized net revenue and historical costs without requiring delivered units", () => {
  const { summary, sales } = fixture();
  const prepaid = metric({
    delivered: 0,
    deliveredUnits: 0,
    eligibleDelivered: 0,
    eligibleDeliveredUnits: 0,
    billedUnits: 4,
    eligibleBilledUnits: 4,
    billedRevenue: "400",
    eligibleRevenue: "400",
    eligibleProductCost: "160",
    eligibleShippingCost: "40",
  });
  sales.byChannel = [{ ...prepaid, storeId: "store", channel: "web" }];
  summary.days[1].results = 0;
  expect(adFinancial(row(), summary, sales)).toMatchObject({
    delivered: 0,
    revenue: 400,
    roas: 4,
    gain: 100,
    costSale: null,
  });
});

it("keeps recognized prepaid contribution from eligible billed units when delivery and other costs are pending", () => {
  const paid = metric({
    delivered: 0,
    deliveredUnits: 0,
    eligibleDelivered: 0,
    eligibleDeliveredUnits: 0,
    billedUnits: 10,
    eligibleBilledUnits: 5,
    billedRevenue: "1000",
    eligibleRevenue: "500",
    eligibleProductCost: "200",
    eligibleShippingCost: "50",
    missingCostOrders: 5,
  });
  expect(financial(100, paid, null)).toMatchObject({
    revenue: 1000,
    gain: 150,
    roas: 10,
    maximum: null,
  });
});
