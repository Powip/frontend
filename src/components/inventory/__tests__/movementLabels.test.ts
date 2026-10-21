import { describeMovement, formatPeruDateTime } from "../movementLabels";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const m = (type: string, reason: string | null, quantity = 3, referenceId: string | null = null) => ({ type, reason, quantity, referenceId }) as never;

describe("describeMovement (FEAT-24 H0)", () => {
  it.each([
    ["IN", "CREATE_ITEM", "Alta del producto", 3, null],
    ["IN", "STOCK_ADDITION", "Ajuste (sin motivo)", 3, null],
    ["OUT", "STOCK_REDUCTION", "Ajuste (sin motivo)", -3, null],
    ["IN", "PURCHASE - COM-0007", "Compra", 3, null],
    ["IN", "PURCHASE_EDIT - COM-0007", "Edición de compra", 3, null],
    ["OUT", "PURCHASE_EDIT_REVERT - COM-0007", "Reversión por edición de compra", -3, null],
    ["OUT", "PURCHASE_CANCELLED - COM-0007", "Compra anulada", -3, null],
    ["RESERVED", "SALE_RESERVATION", "Reserva de venta", null, 3],
    ["COMMITTED", "SALE_CONFIRMED", "Venta entregada", -3, null],
    ["RELEASED", "SALE_CANCELED", "Reserva liberada por venta cancelada", null, -3],
    ["IN", "SALE_CANCELLED_RESTORE", "Devolución por venta cancelada", 3, null],
    ["RESERVED", "order.created:1", "Reserva por pedido", null, 3],
    ["RESERVED", "order.updated:4", "Pedido modificado", null, 3],
    ["RELEASED", "order.cancelled:2", "Reserva liberada por pedido cancelado", null, -3],
    ["COMMITTED", "order.delivered:3", "Pedido entregado", -3, null],
    ["RESERVED", "ORDER_UPDATE_RESERVATION", "Reserva por pedido modificado", null, 3],
    ["RELEASED", "ORDER_UPDATE_RELEASE", "Liberación por pedido modificado", null, -3],
    ["IN", "EXTERNAL_SYNC_CREATE", "Alta desde Shopify", 3, null],
    ["OUT", "EXTERNAL_SYNC_ADJUST", "Sincronización con Shopify", -3, null],
    ["OUT", "AUDIT_CORRECTION - valor anterior 99999", "Corrección de cantidad inválida", -3, null],
    ["OUT", "SHRINKAGE - Dañado", "Merma (Dañado)", -3, null],
    ["OUT", "UNIT_TRANSFER_OUT - Central", "Transferencia de IMEI/series · Salida (Central)", -3, null],
    ["IN", "algo raro", "Otro movimiento", 3, null],
    ["IN", null, "Otro movimiento", 3, null],
  ])("%s %p → %s", (type, reason, label, physical, reserved) => {
    const view = describeMovement(m(type as string, reason as string | null));
    expect(view.label).toBe(label);
    expect(view.physicalDelta).toBe(physical);
    expect(view.reservedDelta).toBe(reserved);
  });

  it("ajuste con motivo y nota que contiene ' - '", () => {
    expect(describeMovement(m("OUT", "ADJUSTMENT_OUT - otro - caja 3 - rota", 2))).toMatchObject({
      label: "Ajuste · Otro", detail: "caja 3 - rota", physicalDelta: -2,
    });
    expect(describeMovement(m("IN", "ADJUSTMENT_IN - dano", 2))).toMatchObject({ label: "Ajuste · Daño", detail: null, physicalDelta: 2 });
  });

  it("unificación mueve físico y reservado", () => {
    expect(describeMovement(m("TRANSFER", "RECONCILE_MERGE_OUT reserved=4", 6))).toMatchObject({ label: "Unificación · sale", physicalDelta: -6, reservedDelta: -4 });
    expect(describeMovement(m("TRANSFER", "RECONCILE_LINK_IN reserved=0", 2))).toMatchObject({ label: "Vinculación · entra", physicalDelta: 2, reservedDelta: null });
  });

  it("documento y pedido", () => {
    expect(describeMovement(m("IN", "PURCHASE - COM-0007", 1, "COM-0007")).documentNumber).toBe("COM-0007");
    expect(describeMovement(m("IN", "PURCHASE - COM-0009", 1, null)).documentNumber).toBe("COM-0009");
    expect(describeMovement(m("COMMITTED", "SALE_CONFIRMED", 1, "ORD-000123")).documentNumber).toBe("ORD-000123");
    expect(describeMovement(m("RESERVED", "order.created:1", 1, UUID))).toMatchObject({ orderId: UUID, documentNumber: null });
  });

  it("muestra la hora de Perú", () => {
    expect(formatPeruDateTime("2026-10-21T17:47:00.000Z")).toBe("21/10/26, 12:47");
  });
});
