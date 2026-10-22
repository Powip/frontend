import {
  canOperateCommercialOrder,
  canShipCommercialOrder,
  isCommercialSaleOrder,
  notifyCommercialChange,
} from "../commercialOrders";

describe("persisted commercial eligibility", () => {
  it("keeps historical and confirmed reserved orders eligible", () => {
    expect(canOperateCommercialOrder({})).toBe(true);
    expect(canOperateCommercialOrder({ commercialStage: null })).toBe(true);
    expect(
      canOperateCommercialOrder({
        commercialStage: "SALE",
        commercialStockState: "QUEUED",
      }),
    ).toBe(true);
  });
  it("allows service-only sales without physical reservations and preserves nullable historical orders", () => {
    expect(canOperateCommercialOrder({ commercialStage: "SALE", commercialStockState: "NOT_REQUIRED" })).toBe(true);
    expect(canShipCommercialOrder({ commercialStage: "SALE", commercialStockState: "NOT_REQUIRED" })).toBe(false);
    expect(canShipCommercialOrder({ commercialStage: null, commercialStockState: null })).toBe(true);
    expect(canShipCommercialOrder({ commercialStage: "SALE", commercialStockState: "DEFERRED" })).toBe(false);
    expect(canOperateCommercialOrder({ commercialStage: "LEAD", commercialStockState: "NOT_REQUIRED" })).toBe(false);
    expect(canOperateCommercialOrder({ commercialStage: null, commercialStockState: null })).toBe(true);
  });
  it("never treats paid Live holds or deferred stock as dispatch authority", () => {
    expect(
      canOperateCommercialOrder({
        commercialStage: "LEAD",
        commercialStockState: "PRESERVED",
      }),
    ).toBe(false);
    expect(
      canOperateCommercialOrder({
        commercialStage: "SALE",
        commercialStockState: "DEFERRED",
      }),
    ).toBe(false);
    expect(isCommercialSaleOrder({ commercialStage: "LEAD" })).toBe(false);
  });
  it("publishes refresh scope without a global cross-company payload", () => {
    const received = jest.fn();
    window.addEventListener("commercial-leads:changed", received);
    notifyCommercialChange("company-1", "lead-1");
    expect(received.mock.calls[0][0].detail).toEqual({
      companyId: "company-1",
      leadId: "lead-1",
    });
    notifyCommercialChange(undefined, "foreign");
    expect(received).toHaveBeenCalledTimes(1);
    window.removeEventListener("commercial-leads:changed", received);
  });
});
