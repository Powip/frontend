import { act, renderHook } from "@testing-library/react";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { TODAS_STATUSES, useVentasOrders } from "../useVentasOrders";

type Opts = { statuses?: OrderStatus[]; enabled?: boolean };
type Result = { orders: OrderHeader[]; loading: boolean; error: boolean; retry: jest.Mock; refetch: jest.Mock };

const mockOrders = jest.fn();
const mockCount = jest.fn();

jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: (...args: unknown[]) => mockOrders(...args),
}));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: (...args: unknown[]) => mockCount(...args),
}));

const PEND = ["PENDIENTE", "PAGADO"];
const KPI = ["PENDIENTE", "PAGADO", "ANULADO"];
const order = (id: string) => ({ id }) as unknown as OrderHeader;

const refetches: Record<string, jest.Mock> = {};
const retries: Record<string, jest.Mock> = {};
const fixtures: Record<string, Partial<Result>> = {};

function labelOf(from: string | undefined, opts: Opts = {}) {
  const s = opts.statuses ?? [];
  if (s === TODAS_STATUSES) return "todas";
  if (s.length === 3) return "kpis";
  if (s[0] === "ANULADO") return "anuladas";
  return from === undefined ? "antiguos" : "pendientes";
}

const EMPTY: OrderHeader[] = [];

beforeEach(() => {
  for (const k of Object.keys(fixtures)) delete fixtures[k];
  for (const k of Object.keys(refetches)) delete refetches[k];
  for (const k of Object.keys(retries)) delete retries[k];
  mockOrders.mockReset();
  mockCount.mockReset();
  mockOrders.mockImplementation((from: string | undefined, _to: string | undefined, opts: Opts) => {
    const label = labelOf(from, opts);
    refetches[label] ??= jest.fn();
    retries[label] ??= jest.fn();
    return { orders: EMPTY, loading: false, error: false, retry: retries[label], refetch: refetches[label], ...fixtures[label] };
  });
  mockCount.mockImplementation((from: string | undefined, _to: string | undefined, opts: Opts) => {
    const label = `count-${labelOf(from, opts)}`;
    refetches[label] ??= jest.fn();
    return { count: null, loading: false, error: false, retry: jest.fn(), refetch: refetches[label], ...fixtures[label] };
  });
});

const base = {
  today: "2026-10-20",
  anuladasWindow: { fromDate: "2026-09-21", toDate: "" },
  todasWindow: { fromDate: "2026-09-21", toDate: "" },
  todasEnabled: false,
  antiguosEnabled: false,
  kpiPeriod: null as { fromDate: string; toDate: string } | null,
};

