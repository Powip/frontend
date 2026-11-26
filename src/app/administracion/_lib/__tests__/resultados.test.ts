import type { IGastoOperativo } from "@/interfaces/IAdmin";
import { calcularResultados, prorratearGastos, rangoMesDentro } from "../resultados";
import { resumirVentas } from "../ventas";

const gasto = (extra: Partial<IGastoOperativo>): IGastoOperativo => ({
  id: "g",
  company_id: "c",
  categoria: "PLANILLA",
  descripcion: null,
  monto: 3000,
  mes: 11,
  anio: 2026,
  created_at: "",
  updated_at: "",
  ...extra,
});

describe("prorratearGastos", () => {
  it("reparte el gasto mensual por los días del periodo", () => {
    const p = prorratearGastos([gasto({})], "2026-11-01", "2026-11-07");
    expect(p.fijos).toBeCloseTo(700);
    expect(p.filas[0].fraccion).toBeCloseTo(7 / 30);
  });

  it("un rango entre dos meses toma la parte de cada uno", () => {
    const p = prorratearGastos(
      [gasto({ mes: 10, monto: 3100 }), gasto({ mes: 11, monto: 3000 })],
      "2026-10-28",
      "2026-11-03",
    );
    // 4/31 de octubre + 3/30 de noviembre
    expect(p.fijos).toBeCloseTo(400 + 300);
  });

  it("separa publicidad y compra de mercadería de los fijos", () => {
    const p = prorratearGastos(
      [
        gasto({ categoria: "PUBLICIDAD", monto: 900 }),
        gasto({ categoria: "INVERSION", monto: 5000 }),
        gasto({ categoria: "OTRO", monto: 300 }),
      ],
      "2026-11-01",
      "2026-11-30",
    );
    expect(p.publicidad).toBe(900);
    expect(p.inversion).toBe(5000);
    expect(p.fijos).toBe(300);
  });

  it("ignora gastos de meses fuera del periodo", () => {
    expect(prorratearGastos([gasto({ mes: 9 })], "2026-11-01", "2026-11-30").fijos).toBe(0);
  });
});

describe("calcularResultados", () => {
  const ventas = resumirVentas([
    {
      status: "ENTREGADO",
      grandTotal: 1180,
      channelFee: 50,
      items: [{ lineKind: "PRODUCT", quantity: 10, unitCost: 40 }],
    },
  ]);

  it("arma la cascada sin IGV/IR ni comisión Powip", () => {
    const r = calcularResultados({
      ventas,
      gastos: prorratearGastos(
        [gasto({ monto: 300 }), gasto({ categoria: "PUBLICIDAD", monto: 60 })],
        "2026-11-01",
        "2026-11-30",
      ),
      merma: 30,
      envios: 70,
      publicidadConectada: 40,
      igvPct: 18,
    });
    expect(r.ventas).toBe(1180);
    expect(r.ventasSinIgv).toBeCloseTo(1000);
    expect(r.igvIncluido).toBeCloseTo(180);
    expect(r.utilidadBruta).toBe(1180 - 400 - 30);
    expect(r.publicidad).toEqual({ conectada: 40, gastos: 60, total: 100 });
    expect(r.gastosVariables).toBe(50 + 70 + 100);
    expect(r.contribucion).toBe(750 - 220);
    expect(r.gastosFijos).toBe(300);
    expect(r.utilidadOperativa).toBe(530 - 300);
    expect(r.margenOperativo).toBeCloseTo(230 / 1180);
    expect(r.puntoEquilibrio.ventas).toBeCloseTo(300 / (530 / 1180));
    expect(r.puntoEquilibrio.unidades).toBe(Math.ceil(300 / 53));
    expect(r.retornoPublicidad).toBeCloseTo(11.8);
    expect(r.costoPublicidadPorVenta).toBe(100);
  });

  it("sin ventas no inventa márgenes ni punto de equilibrio", () => {
    const r = calcularResultados({
      ventas: resumirVentas([]),
      gastos: prorratearGastos([gasto({})], "2026-11-01", "2026-11-30"),
      merma: 0,
      envios: 0,
      publicidadConectada: null,
      igvPct: 18,
    });
    expect(r.margenBruto).toBeNull();
    expect(r.puntoEquilibrio).toEqual({ ventas: null, unidades: null, avance: null });
    expect(r.utilidadOperativa).toBe(-3000);
    expect(r.retornoPublicidad).toBeNull();
  });

  it("sin gastos fijos no hay punto de equilibrio", () => {
    const r = calcularResultados({
      ventas,
      gastos: prorratearGastos([], "2026-11-01", "2026-11-30"),
      merma: 0,
      envios: 0,
      publicidadConectada: 0,
      igvPct: 18,
    });
    expect(r.puntoEquilibrio).toEqual({ ventas: null, unidades: null, avance: null });
  });
});

describe("rangoMesDentro", () => {
  it("recorta el mes al periodo", () => {
    expect(rangoMesDentro(2026, 11, "2026-01-01", "2026-11-25")).toEqual({ desde: "2026-11-01", hasta: "2026-11-25" });
    expect(rangoMesDentro(2026, 12, "2026-01-01", "2026-11-25")).toBeNull();
  });
});
