import type { AdsProduct, AdsSales, AdsSummary } from "@/services/advertisingV22Service";
import { emptySales, productFinancialRows } from "../model";

const metric = (storeId: string, revenue: string, delivered: number, costs: string) => ({
  ...emptySales(),
  storeId,
  productId: "product",
  channel: "web",
  orders: delivered,
  attributedOrders: delivered,
  delivered,
  units: delivered,
  deliveredUnits: delivered,
  eligibleDelivered: delivered,
  eligibleDeliveredUnits: delivered,
  billedUnits: delivered,
  eligibleBilledUnits: delivered,
  billedRevenue: revenue,
  eligibleRevenue: revenue,
  eligibleProductCost: costs,
  eligibleShippingCost: "0",
  inTransitRevenue: "0",
  inTransitProductCost: "0",
  inTransitShippingCost: "0",
});
function fixture() {
  const summary = {
    quality: { spendAvailable: true },
    adProducts: [
      { productId: "product", storeId: "a", accountId: "account-a", adId: "same-ad-id" },
      { productId: "product", storeId: "b", accountId: "account-b", adId: "same-ad-id" },
    ],
    days: [
      { storeId: "a", accountId: "account-a", adId: "same-ad-id", currency: "PEN", spend: "10" },
      { storeId: "b", accountId: "account-b", adId: "same-ad-id", currency: "PEN", spend: "90" },
    ],
  } as unknown as AdsSummary;
  const sales = {
    byProduct: [metric("a", "100", 1, "20"), metric("b", "900", 9, "180")],
    deliveryHistory: [],
  } as unknown as AdsSales;
  const products = [{ id: "product", name: "Producto compartido" }] as AdsProduct[];
  return { summary, sales, products };
}
it("aggregates by product ID, counts account/ad pairs and recalculates ratios from totals", () => {
  const { summary, sales, products } = fixture();
  const [product] = productFinancialRows(summary, sales, products, "all", false);
  expect(product).toMatchObject({
    productId: "product",
    storeId: "all",
    currency: "PEN",
    ads: 2,
    spend: 100,
    revenue: 1000,
    delivered: 10,
    costSale: 10,
    costUnit: 10,
    netUnitPrice: 100,
    maximum: 80,
    costWithShipping: 20,
    gain: 700,
    gainUnit: 70,
    roas: 10,
  });
  expect(productFinancialRows(summary, sales, products, "all")).toHaveLength(2);
});
it("does not average the stores' cost per sale", () => {
  const { summary, sales, products } = fixture();
  summary.days[0].spend = "20";
  summary.days[1].spend = "80";
  const [product] = productFinancialRows(summary, sales, products, "all", false);
  expect(product.costSale).toBe(10);
  expect(product.costSale).not.toBeCloseTo((20 + 80 / 9) / 2);
});
it("preserves unknown spend and gain if any product/store part has no ad link", () => {
  const { summary, sales, products } = fixture();
  summary.adProducts = summary.adProducts.filter((row) => row.storeId === "a");
  expect(productFinancialRows(summary, sales, products, "all", false)[0]).toMatchObject({
    ads: 1,
    delivered: 10,
    revenue: 1000,
    spend: null,
    costSale: null,
    gain: null,
  });
});
it("preserves unknown spend if one participating store has pending coverage", () => {
  const { summary, sales, products } = fixture();
  summary.quality.spendScopes = ["a", "b"].map((storeId) => ({
    storeId,
    currency: "PEN",
    spendAvailable: storeId === "a",
    coverage: storeId === "a" ? "complete" : "pending",
    reasons: [],
    days: [],
  }));
  expect(productFinancialRows(summary, sales, products, "all", false)[0].spend).toBeNull();
});
it("does not double-count duplicate assignments and does not add foreign-currency spend to PEN", () => {
  const { summary, sales, products } = fixture();
  summary.adProducts.push({ ...summary.adProducts[0] });
  summary.days.push({ ...summary.days[0], currency: "USD", spend: "999" });
  expect(productFinancialRows(summary, sales, products, "all", false)[0]).toMatchObject({
    ads: 2,
    spend: 100,
    currency: "PEN",
  });
});
it("projects each store with its own historical delivery rate before consolidating", () => {
  const { summary, sales, products } = fixture();
  sales.byProduct[0] = {
    ...sales.byProduct[0],
    inTransit: 2,
    inTransitUnits: 2,
    inTransitRevenue: "200",
    inTransitProductCost: "40",
    inTransitShippingCost: "0",
  };
  sales.byProduct[1] = {
    ...sales.byProduct[1],
    inTransit: 4,
    inTransitUnits: 4,
    inTransitRevenue: "400",
    inTransitProductCost: "80",
    inTransitShippingCost: "0",
  };
  sales.deliveryHistory = [
    { storeId: "a", deliveryRate: 0.5, closedConfirmed: 10 },
    { storeId: "b", deliveryRate: 0.75, closedConfirmed: 20 },
  ] as AdsSales["deliveryHistory"];
  expect(productFinancialRows(summary, sales, products, "all", false)[0]).toMatchObject({
    projectedSales: 14,
    projectedUnits: 14,
    projectedGain: 1020,
  });
});
it("keeps a requested store's scope when the company aggregation option is used", () => {
  const { summary, sales, products } = fixture();
  expect(productFinancialRows(summary, sales, products, "a", false)[0]).toMatchObject({
    storeId: "a",
    ads: 1,
    spend: 10,
    delivered: 1,
    revenue: 100,
  });
});
it("does not merge distinct product IDs that share a display name", () => {
  const { summary, sales, products } = fixture();
  sales.byProduct.push({ ...sales.byProduct[0], productId: "another-product" });
  products.push({ ...products[0], id: "another-product" });
  expect(
    productFinancialRows(summary, sales, products, "all", false).map((row) => row.productId),
  ).toEqual(["product", "another-product"]);
});
