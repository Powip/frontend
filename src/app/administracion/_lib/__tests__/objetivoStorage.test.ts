import { act, renderHook } from "@testing-library/react";
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

beforeEach(() => window.localStorage.clear());

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

describe("useObjetivoCanal", () => {
  it("lee lo guardado con la versión anterior bajo la misma clave", () => {
    window.localStorage.setItem(
      "powip:admin:objetivo-canal:c1:WHATSAPP",
      JSON.stringify({ objetivoCpv: 10, presupuestoMes: 0, metaVentasMes: 6000 }),
    );
    const { result } = renderHook(() => useObjetivoCanal("c1", "WhatsApp"));
    expect(result.current.objetivo).toEqual({ ventasDia: null, metaVentasMes: 6000 });
  });

  it("guarda con la clave normalizada y no copia el objetivo al cambiar de canal", () => {
    const { result, rerender } = renderHook(({ canal }) => useObjetivoCanal("c1", canal), {
      initialProps: { canal: "LIVE TIKTOK" },
    });
    act(() => result.current.guardar(800));
    expect(window.localStorage.getItem("powip:admin:objetivo-canal:c1:TIKTOK_LIVE")).toBe(
      JSON.stringify({ ventasDia: 800 }),
    );
    expect(result.current.objetivo.ventasDia).toBe(800);

    rerender({ canal: "WEB" });
    expect(result.current.objetivo).toEqual(OBJETIVO_VACIO);
    expect(window.localStorage.getItem("powip:admin:objetivo-canal:c1:WEB")).toBeNull();

    rerender({ canal: "TIKTOK_LIVE" });
    expect(result.current.objetivo.ventasDia).toBe(800);
    expect(leerObjetivo("c1", "Tiktok Live").ventasDia).toBe(800);
  });

  it("guardar null borra el objetivo", () => {
    window.localStorage.setItem("powip:admin:objetivo-canal:c1:todos", JSON.stringify({ ventasDia: 100 }));
    const { result } = renderHook(() => useObjetivoCanal("c1", TODOS_LOS_CANALES));
    expect(result.current.objetivo.ventasDia).toBe(100);
    act(() => result.current.guardar(null));
    expect(result.current.objetivo).toEqual(OBJETIVO_VACIO);
    expect(window.localStorage.getItem("powip:admin:objetivo-canal:c1:todos")).toBeNull();
  });
});
