import { emptySalesFilters } from "@/components/ventas/SalesTableFilters";
import { OPERATIONS_MAX_PAGE_SIZE, buildOperationsPedidosParams, getOperationsPedidosPage } from "../operationsPedidosService";
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
