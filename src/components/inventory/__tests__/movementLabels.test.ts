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
    // F7: motivos que existen en ms-logistics y no tenían nombre.
    ["OUT", "SHRINKAGE", "Merma", -3, null],
    ["OUT", "SALE", "Venta", -3, null],
    ["OUT", "RECONCILE_DISCARD", "Unificación · stock descartado", -3, null],
    ["IN", "RECONCILE_RESERVE_FLOOR", "Unificación · se completa hasta lo reservado", 3, null],
    ["ADJUSTMENT", "UNIT_REGULARIZATION", "Activación de IMEI/series", null, null],
    ["IN", "RECONCILE_NEGATIVE_RESET", "Corrección de negativo al unificar", 3, null],
    ["RESERVED", "order.created:2:UNASSIGNED", "Reserva por pedido · sin unidad asignada", null, 3],
    ["RELEASED", "order.updated:3:UNASSIGNED", "Pedido modificado · sin unidad asignada", null, -3],
    // FEAT-24 H1-B: tipos del libro de stock y el conteo de la unificación.
    ["SALDO_INICIAL", null, "Saldo inicial", null, null],
    ["SALDO_INICIAL", "algo raro", "Saldo inicial", null, null],
    ["ANULACION", null, "Anulación", null, null],
    ["ANULACION", "PURCHASE_CANCELLED - COM-0007", "Compra anulada", null, null],
    ["OUT", "RECONCILE_COUNT from=10 to=7", "Unificación · conteo", -3, null],
    ["IN", "RECONCILE_COUNT from=4 to=9", "Unificación · conteo", 3, null],
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
    expect(describeMovement(m("RESERVED", "order.created:2:UNASSIGNED", 1, UUID))).toMatchObject({ orderId: UUID });
  });

  it("el conteo de la unificación explica de cuánto a cuánto", () => {
    expect(describeMovement(m("OUT", "RECONCILE_COUNT from=10 to=7", 3)).detail).toBe("de 10 a 7");
  });

  it("muestra la hora de Perú", () => {
    expect(formatPeruDateTime("2026-10-21T17:47:00.000Z")).toBe("21/10/26, 12:47");
  });
});

describe("describeMovement con el libro de stock (FEAT-24 H1-B)", () => {
  const ledger = (type: string, reason: string | null, fields: Record<string, number | null>, extra: Record<string, unknown> = {}) =>
    describeMovement({ type, reason, quantity: 3, referenceId: null, ...fields, ...extra } as never);

  it("fila nueva: los deltas salen del libro, con 0 como null, y trae los saldos", () => {
    expect(ledger("OUT", "SHRINKAGE", { physicalDelta: -2, reservedDelta: 0, physicalAfter: 12, reservedAfter: 3 })).toMatchObject({
      physicalDelta: -2, reservedDelta: null, physicalAfter: 12, reservedAfter: null,
    });
    expect(ledger("RESERVED", "SALE_RESERVATION", { physicalDelta: 0, reservedDelta: 2, physicalAfter: 12, reservedAfter: 5 })).toMatchObject({
      physicalDelta: null, reservedDelta: 2, physicalAfter: null, reservedAfter: 5,
    });
  });

  it("fila nueva: el libro manda sobre type y quantity", () => {
    // Un ADJUSTMENT por conteo antes salía sin efecto; ahora mueve el físico.
    expect(ledger("ADJUSTMENT", "ADJUSTMENT_IN - count", { physicalDelta: 5, reservedDelta: 0, physicalAfter: 15, reservedAfter: 0 })).toMatchObject({ physicalDelta: 5, physicalAfter: 15 });
    // Una merma recortada a 0: quantity pedida 9, delta real -4.
    expect(ledger("OUT", "SHRINKAGE", { physicalDelta: -4, reservedDelta: 0, physicalAfter: 0, reservedAfter: 0 }, { quantity: 9 })).toMatchObject({ physicalDelta: -4, physicalAfter: 0 });
  });

  it.each([
    ["null", { physicalDelta: null, reservedDelta: null, physicalAfter: null, reservedAfter: null }],
    ["ausentes", {}],
  ])("fila vieja (%s): conserva el cálculo por type y quantity y no trae saldo", (_name, fields) => {
    expect(ledger("OUT", "SHRINKAGE", fields)).toMatchObject({ physicalDelta: -3, reservedDelta: null, physicalAfter: null, reservedAfter: null });
    expect(ledger("RESERVED", "SALE_RESERVATION", fields)).toMatchObject({ physicalDelta: null, reservedDelta: 3, physicalAfter: null, reservedAfter: null });
  });

  it("referencia legible: referenceNumber manda, nunca un UUID, y reconoce TRA-", () => {
    expect(ledger("IN", "algo raro", {}, { referenceNumber: "COM-0007", referenceId: UUID }).documentNumber).toBe("COM-0007");
    expect(ledger("IN", "algo raro", {}, { referenceNumber: UUID, referenceId: null }).documentNumber).toBeNull();
    expect(ledger("IN", "algo raro", {}, { referenceNumber: null, referenceId: "TRA-0042" }).documentNumber).toBe("TRA-0042");
    expect(ledger("IN", "algo raro", {}, { referenceNumber: "", referenceId: UUID }).documentNumber).toBeNull();
  });
});

