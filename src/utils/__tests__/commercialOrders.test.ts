import {
  canOperateCommercialOrder,
  canPrepareDeferredManualOrder,
  canShipCommercialOrder,
  isCommercialSaleOrder,
  notifyCommercialChange,
  salesPhysicalOperationBlockReason,
  salesStatusBlockReason,
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


describe("sales physical authority independent of CC display", () => {
  it("distinguishes a confirmed purchase awaiting stock from an unconfirmed Lead", () => {
    expect(salesPhysicalOperationBlockReason({ commercialStage: "SALE", commercialStockState: "DEFERRED" })).toBe("Compra confirmada. Prepara la reserva de stock desde el Lead antes de preparar o despachar el pedido.");
    expect(salesPhysicalOperationBlockReason({ commercialStage: "LEAD", commercialStockState: "DEFERRED" })).toBe("Confirma la compra antes de preparar o despachar el pedido.");
  });
  const awaitingShopify = {
    commercialStage: null,
    externalSource: "shopify",
    shopifyCommercialGate: true,
    commercialCommittedAt: null,
    stockVersion: 0,
  };

  it("permits Angela's manual order with stock even when the server displays it in CC", () => {
    const order = { commercialStage: null, subEstadoCc: "entrega_lima", stockVersion: 1, salesOperationalEligible: false };
    expect(salesPhysicalOperationBlockReason(order)).toBeNull();
    expect(salesStatusBlockReason(order, "PREPARADO")).toBeNull();
  });

  it("requires confirmation before preparing Elisa's gated Shopify order", () => {
    expect(salesPhysicalOperationBlockReason(awaitingShopify)).toBe("Confirma el pedido en Ver antes de prepararlo.");
    expect(salesStatusBlockReason(awaitingShopify, "PREPARADO")).toBe("Confirma el pedido en Ver antes de prepararlo.");
  });

  it.each(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO"])("blocks unconfirmed Shopify from physical status %s", (status) => {
    expect(salesStatusBlockReason(awaitingShopify, status)).toEqual(expect.any(String));
  });

  it.each(["ANULADO", "PENDIENTE", "PAGADO"])("preserves nonphysical status %s for an unconfirmed Shopify order", (status) => {
    expect(salesStatusBlockReason(awaitingShopify, status)).toBeNull();
  });

  it.each([
    { shopifyCommercialGate: false },
    { commercialCommittedAt: "2026-10-23T18:00:00.000Z" },
    { stockVersion: 1 },
  ])("accepts existing Shopify commitment evidence %j", (commitment) => {
    expect(salesPhysicalOperationBlockReason({ ...awaitingShopify, ...commitment })).toBeNull();
  });

  it("fails closed for legacy Shopify without explicit gate or commitment evidence", () => {
    expect(salesPhysicalOperationBlockReason({ externalSource: "shopify" })).toEqual(expect.any(String));
  });

  it.each([
    { commercialStage: "LEAD" as const, commercialStockState: "PRESERVED" as const },
    { commercialStage: "SALE" as const, commercialStockState: "DEFERRED" as const },
  ])("keeps Lead and deferred stock guards while allowing cancellation %j", (order) => {
    expect(salesPhysicalOperationBlockReason(order)).toEqual(expect.any(String));
    expect(salesStatusBlockReason(order, "PREPARADO")).toEqual(expect.any(String));
    expect(salesStatusBlockReason(order, "ANULADO")).toBeNull();
  });

  it("does not treat legacy NOT_REQUIRED as permission to change physical statuses", () => {
    const order = { commercialStage: null, commercialStockState: "NOT_REQUIRED" as const };
    expect(salesPhysicalOperationBlockReason(order)).toEqual(expect.any(String));
    expect(salesStatusBlockReason(order, "PREPARADO")).toEqual(expect.any(String));
    expect(salesStatusBlockReason(order, "ANULADO")).toBeNull();
  });

  it("preserves service-only sale statuses while keeping physical guide eligibility separate", () => {
    const order = { commercialStage: "SALE" as const, commercialStockState: "NOT_REQUIRED" as const };
    expect(salesPhysicalOperationBlockReason(order)).toBeNull();
    expect(salesStatusBlockReason(order, "PREPARADO")).toBeNull();
    expect(canShipCommercialOrder(order)).toBe(false);
  });
});

describe("preparing an existing manual sale with deferred stock", () => {
  const manual = { status: "PENDIENTE", commercialStage: "SALE" as const, commercialStockState: "DEFERRED" as const };

  it.each(["PENDIENTE", "PAGADO"])("allows only preparation from %s, while printing and dispatch still require stock", (status) => {
    const order = { ...manual, status, externalSource: null };
    expect(canPrepareDeferredManualOrder(order)).toBe(true);
    expect(salesStatusBlockReason(order, "PREPARADO")).toBeNull();
    expect(salesPhysicalOperationBlockReason(order)).toMatch(/Al marcar Preparado, se registrará la reserva/);
    expect(salesPhysicalOperationBlockReason(order)).not.toContain("Lead");
    expect(canOperateCommercialOrder(order)).toBe(false);
    expect(canShipCommercialOrder(order)).toBe(false);
    for (const target of ["LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO"]) {
      expect(salesStatusBlockReason(order, target)).toEqual(expect.any(String));
    }
  });

  it("includes an absent source without assuming any explicit provider is manual", () => {
    expect(canPrepareDeferredManualOrder(manual)).toBe(true);
    for (const externalSource of ["shopify", "live", "aliclik", "yavendio", "manual", ""]) {
      const order = { ...manual, externalSource };
      expect(canPrepareDeferredManualOrder(order)).toBe(false);
      expect(salesStatusBlockReason(order, "PREPARADO")).toEqual(expect.any(String));
    }
  });

  it.each([
    { commercialStage: "LEAD" as const },
    { commercialStage: null },
    { status: "PREVENTA" },
    { status: "PREPARADO" },
    { status: "ANULADO" },
    { status: undefined },
    { commercialStockState: "QUEUED" as const },
  ])("does not classify another stage or reservation as a manual preparation exception: %j", (patch) => {
    expect(canPrepareDeferredManualOrder({ ...manual, ...patch })).toBe(false);
  });
});
