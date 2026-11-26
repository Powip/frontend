import {
  type CapitalEntry,
  cuotaFrancesa,
  generarAmortizacion,
  resumirCapital,
  resumirPrestamo,
  tasaMensualDeTea,
} from "../capitalStorage";

const prestamo = (extra: Partial<CapitalEntry> = {}): CapitalEntry => ({
  id: "p1",
  tipo: "Préstamo",
  descripcion: "BCP",
  monto: 12000,
  tienda: "Consolidado",
  tasaAnualPct: 12.68,
  plazoCuotas: 12,
  cuotaMensual: 1066.18,
  fechaInicio: "2026-01-31",
  ...extra,
});

describe("capital y préstamos", () => {
  it("la TEA se pasa a tasa mensual compuesta, no ÷ 12", () => {
    expect(tasaMensualDeTea(12.68)).toBeCloseTo(0.01, 5);
    expect(tasaMensualDeTea(12.68)).not.toBeCloseTo(0.1268 / 12, 4);
    expect(tasaMensualDeTea(0)).toBe(0);
  });

  it("cuota fija del sistema francés", () => {
    expect(cuotaFrancesa(12000, 12.68, 12)).toBeCloseTo(1066.18, 1);
    expect(cuotaFrancesa(1200, 0, 12)).toBe(100);
    expect(cuotaFrancesa(0, 10, 12)).toBeNull();
  });

  it("las cuotas vencen sobre el día local del desembolso (fin de mes recortado)", () => {
    const cuotas = generarAmortizacion(prestamo(), 2, "2026-11-26");
    expect(cuotas).toHaveLength(12);
    expect(cuotas.map((c) => c.dia).slice(0, 3)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(cuotas[0].fecha).toBe("28 feb 2026");
    // 12.000 × ((1,1268)^(1/12) − 1) = 119,98 (con TEA ÷ 12 daba 126,80).
    expect(cuotas[0].interes).toBeCloseTo(119.98, 2);
    expect(cuotas[11].saldo).toBe(0);
    expect(cuotas.reduce((s, c) => s + c.capital, 0)).toBeCloseTo(12000, 2);
    expect(cuotas.map((c) => c.estado).slice(0, 4)).toEqual(["pagada", "pagada", "proxima", "pendiente"]);
  });

  it("si la cuota cancela antes, la tabla corta ahí y sin fecha usa hoy", () => {
    const cuotas = generarAmortizacion(prestamo({ cuotaMensual: 13000, fechaInicio: undefined }), 0, "2026-11-26");
    expect(cuotas).toHaveLength(1);
    expect(cuotas[0].dia).toBe("2026-12-26");
    expect(cuotas[0].cuota).toBeCloseTo(12120, 0);
  });

  it("resumen del préstamo", () => {
    const entry = prestamo();
    const cuotas = generarAmortizacion(entry, 2, "2026-11-26");
    const resumen = resumirPrestamo(entry, cuotas);
    expect(resumen.pagadas).toBe(2);
    expect(resumen.pagado).toBeCloseTo(cuotas[0].cuota + cuotas[1].cuota, 2);
    expect(resumen.saldo).toBe(cuotas[1].saldo);
    expect(resumen.proxima?.n).toBe(3);
    expect(resumirPrestamo(entry, generarAmortizacion(entry, 0, "2026-11-26")).saldo).toBe(12000);
  });

  it("la utilidad reinvertida no se suma al capital invertido", () => {
    const resumen = resumirCapital([
      { id: "a", tipo: "Capital propio", descripcion: "", monto: 10000, tienda: "" },
      { id: "b", tipo: "Aumento de capital", descripcion: "", monto: 2000, tienda: "" },
      { id: "c", tipo: "Utilidad reinvertida", descripcion: "", monto: 5000, tienda: "" },
      prestamo(),
    ]);
    expect(resumen).toEqual({ aportes: 12000, prestamos: 12000, invertido: 24000, reinvertida: 5000 });
  });
});
