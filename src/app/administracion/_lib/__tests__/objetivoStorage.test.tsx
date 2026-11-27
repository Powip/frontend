import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getObjetivosAdministracion, guardarObjetivoAdministracion } from "@/api/Administracion";
import {
  avanceObjetivo,
  claveObjetivo,
  leerObjetivo,
  normalizarObjetivo,
  objetivoDeDias,
  objetivoDelDia,
  OBJETIVO_VACIO,
  storageKeyObjetivo,
  TODOS_LOS_CANALES,
  useObjetivoCanal,
} from "../objetivoStorage";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }),
}));
jest.mock("@/api/Administracion", () => ({
  getObjetivosAdministracion: jest.fn(),
  guardarObjetivoAdministracion: jest.fn(),
}));

function envoltorio() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  jest.mocked(getObjetivosAdministracion).mockReset().mockResolvedValue({ objetivos: {} });
  jest.mocked(guardarObjetivoAdministracion).mockReset();
});

describe("claves", () => {
  it("agrupa las grafías de un canal y separa «Todos los canales»", () => {
    expect(claveObjetivo("LIVE TIKTOK")).toBe("TIKTOK_LIVE");
    expect(claveObjetivo("Tiktok Live")).toBe("TIKTOK_LIVE");
    expect(claveObjetivo(TODOS_LOS_CANALES)).toBe("todos");
    expect(storageKeyObjetivo("c1", "WHATSAPP")).toBe("powip:admin:objetivo-canal:c1:WHATSAPP");
    expect(storageKeyObjetivo("", "web")).toBe("powip:admin:objetivo-canal:anon:WEB");
  });
});

describe("normalizarObjetivo", () => {
  it("toma el objetivo diario y la meta mensual anterior; ignora CPV y presupuesto viejos", () => {
    expect(normalizarObjetivo({ ventasDia: 500 })).toEqual({ ventasDia: 500, metaVentasMes: null });
    expect(normalizarObjetivo({ objetivoCpv: 12, presupuestoMes: 3000, metaVentasMes: 30000 })).toEqual({
      ventasDia: null,
      metaVentasMes: 30000,
    });
    expect(normalizarObjetivo({ objetivoCpv: 0, presupuestoMes: 0, metaVentasMes: 0 })).toEqual(OBJETIVO_VACIO);
    expect(normalizarObjetivo(null)).toEqual(OBJETIVO_VACIO);
    expect(normalizarObjetivo("x")).toEqual(OBJETIVO_VACIO);
    expect(normalizarObjetivo({ ventasDia: -5 })).toEqual(OBJETIVO_VACIO);
  });
});

describe("objetivo por día", () => {
  it("usa el diario si existe", () => {
    expect(objetivoDelDia({ ventasDia: 400, metaVentasMes: 9000 }, "2026-11-03")).toBe(400);
  });

  it("reparte la meta mensual anterior por los días de cada mes", () => {
    const objetivo = { ventasDia: null, metaVentasMes: 3000 };
    expect(objetivoDelDia(objetivo, "2026-11-03")).toBe(100); // noviembre: 30 días
    expect(objetivoDelDia(objetivo, "2026-02-03")).toBeCloseTo(3000 / 28);
    expect(objetivoDeDias(objetivo, ["2026-10-31", "2026-11-01"])).toBeCloseTo(3000 / 31 + 100);
  });

  it("sin objetivo devuelve null y el avance también", () => {
    expect(objetivoDelDia(OBJETIVO_VACIO, "2026-11-03")).toBeNull();
    expect(objetivoDeDias(OBJETIVO_VACIO, ["2026-11-03"])).toBeNull();
    expect(avanceObjetivo(100, null)).toBeNull();
    expect(avanceObjetivo(150, 100)).toBe(1.5);
  });
});

describe("useObjetivoCanal (servidor)", () => {
  it("lee el objetivo del canal con su clave normalizada; sin dato, vacío", async () => {
    jest.mocked(getObjetivosAdministracion).mockResolvedValue({ objetivos: { TIKTOK_LIVE: 800, todos: 1500 } });
    const { result, rerender } = renderHook(({ canal }) => useObjetivoCanal("c1", canal), {
      initialProps: { canal: "LIVE TIKTOK" },
      wrapper: envoltorio(),
    });
    expect(result.current.cargado).toBe(false);
    await waitFor(() => expect(result.current.cargado).toBe(true));
    expect(result.current.objetivo).toEqual({ ventasDia: 800, metaVentasMes: null });
    rerender({ canal: "WEB" });
    expect(result.current.objetivo).toEqual(OBJETIVO_VACIO);
    rerender({ canal: TODOS_LOS_CANALES });
    expect(result.current.objetivo.ventasDia).toBe(1500);
  });

  it("guarda en el servidor con la clave normalizada (null borra) y no toca el navegador", async () => {
    jest.mocked(guardarObjetivoAdministracion).mockResolvedValue({ objetivos: { TIKTOK_LIVE: 900 } });
    const { result } = renderHook(() => useObjetivoCanal("c1", "Tiktok Live"), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.cargado).toBe(true));
    act(() => result.current.guardar(900));
    await waitFor(() => expect(result.current.objetivo.ventasDia).toBe(900));
    expect(guardarObjetivoAdministracion).toHaveBeenCalledWith("TIKTOK_LIVE", 900);
    expect(window.localStorage.length).toBe(0);

    jest.mocked(guardarObjetivoAdministracion).mockResolvedValue({ objetivos: {} });
    act(() => result.current.guardar(null));
    await waitFor(() => expect(result.current.objetivo).toEqual(OBJETIVO_VACIO));
    expect(guardarObjetivoAdministracion).toHaveBeenLastCalledWith("TIKTOK_LIVE", null);
  });
});

describe("leerObjetivo (lo que quedó en el navegador, para importarlo)", () => {
  it("lee la versión anterior bajo la misma clave", () => {
    window.localStorage.setItem(
      "powip:admin:objetivo-canal:c1:WHATSAPP",
      JSON.stringify({ objetivoCpv: 10, presupuestoMes: 0, metaVentasMes: 6000 }),
    );
    expect(leerObjetivo("c1", "WhatsApp")).toEqual({ ventasDia: null, metaVentasMes: 6000 });
  });
});
