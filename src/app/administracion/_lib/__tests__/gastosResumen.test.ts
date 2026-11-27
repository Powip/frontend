import type { CategoriaGasto, IGastoOperativo } from "@/interfaces/IAdmin";
import { agruparCompraPorPrenda, agruparImplementos } from "../gastosResumen";
import { calcularResultados, prorratearGastos } from "../resultados";
import type { ResumenVentas } from "../ventas";

const gasto = (categoria: CategoriaGasto, monto: number, extra: Partial<IGastoOperativo> = {}): IGastoOperativo => ({
  id: `${categoria}-${monto}`,
  company_id: "c1",
  categoria,
  descripcion: null,
  monto,
  mes: 11,
  anio: 2026,
  created_at: "",
  updated_at: "",
  ...extra,
});

const gastos = [
  gasto("IMPLEMENTOS", 60, { descripcion: "Bolsas" }),
  gasto("IMPLEMENTOS", 40, { descripcion: " bolsas " }),
  gasto("IMPLEMENTOS", 30),
  gasto("INVERSION", 500, { productId: "p1", productName: "Polo" }),
  gasto("INVERSION", 200),
];

describe("Implementos y compra de mercadería", () => {
  const mes = prorratearGastos(gastos, "2026-11-01", "2026-11-30");

  it("Implementos es gasto fijo y la compra de mercadería no", () => {
    expect(mes.porCategoria.IMPLEMENTOS).toBe(130);
    expect(mes.fijos).toBe(130);
    expect(mes.inversion).toBe(700);
  });

  it("Implementos resta a la utilidad operativa; la compra de mercadería no", () => {
    const ventas = { monto: 1000, costo: 0, comisiones: 0, pedidos: 1, unidades: 1, coberturaCosto: 1,
      sinCosto: { pedidos: 0, monto: 0 }, costoDudoso: { pedidos: 0, monto: 0 }, ticketPromedio: 1000,
    } as unknown as ResumenVentas;
    const r = calcularResultados({ ventas, gastos: mes, merma: 0, envios: 0, publicidadConectada: null, igvPct: 18 });
    expect(r.fijosPorCategoria.IMPLEMENTOS).toBe(130);
    expect(r.utilidadOperativa).toBe(870);
  });

  it("agrupa implementos por descripción sin distinguir mayúsculas", () => {
    const g = agruparImplementos(mes.filas);
    expect(g.total).toBe(130);
    expect(g.filas.map((f) => [f.nombre, f.registros, f.total])).toEqual([
      ["Bolsas", 2, 100],
      ["Sin descripción", 1, 30],
    ]);
  });

  it("agrupa la compra de mercadería por prenda y suma solo la parte del periodo", () => {
    const medio = prorratearGastos(gastos, "2026-11-01", "2026-11-15");
    const g = agruparCompraPorPrenda(medio.filas);
    expect(g.total).toBe(350);
    expect(g.filas.map((f) => [f.nombre, f.total])).toEqual([
      ["Polo", 250],
      ["Sin prenda", 100],
    ]);
  });
});
