import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getMetasAdministracion, guardarMetasAdministracion } from "@/api/Administracion";
import { hayMetas, metaVentasMensual, normalizarMetas, useMetasAnuales } from "../metasStorage";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }),
}));
jest.mock("@/api/Administracion", () => ({ getMetasAdministracion: jest.fn(), guardarMetasAdministracion: jest.fn() }));

function envoltorio() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

describe("metas sin valores por defecto", () => {
  it("lo no cargado es null", () => {
    expect(normalizarMetas(undefined)).toEqual({ ventasAnual: null, profitAnual: null, margenObjetivoPct: null });
    expect(normalizarMetas({ ventasAnual: 0, profitAnual: -5, margenObjetivoPct: null })).toEqual({
      ventasAnual: null,
      profitAnual: null,
      margenObjetivoPct: null,
    });
  });

  it("los 500.000 / 85.000 / 20 % que guardaba el hook viejo cuentan como sin meta", () => {
    expect(hayMetas(normalizarMetas({ ventasAnual: 500000, profitAnual: 85000, margenObjetivoPct: 20 }))).toBe(false);
    expect(normalizarMetas({ ventasAnual: 500000, profitAnual: 90000, margenObjetivoPct: 20 }).ventasAnual).toBe(500000);
  });

  it("meta mensual = anual ÷ 12", () => {
    expect(metaVentasMensual(normalizarMetas({ ventasAnual: 120000 }))).toBe(10000);
    expect(metaVentasMensual(normalizarMetas({}))).toBeNull();
  });
});

describe("useMetasAnuales (servidor)", () => {
  beforeEach(() => window.localStorage.clear());

  it("lee las metas del año del servidor; mientras carga, sin meta", async () => {
    jest.mocked(getMetasAdministracion).mockResolvedValue({
      anio: 2026,
      ventasAnual: 600000,
      profitAnual: null,
      margenObjetivoPct: 18,
    });
    const { result } = renderHook(() => useMetasAnuales("c1", 2026), { wrapper: envoltorio() });
    expect(result.current[0]).toEqual({ ventasAnual: null, profitAnual: null, margenObjetivoPct: null });
    await waitFor(() => expect(result.current[0].ventasAnual).toBe(600000));
    expect(result.current[0].margenObjetivoPct).toBe(18);
    expect(getMetasAdministracion).toHaveBeenCalledWith(2026, expect.anything());
  });

  it("guardar manda las tres metas del año (null = sin meta) y no usa el navegador", async () => {
    jest.mocked(getMetasAdministracion).mockResolvedValue({ anio: 2026, ventasAnual: null, profitAnual: null, margenObjetivoPct: null });
    jest.mocked(guardarMetasAdministracion).mockResolvedValue({ anio: 2026, ventasAnual: 1000, profitAnual: null, margenObjetivoPct: null });
    const { result } = renderHook(() => useMetasAnuales("c1", 2026), { wrapper: envoltorio() });
    await waitFor(() => expect(getMetasAdministracion).toHaveBeenCalled());
    act(() => result.current[1]({ ventasAnual: 1000, profitAnual: null, margenObjetivoPct: null }));
    await waitFor(() => expect(result.current[0].ventasAnual).toBe(1000));
    expect(guardarMetasAdministracion).toHaveBeenCalledWith({ anio: 2026, ventasAnual: 1000, profitAnual: null, margenObjetivoPct: null });
    expect(window.localStorage.length).toBe(0);
  });
});