describe("useVentasOrders", () => {
  it("pide las consultas con las ventanas y estados esperados", () => {
    renderHook(() => useVentasOrders(base));
    expect(mockOrders).toHaveBeenCalledWith("2026-09-21", undefined, { statuses: PEND });
    expect(mockOrders).toHaveBeenCalledWith("2026-09-21", undefined, { statuses: ["ANULADO"] });
    expect(mockOrders).toHaveBeenCalledWith("2026-09-21", undefined, { statuses: TODAS_STATUSES, enabled: false });
    expect(mockOrders).toHaveBeenCalledWith(undefined, "2026-09-20", { statuses: PEND, enabled: false });
    expect(mockCount).toHaveBeenCalledWith(undefined, "2026-09-20", { statuses: PEND });
    expect(mockCount).toHaveBeenCalledWith("2026-09-21", undefined, { statuses: TODAS_STATUSES });
  });

  it("usa hoy-29 si la ventana de anuladas llega sin fromDate", () => {
    renderHook(() => useVentasOrders({ ...base, anuladasWindow: { fromDate: "", toDate: "" } }));
    expect(mockOrders).toHaveBeenCalledWith("2026-09-21", undefined, { statuses: ["ANULADO"] });
  });

  it("KPIs: pide el período con un día de margen y no los mezcla en orders", () => {
    fixtures.kpis = { orders: [order("k1")] };
    fixtures.pendientes = { orders: [order("p1")] };
    const { result } = renderHook(() => useVentasOrders({ ...base, kpiPeriod: { fromDate: "2026-08-01", toDate: "2026-08-31" } }));
    expect(mockOrders).toHaveBeenCalledWith("2026-07-31", "2026-09-01", { statuses: KPI, enabled: true });
    expect(result.current.kpiOrders.map((o) => o.id)).toEqual(["k1"]);
    expect(result.current.orders.map((o) => o.id)).toEqual(["p1"]);
  });

  describe("debounce", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const called = (from: string) => mockOrders.mock.calls.some((c) => c[0] === from);

    it("cambios de ventana esperan 400 ms", () => {
      const { rerender } = renderHook((p) => useVentasOrders(p), { initialProps: base });
      rerender({ ...base, todasWindow: { fromDate: "2026-10-14", toDate: "" } });
      act(() => { jest.advanceTimersByTime(399); });
      expect(called("2026-10-14")).toBe(false);
      act(() => { jest.advanceTimersByTime(1); });
      expect(called("2026-10-14")).toBe(true);
    });

    it("ignora fechas con año menor a 2000", () => {
      const { rerender } = renderHook((p) => useVentasOrders(p), { initialProps: base });
      rerender({ ...base, todasWindow: { fromDate: "0002-10-01", toDate: "" } });
      act(() => { jest.advanceTimersByTime(1000); });
      expect(called("0002-10-01")).toBe(false);
    });

    it("kpis.loading es true durante el debounce de un período nuevo", () => {
      const p1 = { fromDate: "2026-08-01", toDate: "2026-08-31" };
      const { result, rerender } = renderHook((p) => useVentasOrders(p), { initialProps: { ...base, kpiPeriod: p1 } });
      expect(result.current.kpis.loading).toBe(false);
      rerender({ ...base, kpiPeriod: { fromDate: "2026-07-01", toDate: "2026-07-31" } });
      expect(result.current.kpis.loading).toBe(true);
      expect(called("2026-06-30")).toBe(false);
      act(() => { jest.advanceTimersByTime(400); });
      expect(called("2026-06-30")).toBe(true);
      expect(result.current.kpis.loading).toBe(false);
    });
  });

  it("kpis.loading es true con kpiPeriod null", () => {
    const { result } = renderHook(() => useVentasOrders(base));
    expect(result.current.kpis.loading).toBe(true);
  });

  it("refetch solo llama a las consultas habilitadas", async () => {
    const { result } = renderHook(() => useVentasOrders(base));
    await result.current.refetch();
    expect(refetches.pendientes).toHaveBeenCalled();
    expect(refetches.anuladas).toHaveBeenCalled();
    expect(refetches["count-todas"]).toHaveBeenCalled();
    expect(refetches["count-antiguos"]).toHaveBeenCalled();
    expect(refetches.antiguos).not.toHaveBeenCalled();
    expect(refetches.kpis).not.toHaveBeenCalled();
    expect(refetches.todas).not.toHaveBeenCalled();
  });

  it("mantiene la referencia de orders si los datos no cambian", () => {
    const list = [order("p1")];
    fixtures.pendientes = { orders: list };
    const { result, rerender } = renderHook(() => useVentasOrders(base));
    const first = result.current.orders;
    rerender();
    expect(result.current.orders).toBe(first);
  });

  it("no repite ids entre consultas", () => {
    fixtures.pendientes = { orders: [order("a")] };
    fixtures.todas = { orders: [order("a"), order("b")] };
    const { result } = renderHook(() => useVentasOrders({ ...base, todasEnabled: true }));
    expect(result.current.orders.map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("el error de todas no tapa la página; el de anuladas en la primera carga sí", () => {
    fixtures.todas = { error: true };
    const a = renderHook(() => useVentasOrders({ ...base, todasEnabled: true }));
    expect(a.result.current.error).toBe(false);
    expect(a.result.current.todas.error).toBe(true);
    fixtures.todas = {};
    fixtures.anuladas = { error: true };
    const b = renderHook(() => useVentasOrders(base));
    expect(b.result.current.error).toBe(true);
  });

  it("tras la primera carga de anuladas, su loading ya no tapa la página", () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = renderHook((p) => useVentasOrders(p), { initialProps: base });
      expect(result.current.loading).toBe(false);
      fixtures.anuladas = { loading: true };
      rerender({ ...base, anuladasWindow: { fromDate: "2026-10-01", toDate: "" } });
      expect(result.current.loading).toBe(false);
      expect(result.current.anuladas.loading).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
