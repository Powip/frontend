import {
  apiErrorMessage,
  canConfirmWithoutScan,
  daysWaiting,
  daysWaitingLabel,
  DISPATCH_PENDING_MESSAGE,
  mergePickingView,
  orderStockAccess,
  pickedLine,
  pickingCompleteErrorMessage,
  pickingProgress,
  stockStateInfo,
  warehouseChangeBlockReason,
} from "../orderStock";

const httpError = (status: number, message?: unknown) => ({ response: { status, data: message === undefined ? {} : { message } } });

describe("estado de stock del pedido (FEAT-24 H2-F)", () => {
  it("traduce los 8 estados y descarta lo desconocido", () => {
    expect(stockStateInfo("reserved")?.label).toBe("Reservado");
    expect(stockStateInfo("sin_stock")).toMatchObject({ label: "Sin stock", tone: "danger" });
    expect(stockStateInfo("sin_reserva")?.label).toBe("Sin reserva");
    expect(stockStateInfo("por_vincular")?.label).toBe("Por vincular");
    expect(stockStateInfo("dispatched")?.label).toBe("Despachado");
    expect(stockStateInfo("delivered")?.label).toBe("Entregado");
    expect(stockStateInfo("released")?.label).toBe("Liberado");
    expect(stockStateInfo("returned")?.label).toBe("Devuelto");
    expect(stockStateInfo(null)).toBeNull();
    expect(stockStateInfo(undefined)).toBeNull();
    expect(stockStateInfo("otro")).toBeNull();
  });

  it("cuenta los días esperando", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    expect(daysWaiting("2026-11-17T08:00:00Z", now)).toBe(0);
    expect(daysWaiting("2026-11-16T11:00:00Z", now)).toBe(1);
    expect(daysWaiting("2026-11-10T12:00:00Z", now)).toBe(7);
    expect(daysWaiting("2026-11-18T12:00:00Z", now)).toBe(0);
    expect(daysWaiting(null, now)).toBeNull();
    expect(daysWaiting("no es fecha", now)).toBeNull();
    expect(daysWaitingLabel(null)).toBe("—");
    expect(daysWaitingLabel(0)).toBe("Hoy");
    expect(daysWaitingLabel(1)).toBe("1 día");
    expect(daysWaitingLabel(5)).toBe("5 días");
  });
});

describe("errores de la API", () => {
  it("lee el mensaje del servidor (texto o lista) o usa el de respaldo", () => {
    expect(apiErrorMessage(httpError(409, "  Faltan productos  "), "x")).toBe("Faltan productos");
    expect(apiErrorMessage(httpError(400, ["uno", " ", "dos"]), "x")).toBe("uno. dos");
    expect(apiErrorMessage(httpError(500), "respaldo")).toBe("respaldo");
    expect(apiErrorMessage(new Error("red"), "respaldo")).toBe("respaldo");
  });

  it("al completar: 409 muestra el faltante, 503 dice que quedó pendiente", () => {
    expect(pickingCompleteErrorMessage(httpError(409, "Faltan productos por tomar: Polo M (1)."))).toBe(
      "Faltan productos por tomar: Polo M (1).",
    );
    expect(pickingCompleteErrorMessage(httpError(503, "Logística no responde"))).toBe(DISPATCH_PENDING_MESSAGE);
    expect(pickingCompleteErrorMessage(httpError(403))).toBe("No tienes permiso para despachar pedidos.");
    expect(pickingCompleteErrorMessage(new Error("red"))).toMatch(/No se pudo completar/);
  });

  it("FEAT-24 H5-L: el 409 de lotes vencidos o bloqueados dice qué hacer (también desde la cola del celular)", () => {
    const server = "Solo hay 2 unidades vigentes para despachar 5: el resto está en lotes vencidos o bloqueados. Registra la merma del lote vencido, desbloquéalo o recibe stock nuevo.";
    expect(pickingCompleteErrorMessage(httpError(409, server))).toBe(
      "Solo quedan lotes vencidos o bloqueados: no se puede despachar. Solo hay 2 unidades vigentes para despachar 5: el resto está en lotes vencidos o bloqueados. Registra la merma del lote vencido, desbloquéalo en la ficha del producto (pestaña Lotes) o recibe stock nuevo.",
    );
  });
});

describe("picking", () => {
  const line = (quantity: number, pending: number) => ({ itemId: `i${quantity}${pending}`, quantity, picked: quantity - pending, pending, linked: true });

  it("suma el avance de todas las líneas", () => {
    expect(pickingProgress({ pickingRequired: false, complete: false, lines: [line(2, 1), line(3, 0)] })).toEqual({ done: 4, total: 5 });
    expect(pickingProgress({ pickingRequired: false, complete: true, lines: [] })).toEqual({ done: 0, total: 0 });
  });

  it("conserva la regla de la vista inicial cuando el servidor devuelve null y detecta la línea escaneada", () => {
    const first = { pickingRequired: true, complete: false, lines: [line(2, 2), line(1, 1)] };
    const afterScan = { pickingRequired: null, complete: false, lines: [{ ...line(2, 2), picked: 1, pending: 1 }, line(1, 1)] };
    expect(mergePickingView(first, afterScan).pickingRequired).toBe(true);
    expect(mergePickingView(first, { ...afterScan, pickingRequired: false }).pickingRequired).toBe(false);
    expect(mergePickingView(undefined, afterScan).pickingRequired).toBeNull();
    expect(pickedLine(first, afterScan)?.itemId).toBe(line(2, 2).itemId);
    expect(pickedLine(first, first)).toBeNull();
  });

  it("confirmar sin escanear solo si la empresa no lo exige y el servidor no lo prohibió", () => {
    const view = (pickingRequired: boolean | null) => ({ pickingRequired, complete: false, lines: [] });
    expect(canConfirmWithoutScan(view(false), false)).toBe(true);
    expect(canConfirmWithoutScan(view(null), false)).toBe(true);
    expect(canConfirmWithoutScan(view(true), false)).toBe(false);
    expect(canConfirmWithoutScan(view(false), true)).toBe(false);
  });
});

describe("permisos y cambio de almacén", () => {
  const has = (...granted: string[]) => (permission: string) => granted.includes(permission);

  it("separa Atención al cliente, Operaciones y el cambio de almacén", () => {
    expect(orderStockAccess(has("MANAGE_CUSTOMER_SERVICE"))).toEqual({ customer: true, operations: false, sinReserva: true, warehouse: false });
    expect(orderStockAccess(has("UPDATE_DELIVERY_STATUS"))).toEqual({ customer: false, operations: true, sinReserva: true, warehouse: false });
    expect(orderStockAccess(has("MANAGE_OPERATIONS"))).toEqual({ customer: true, operations: true, sinReserva: true, warehouse: true });
    expect(orderStockAccess(has())).toEqual({ customer: false, operations: false, sinReserva: false, warehouse: false });
  });

  it("solo antes del despacho y nunca en Live", () => {
    expect(warehouseChangeBlockReason({ status: "PREPARADO", stockState: "reserved" })).toBeNull();
    expect(warehouseChangeBlockReason({ status: "ASIGNADO_A_GUIA", stockState: "sin_stock" })).toBeNull();
    expect(warehouseChangeBlockReason({ status: "EN_ENVIO" })).toMatch(/antes del despacho/);
    expect(warehouseChangeBlockReason({ status: "PREPARADO", stockState: "dispatched" })).toMatch(/antes del despacho/);
    expect(warehouseChangeBlockReason({ status: "PENDIENTE", externalSource: "POWIP_LIVE" })).toMatch(/Live/);
  });
});
