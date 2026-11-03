import { emptySalesFilters } from "@/components/ventas/SalesTableFilters";
import {
  OPERATIONS_MAX_PAGE_SIZE,
  OperationsTooManyError,
  buildOperationsPedidosParams,
  fetchAllOperationsOrders,
  getOperationsPedidosPage,
} from "../operationsPedidosService";
import axiosAuth from "@/lib/axiosAuth";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const base = { tab: "preparados" as const, page: 1, limit: 15, filters: {} };

describe("buildOperationsPedidosParams", () => {
  it("manda las tiendas ordenadas y sin repetir, la pestaña y la paginación", () => {
    const params = buildOperationsPedidosParams([B, A, B], base);
    expect(params.get("storeIds")).toBe(`${A},${B}`);
    expect(params.get("tab")).toBe("preparados");
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("15");
  });

  it("solo manda los filtros con valor", () => {
    const params = buildOperationsPedidosParams([A], {
      ...base, filters: { ...emptySalesFilters, search: "  ángela ", courier: "Olva", dateFrom: "2026-10-01", product: "sku:ABC" },
    });
    expect(Object.fromEntries(params)).toMatchObject({ search: "ángela", courier: "Olva", dateFrom: "2026-10-01", product: "sku:ABC" });
    for (const empty of ["dateTo", "region", "zone", "hasGuide", "status", "salesChannel", "paymentMethod"]) expect(params.has(empty)).toBe(false);
  });

  it("incluye subestado, vista, antigüedad, filtro rápido, ids y modo exportación cuando se piden", () => {
    const params = buildOperationsPedidosParams([A], {
      ...base, tab: "despachados", sub: "contactado", view: "guia", minAgeDays: 15, quick: "por-confirmar", ids: ["x", "y"], includeSummary: false,
    });
    expect(Object.fromEntries(params)).toMatchObject({
      tab: "despachados", sub: "contactado", view: "guia", minAgeDays: "15", quick: "por-confirmar", ids: "x,y", includeSummary: "false",
    });
  });

  it("no manda `includeSummary` en las consultas normales ni ids vacíos", () => {
    const params = buildOperationsPedidosParams([A], { ...base, ids: [] });
    expect(params.has("includeSummary")).toBe(false);
    expect(params.has("ids")).toBe(false);
  });

  it("rechaza alcances y páginas inválidos antes de pedir nada", () => {
    expect(() => buildOperationsPedidosParams([], base)).toThrow(/tiendas válidas/i);
    expect(() => buildOperationsPedidosParams(["  "], base)).toThrow(/tiendas válidas/i);
    expect(() => buildOperationsPedidosParams(Array.from({ length: 201 }, (_, i) => `s-${i}`), base)).toThrow(/tiendas válidas/i);
    expect(() => buildOperationsPedidosParams([A], { ...base, page: 0 })).toThrow(/página/i);
    expect(() => buildOperationsPedidosParams([A], { ...base, page: 1.5 })).toThrow(/página/i);
    expect(() => buildOperationsPedidosParams([A], { ...base, limit: OPERATIONS_MAX_PAGE_SIZE + 1 })).toThrow(/página/i);
  });
});

describe("getOperationsPedidosPage", () => {
  it("llama a business/operations con los parámetros y devuelve el cuerpo", async () => {
    process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.test";
    const body = { data: [], total: 0, page: 1, totalPages: 1, window: { days: 30, from: null, to: null, explicit: false } };
    jest.mocked(axiosAuth.get).mockResolvedValue({ data: body });

    const result = await getOperationsPedidosPage([A], { ...base, tab: "entregados" });

    expect(result).toBe(body);
    const [url] = jest.mocked(axiosAuth.get).mock.calls[0];
    expect(url).toMatch(/^https:\/\/ventas\.test\/order-header\/business\/operations\?/);
    expect(url).toContain("tab=entregados");
  });
});

describe("fetchAllOperationsOrders", () => {
  const order = (n: number) => ({ id: `o-${n}` });
  const serve = (total: number) =>
    jest.mocked(axiosAuth.get).mockImplementation(async (url: string) => {
      const params = new URL(url, "http://x").searchParams;
      const page = Number(params.get("page"));
      const limit = Number(params.get("limit"));
      const from = (page - 1) * limit;
      const data = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) => order(from + i + 1));
      return { data: { data, total, page, totalPages: Math.max(1, Math.ceil(total / limit)), window: {} } };
    });
  const pagesAsked = () => jest.mocked(axiosAuth.get).mock.calls.map(([url]) => new URL(url as string, "http://x").searchParams);

  beforeEach(() => jest.mocked(axiosAuth.get).mockReset());

  it("baja todas las páginas de a 100, sin resumen ni vista por guía, y avisa el progreso", async () => {
    serve(250);
    const progress: [number, number][] = [];

    const orders = await fetchAllOperationsOrders([A], { ...base, view: "guia", page: 4, ids: ["x"] }, { cap: 1000, onProgress: (loaded, total) => progress.push([loaded, total]) });

    expect(orders).toHaveLength(250);
    expect(pagesAsked().map((p) => [p.get("page"), p.get("limit")])).toEqual([["1", "100"], ["2", "100"], ["3", "100"]]);
    expect(pagesAsked().every((p) => p.get("includeSummary") === "false" && !p.has("view") && !p.has("ids"))).toBe(true);
    expect(progress).toEqual([[100, 250], [200, 250], [250, 250]]);
  });

  it("deduplica por id si el listado se movió mientras bajaba", async () => {
    jest.mocked(axiosAuth.get)
      .mockResolvedValueOnce({ data: { data: [order(1), order(2)], total: 3, page: 1, totalPages: 2, window: {} } })
      .mockResolvedValueOnce({ data: { data: [order(2), order(3)], total: 3, page: 2, totalPages: 2, window: {} } });

    const orders = await fetchAllOperationsOrders([A], base, { cap: 10 });

    expect(orders.map((o) => o.id)).toEqual(["o-1", "o-2", "o-3"]);
  });

  it("si supera el tope falla antes de bajar nada más que la primera página", async () => {
    serve(5000);

    await expect(fetchAllOperationsOrders([A], base, { cap: 2000 })).rejects.toMatchObject({ name: "OperationsTooManyError", total: 5000, cap: 2000 });
    expect(axiosAuth.get).toHaveBeenCalledTimes(1);
    await expect(fetchAllOperationsOrders([A], base, { cap: 2000 })).rejects.toBeInstanceOf(OperationsTooManyError);
  });

  it("exactamente en el tope sí baja todo", async () => {
    serve(300);
    expect(await fetchAllOperationsOrders([A], base, { cap: 300 })).toHaveLength(300);
  });

  it("si se cancela entre páginas no sigue pidiendo", async () => {
    serve(500);
    const controller = new AbortController();

    await expect(
      fetchAllOperationsOrders([A], base, { cap: 1000, signal: controller.signal, onProgress: (loaded) => loaded >= 100 && controller.abort() }),
    ).rejects.toBeDefined();
    expect(axiosAuth.get).toHaveBeenCalledTimes(1);
  });

  it("propaga los filtros y la pestaña en cada página", async () => {
    serve(150);
    await fetchAllOperationsOrders([A], { ...base, tab: "historial", filters: { ...emptySalesFilters, product: "var-1", dateFrom: "2026-01-01" } }, { cap: 1000 });
    expect(pagesAsked().every((p) => p.get("tab") === "historial" && p.get("product") === "var-1" && p.get("dateFrom") === "2026-01-01")).toBe(true);
  });
});
