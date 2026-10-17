import { getOrderCollectionAmount, getQuotationPendingAdvance } from "../orderCollectionAmount";

describe("quotation collection amounts", () => {
  const transferred = { amount: "30.00", status: "PENDING", externalReference: "quotation:advance-id" };

  it("deducts only the transferred quotation advance while retaining the gross sale total", () => {
    const order = { grandTotal: "120.00", externalSource: "quotation", payments: [transferred, { amount: 10, status: "PENDING" }] };
    expect(getOrderCollectionAmount(order)).toBe(90);
    expect(getQuotationPendingAdvance(order)).toBe(30);
    expect(order.grandTotal).toBe("120.00");
    expect(transferred.status).toBe("PENDING");
  });

  it("keeps ordinary sales approval rules even when a payment resembles a quote reference", () => {
    expect(getOrderCollectionAmount({ grandTotal: 120, externalSource: "shopify", payments: [transferred] })).toBe(120);
    expect(getOrderCollectionAmount({ grandTotal: 120, payments: [transferred] })).toBe(120);
  });

  it("does not deduct an advance twice after approval and restores rejected amounts", () => {
    expect(getOrderCollectionAmount({ grandTotal: 120, externalSource: "quotation", payments: [{ ...transferred, status: "PAID" }] })).toBe(90);
    expect(getOrderCollectionAmount({ grandTotal: 120, externalSource: "quotation", payments: [{ ...transferred, status: "LOST" }] })).toBe(120);
  });

  it("deducts later approved payments and clamps overpayments to zero", () => {
    const order = { grandTotal: 120, externalSource: "quotation", payments: [transferred, { amount: 20, status: "PAID" }] };
    expect(getOrderCollectionAmount(order)).toBe(70);
    expect(getOrderCollectionAmount({ ...order, grandTotal: 10 })).toBe(0);
  });
});
