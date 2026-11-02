import { courierSettlementBalances } from "../courierSettlementBalances";
import type { CourierCollection } from "@/services/courierSettlementsService";

const collection = (overrides: Partial<CourierCollection> = {}): CourierCollection => ({
  id: "collection", companyId: "company", orderId: "order", storeId: "store",
  orderNumber: "1", customerName: "Client", courierId: "courier", courierName: "Courier",
  currency: "PEN", amount: 100, settledAmount: 25, remainingAmount: 75,
  reservedAmount: 40, availableAmount: 35, status: "EN_REVISION", collectedAt: "2026-11-01",
  notes: "Confirmed", createdAt: "2026-11-01", createdBy: "finance", ...overrides,
});

describe("confirmed courier receivables", () => {
  it("does not invent receivables without confirmed collections", () => {
    expect(courierSettlementBalances([])).toEqual([]);
  });
  it("keeps deposits awaiting approval in the pending balance after a partial settlement", () => {
    expect(courierSettlementBalances([collection()])).toEqual([
      expect.objectContaining({ remainingAmount: 75, reservedAmount: 40, collections: 1 }),
    ]);
  });
  it("separates currencies and excludes already settled collections", () => {
    const balances = courierSettlementBalances([
      collection(), collection({ id: "usd", currency: "USD", remainingAmount: 10, reservedAmount: 0 }),
      collection({ id: "paid", remainingAmount: 0, reservedAmount: 0 }),
    ]);
    expect(balances).toHaveLength(2);
    expect(balances.map(({ currency, remainingAmount }) => ({ currency, remainingAmount }))).toEqual([
      { currency: "PEN", remainingAmount: 75 }, { currency: "USD", remainingAmount: 10 },
    ]);
  });
  it("adds cents without floating point residuals and keeps different couriers separate", () => {
    const balances = courierSettlementBalances([
      collection({ remainingAmount: 0.1, reservedAmount: 0.1 }),
      collection({ remainingAmount: 0.2, reservedAmount: 0.2 }),
      collection({ courierId: "other", remainingAmount: 20, reservedAmount: 0 }),
    ]);
    expect(balances).toHaveLength(2);
    expect(balances.find((b) => b.key === "courier:PEN")).toMatchObject({ remainingAmount: 0.3, reservedAmount: 0.3 });
  });
});
