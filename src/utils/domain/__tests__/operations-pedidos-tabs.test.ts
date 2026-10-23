import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { PRE_FULFILLMENT_STATUSES, SHIPPING_STATUSES, countByTab, getPedidosTab, isOperationsOrderVisible } from "../operations-pedidos-tabs";

const order = (status: OrderStatus, overrides: Partial<OrderHeader> = {}) => ({ id: "order-1", status, ...overrides }) as OrderHeader;

describe("operational queues are independent of payment", () => {
  it.each(["PENDIENTE", "PAGADO"] as OrderStatus[])("keeps %s in the preparation queue without treating it as prepared", (status) => {
    expect(isOperationsOrderVisible(order(status))).toBe(true);
    expect(getPedidosTab(order(status))).toBe("pendientes");
    expect(PRE_FULFILLMENT_STATUSES).toContain(status);
    expect(SHIPPING_STATUSES).not.toContain(status);
  });

  it("counts both paid and unpaid pending orders in the same queue", () => {
    const pending = [order("PENDIENTE", { grandTotal: "100", payments: [] }), order("PAGADO", { grandTotal: "100", payments: [{ status: "PAID", amount: "100" }] as any })];
    expect(countByTab(pending)).toMatchObject({ pendientes: 2, despachar: 0 });
  });

  it.each(["INCOMPLETE", "PREVENTA"] as OrderStatus[])("excludes %s checkouts", (status) => {
    expect(isOperationsOrderVisible(order(status))).toBe(false);
  });

  it("preserves unconfirmed commercial and Shopify barriers", () => {
    expect(isOperationsOrderVisible(order("PENDIENTE", { commercialStage: "LEAD" }))).toBe(false);
    expect(isOperationsOrderVisible(order("PENDIENTE", { commercialStockState: "DEFERRED" }))).toBe(false);
    expect(isOperationsOrderVisible(order("PENDIENTE", { externalSource: "shopify", stockVersion: 0, commercialCommittedAt: null }))).toBe(false);
    expect(isOperationsOrderVisible(order("PENDIENTE", { externalSource: "shopify", stockVersion: 1 }))).toBe(true);
  });

  it("keeps confirmed purchases awaiting stock reservation visible in Pending", () => {
    const confirmed = order("PENDIENTE", { commercialStage: "SALE", commercialStockState: "DEFERRED", commercialLeadId: "lead-1", stockVersion: 0 });
    expect(isOperationsOrderVisible(confirmed)).toBe(true);
    expect(getPedidosTab(confirmed)).toBe("pendientes");
  });

  it.each([
    ["PREPARADO", "despachar"], ["LLAMADO", "despachar"], ["ASIGNADO_A_GUIA", "despachar"],
    ["EN_ENVIO", "camino"], ["ENTREGADO", "historial"], ["ANULADO", "anulados"],
  ] as const)("keeps %s in %s regardless of balance", (status, tab) => {
    expect(isOperationsOrderVisible(order(status))).toBe(true);
    expect(getPedidosTab(order(status))).toBe(tab);
  });

  it("keeps failed deliveries and courier errors in attention", () => {
    expect(getPedidosTab(order("EN_ENVIO", { shalomStatus: "DEVUELTO" }))).toBe("atencion");
    expect(getPedidosTab(order("EN_ENVIO", { shalomError: "Error" }))).toBe("atencion");
  });
});
