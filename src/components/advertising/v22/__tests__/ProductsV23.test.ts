import type { AdsProduct } from "@/services/advertisingV22Service";
import type { AdsSalesV23, AdsSummaryV23, SalesRowV23 } from "@/services/advertisingV23Service";
import { productRowsV23 } from "../ProductsV23";
import { emptySales } from "../model";
const group = (changes: Partial<SalesRowV23> = {}): SalesRowV23 => ({
  ...emptySales(),
  storeId: "store",
  productId: "product",
  channelFamily: "web",
  channel: "SHOPIFY",
  orders: 2,
  ordersNet: 2,
  delivered: 2,
  deliveredUnits: 2,
  units: 2,
  eligibleDelivered: 2,
  eligibleDeliveredUnits: 2,
  normalOrders: 2,
  normalConfirmed: 2,
  convertedCodOrders: 0,
  unattributedOrders: 2,
  missingSellerOrders: 0,
  adjustmentOrders: 0,
  adjustmentRevenue: "0",
  unknownAdjustmentAmounts: 0,
  orderRevenueNet: "200",
  orderRevenue: "200",
  deliveredRevenue: "200",
  billedRevenue: "200",
  eligibleRevenue: "200",
  eligibleProductCost: "40",
  eligibleShippingCost: "20",
  completeCostOrders: 2,
  ...changes,
});
const summary = (): AdsSummaryV23 =>
  ({
    source: "powip",
    from: "2026-10-01",
    to: "2026-10-25",
    stores: [{ id: "store", name: "Tienda" }],
    days: [
      {
        date: "2026-10-01",
        adId: "ad",
        accountId: "account",
        storeId: "store",
        channel: "web",
        currency: "PEN",
        results: 10,
        spend: "100",
      },
    ],
    adProducts: [
      {
        adId: "ad",
        accountId: "account",
        productId: "product",
        storeId: "store",
        origin: "manual",
      },
    ],
    settings: { capabilities: { spend: true } },
    quality: { spendAvailable: true },
  }) as AdsSummaryV23;
const sales = (rows = [group()]): AdsSalesV23 => ({ byProduct: rows, daily: rows }) as AdsSalesV23;
const products = [
  {
    id: "product",
    storeId: "store",
    name: "Producto",
    unitCost: "999",
    netPrice: "9999",
    variants: [],
  },
] as AdsProduct[];
it("uses historical net prices and costs for product profit instead of catalog prices", () => {
  const [row] = productRowsV23(summary(), sales(), products, "store");
  expect(row.netPrice).toBe(100);
  expect(row.costAndShipping).toBe(30);
  expect(row.costUnit).toBe(50);
  expect(row.gainUnit).toBe(20);
  expect(row.usage).toBeCloseTo(100 / 140);
});
it.each(["USD", "EUR"])(
  "does not treat %s advertising spend as soles when filtering one account",
  (currency) => {
    const data = summary();
    data.days[0].currency = currency;
    const [row] = productRowsV23(
      data,
      sales([group({ accountId: "account" })]),
      products,
      "store",
      "account",
    );
    expect(row.spend).toBeNull();
    expect(row.costUnit).toBeNull();
    expect(row.gainUnit).toBeNull();
  },
);
it("keeps historical profit unknown when a current catalog cost cannot repair missing sale snapshots", () => {
  const [row] = productRowsV23(
    summary(),
    sales([group({ eligibleProductCost: null, eligibleDeliveredUnits: 0, missingCostOrders: 2 })]),
    products,
    "store",
  );
  expect(row.costAndShipping).toBeNull();
  expect(row.gainUnit).toBeNull();
  expect(row.usage).toBeNull();
  expect(row.reason).toContain("históricos");
});
it("retains store boundaries for a product sold in several stores", () => {
  const data = summary();
  data.stores.push({ id: "other", name: "Otra tienda" });
  data.days.push({
    ...data.days[0],
    adId: "other-ad",
    accountId: "other-account",
    storeId: "other",
    spend: "80",
  });
  data.adProducts.push({
    ...data.adProducts[0],
    adId: "other-ad",
    accountId: "other-account",
    storeId: "other",
  });
  const rows = productRowsV23(
    data,
    sales([group(), group({ storeId: "other", deliveredRevenue: "400", eligibleRevenue: "400" })]),
    products,
    "all",
  );
  expect(rows.map((row) => [row.storeId, row.spend, row.netPrice])).toEqual([
    ["store", 100, 100],
    ["other", 80, 200],
  ]);
  expect(
    productRowsV23(data, sales([group(), group({ storeId: "other" })]), products, "store"),
  ).toHaveLength(1);
});
it("does not invent spend for missing imported amounts or margin for products without sales", () => {
  const data = summary();
  data.days[0].spend = null;
  const [unknown] = productRowsV23(data, sales(), products, "store");
  expect(unknown.spend).toBeNull();
  expect(unknown.costUnit).toBeNull();
  data.days = [];
  const [unpurchased] = productRowsV23(data, sales([]), products, "store");
  expect(unpurchased.adCount).toBe(0);
  expect(unpurchased.spend).toBe(0);
  expect(unpurchased.netPrice).toBeNull();
  expect(unpurchased.gainUnit).toBeNull();
});