describe("describeMovement con los tipos nuevos del kardex (FEAT-24 H10)", () => {
  const row = (type: string, reason: string | null, extra: Record<string, unknown> = {}) =>
    describeMovement({ type, reason, quantity: 2, referenceId: null, physicalDelta: -2, reservedDelta: 0, physicalAfter: 5, reservedAfter: 0, ...extra } as never);

  it.each([
    ["ENTRADA_COMPRA", "PURCHASE_RECEPTION - OC-0001 - REC-0001", "Entrada por compra"],
    ["DEVOLUCION_PROVEEDOR", null, "Devolución a proveedor"],
    ["DESPACHO", "order.dispatched:3", "Salida por despacho"],
    ["ENTREGA", "order.delivered:4", "Entrega del pedido"],
    ["DEVOLUCION_EN_CAMINO", "order.cancelled:5", "Devolución en camino"],
    ["DEVOLUCION_REINGRESO", null, "Reingreso por devolución"],
    ["DEVOLUCION_MERMA", null, "Merma de devolución"],
    ["TRASLADO_SALIDA", "TRANSFER_OUT - TRA-0004", "Traslado · salida"],
    ["TRASLADO_EN_CAMINO", null, "Traslado · en camino"],
    ["TRASLADO_ENTRADA", null, "Traslado · entrada"],
    ["TRASLADO_DIFERENCIA", null, "Traslado · diferencia"],
    ["AJUSTE_POSITIVO", null, "Ajuste +"],
    ["AJUSTE_NEGATIVO", null, "Ajuste −"],
    ["MERMA", null, "Merma"],
    ["CAMBIO_ENTRADA", null, "Cambio · entra"],
    ["CAMBIO_SALIDA", null, "Cambio · sale"],
  ])("%s se llama «%s» aunque el motivo diga otra cosa", (type, reason, label) => {
    expect(row(type, reason).label).toBe(label);
  });

  it("el motivo con nombre pasa al detalle; el evento del pedido no", () => {
    expect(row("MERMA", "SHRINKAGE - Dañado")).toMatchObject({ label: "Merma", detail: "Merma (Dañado)" });
    expect(row("AJUSTE_NEGATIVO", "ADJUSTMENT_OUT - otro - caja rota")).toMatchObject({ label: "Ajuste −", detail: "Ajuste · Otro · caja rota" });
    expect(row("DEVOLUCION_EN_CAMINO", "order.cancelled:5")).toMatchObject({ detail: null });
  });

  it("reconoce OC-, REC- y DEV- como documento", () => {
    expect(row("ENTRADA_COMPRA", null, { referenceId: "OC-0001", referenceNumber: null }).documentNumber).toBe("OC-0001");
    expect(row("DEVOLUCION_PROVEEDOR", null, { referenceId: "DEV-0002" }).documentNumber).toBe("DEV-0002");
  });
});
