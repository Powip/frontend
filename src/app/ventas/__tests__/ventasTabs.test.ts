import {
  VENTAS_RECENT_DAYS,
  daysWithoutMovement,
  splitVentasTabs,
  ventasAntiguosTo,
  ventasRecentFrom,
  VentasTabSale,
} from "../ventasTabs";

const today = "2026-10-20";
const opts = {
  today,
  anuladasWindow: { fromDate: "2026-09-21", toDate: "" },
  todasWindow: { fromDate: "2026-09-21", toDate: "" },
};

const sale = (
  id: string,
  status: VentasTabSale["status"],
  createdAt: string,
  updatedAt = createdAt,
) => ({ id, status, createdAt, updatedAt });

describe("ventasTabs", () => {
  it("calcula los bordes", () => {
    expect(VENTAS_RECENT_DAYS).toBe(30);
    expect(ventasRecentFrom(today)).toBe("2026-09-21");
    expect(ventasAntiguosTo(today)).toBe("2026-09-20");
  });

  it("separa pendientes recientes y antiguos por día de Perú", () => {
    const a = sale("a", "PENDIENTE", "2026-09-21T05:00:00Z");
    const b = sale("b", "PENDIENTE", "2026-09-21T04:30:00Z");
    const r = splitVentasTabs([a, b], opts);
    expect(r.pendientes).toEqual([a]);
    expect(r.antiguos).toEqual([b]);
    expect(r.pendientes[0]).toBe(a);
  });

  it("PAGADO cuenta como pendiente; PREPARADO viejo no aparece", () => {
    const p = sale("p", "PAGADO", "2026-10-10T15:00:00Z");
    const q = sale("q", "PREPARADO", "2026-09-10T15:00:00Z");
    const r = splitVentasTabs([p, q], opts);
    expect(r.pendientes).toEqual([p]);
    expect(r.antiguos).toEqual([]);
    expect(r.anulados).toEqual([]);
    expect(r.todas).toEqual([p]);
  });

  it("ANULADO: ventana de anuladas y todas", () => {
    const n = sale("n", "ANULADO", "2026-10-10T15:00:00Z");
    const o = sale("o", "ANULADO", "2026-09-10T15:00:00Z");
    const r = splitVentasTabs([n, o], opts);
    expect(r.anulados).toEqual([n]);
    expect(r.todas).toEqual([n]);
  });

  it("un cambio de estado mueve el pedido de pestaña", () => {
    const s = sale("s", "PENDIENTE", "2026-10-10T15:00:00Z");
    expect(splitVentasTabs([s], opts).pendientes).toEqual([s]);
    const t = { ...s, status: "ANULADO" as const };
    const r = splitVentasTabs([t], opts);
    expect(r.pendientes).toEqual([]);
    expect(r.anulados).toEqual([t]);
  });

  it("un antiguo que pasa a PREPARADO sale de antiguos", () => {
    const s = sale("s", "PENDIENTE", "2026-08-10T15:00:00Z");
    expect(splitVentasTabs([s], opts).antiguos).toEqual([s]);
    expect(splitVentasTabs([{ ...s, status: "PREPARADO" as const }], opts).antiguos).toEqual([]);
  });

  it("ordena antiguos por updatedAt ascendente", () => {
    const a = sale("a", "PENDIENTE", "2026-08-01T15:00:00Z", "2026-09-01T15:00:00Z");
    const b = sale("b", "PENDIENTE", "2026-08-01T15:00:00Z", "2026-08-15T15:00:00Z");
    expect(splitVentasTabs([a, b], opts).antiguos.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("INCOMPLETE nunca está en todas", () => {
    const i = sale("i", "INCOMPLETE", "2026-10-10T15:00:00Z");
    expect(splitVentasTabs([i], opts).todas).toEqual([]);
  });

  it("conserva el orden de entrada en las demás listas", () => {
    const a = sale("a", "PENDIENTE", "2026-10-15T15:00:00Z");
    const b = sale("b", "PENDIENTE", "2026-10-12T15:00:00Z");
    expect(splitVentasTabs([a, b], opts).pendientes.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("daysWithoutMovement", () => {
    expect(daysWithoutMovement("2026-10-17T15:00:00Z", today)).toBe(3);
    expect(daysWithoutMovement("2026-10-25T15:00:00Z", today)).toBe(0);
  });
});
