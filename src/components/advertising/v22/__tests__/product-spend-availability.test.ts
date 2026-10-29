import type { AdsProduct, AdsSales, AdsSummary } from "@/services/advertisingV22Service";
import { emptySales, hourlySpendScope, productFinancialRows } from "../model";

const metric = {
  ...emptySales(),
  orders: 1,
  attributedOrders: 1,
  delivered: 1,
  deliveredUnits: 1,
  billedUnits: 1,
  eligibleBilledUnits: 1,
  eligibleDelivered: 1,
  billedRevenue: "100",
  eligibleRevenue: "100",
  eligibleProductCost: "30",
  eligibleShippingCost: "10",
};
const sales = {
  byProduct: [{ ...metric, productId: "product", storeId: "store" }],
  deliveryHistory: [],
} as unknown as AdsSales;
const products = [{ id: "product", name: "Producto" }] as AdsProduct[];
const summary = (linked: boolean, spend = true, days = true) =>
  ({
    quality: { spendAvailable: spend },
    adProducts: linked
      ? [{ adId: "ad", accountId: "account", productId: "product", storeId: "store" }]
      : [],
    days: days
      ? [{ adId: "ad", accountId: "account", storeId: "store", currency: "PEN", spend: "20" }]
      : [],
  }) as unknown as AdsSummary;

it("does not turn an unlinked product's missing advertising allocation into free advertising", () => {
  const [product] = productFinancialRows(summary(false), sales, products, "store");
  expect(product).toMatchObject({
    ads: 0,
    spend: null,
    costUnit: null,
    costSale: null,
    gain: null,
    gainUnit: null,
    delivered: 1,
    revenue: 100,
    netUnitPrice: 100,
  });
});
it("retains a confirmed zero when a linked ad has no observed spend in a complete store scope", () => {
  const [product] = productFinancialRows(summary(true, true, false), sales, products, "store");
  expect(product).toMatchObject({ ads: 1, spend: 0, costUnit: 0, gain: 60 });
});
it("retains observed linked spend and its existing financial calculation", () => {
  expect(productFinancialRows(summary(true), sales, products, "store")[0]).toMatchObject({
    spend: 20,
    costUnit: 20,
    gain: 40,
  });
});
it("does not publish linked spend when its store scope is still pending", () => {
  expect(productFinancialRows(summary(true, false), sales, products, "store")[0].spend).toBeNull();
});

it("uses all expected account IDs even if an account has no observed ad rows", () => {
  const source = summary(false);
  source.quality.accountDays = ["a", "b"].map((accountId) => ({
    accountId,
    date: "2026-10-22",
    currency: "PEN",
    spendAvailable: true,
    coverage: "complete",
    reconciliation: "matched",
    provisional: false,
    reasons: [],
  }));
  expect(hourlySpendScope(source, "all", "2026-10-22").accountIds).toEqual(["a", "b"]);
});
it("does not let accounts assigned to another store erase a confirmed zero for this store", () => {
  const source = summary(false);
  source.quality.spendScopes = [
    {
      storeId: "other-store",
      currency: "PEN",
      spendAvailable: true,
      coverage: "complete",
      reasons: [],
      days: [
        {
          date: "2026-10-22",
          spendAvailable: true,
          coverage: "complete",
          reasons: [],
          accountIds: [],
        },
      ],
    },
  ];
  expect(hourlySpendScope(source, "other-store", "2026-10-22")).toEqual({
    date: "2026-10-22",
    available: true,
    accountIds: [],
  });
});
it("does not interpret absent availability metadata as confirmed hourly coverage", () => {
  const source = summary(false);
  source.quality = { warnings: [] };
  expect(hourlySpendScope(source, "all", "2026-10-22").available).toBe(false);
});

it("does not assign product acquisition costs or gain to unverified sales", () => {
  const unlinkedSales = {
    ...sales,
    byProduct: sales.byProduct.map((row) => ({ ...row, attributedOrders: 0 })),
  };
  expect(productFinancialRows(summary(true), unlinkedSales, products, "store")[0]).toMatchObject({
    spend: 20,
    costUnit: null,
    gain: null,
    gainUnit: null,
  });
});
