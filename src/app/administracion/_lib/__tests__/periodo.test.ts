import {
  diaLima,
  diasEntre,
  etiquetaPeriodo,
  hastaAyer,
  mesesDelPeriodo,
  periodoAnterior,
  presetDeRango,
  rangoDePreset,
  sumarMeses,
} from "../periodo";

describe("periodo", () => {
  it("cuenta los días con las dos puntas", () => {
    expect(diasEntre("2026-11-01", "2026-11-30")).toBe(30);
    expect(diasEntre("2026-11-25", "2026-11-25")).toBe(1);
    expect(diasEntre("2026-11-26", "2026-11-25")).toBe(0);
  });

  it("pasa los instantes UTC del backend a día de Lima", () => {
    // 03:00 UTC del 26 = 22:00 del 25 en Lima.
    expect(diaLima("2026-11-26T03:00:00.000Z")).toBe("2026-11-25");
    expect(diaLima("2026-11-26T05:00:00.000Z")).toBe("2026-11-26");
    // Sin zona se toma como UTC (así guarda ms-ventas).
    expect(diaLima("2026-11-26 03:00:00")).toBe("2026-11-25");
    expect(diaLima(null)).toBeNull();
    expect(diaLima("no es fecha")).toBeNull();
  });

  it("parte el periodo por mes", () => {
    expect(mesesDelPeriodo("2026-10-28", "2026-11-03")).toEqual([
      { anio: 2026, mes: 10, dias: 4, diasMes: 31 },
      { anio: 2026, mes: 11, dias: 3, diasMes: 30 },
    ]);
  });

  it("recorta el día al correr meses", () => {
    expect(sumarMeses("2026-03-31", -1)).toBe("2026-02-28");
    expect(sumarMeses("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("compara contra el mes calendario anterior", () => {
    expect(periodoAnterior("2026-11-01", "2026-11-30")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(periodoAnterior("2026-11-01", "2026-11-25")).toEqual({ desde: "2026-10-01", hasta: "2026-10-25" });
    expect(periodoAnterior("2026-03-01", "2026-03-31")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(periodoAnterior("2026-01-01", "2026-12-31")).toEqual({ desde: "2025-01-01", hasta: "2025-12-31" });
    // Rango largo que no son meses completos: los mismos días justo antes.
    expect(periodoAnterior("2026-01-10", "2026-03-10")).toEqual({ desde: "2025-11-11", hasta: "2026-01-09" });
  });

  it("rotula el periodo", () => {
    expect(etiquetaPeriodo("2026-11-01", "2026-11-30")).toBe("noviembre 2026");
    expect(etiquetaPeriodo("2026-11-01", "2026-11-25")).toBe("1–25 nov 2026");
    expect(etiquetaPeriodo("2026-10-28", "2026-11-03")).toBe("28 oct – 3 nov 2026");
    expect(etiquetaPeriodo("2026-01-01", "2026-12-31")).toBe("2026");
  });

  it("los atajos no pasan de hoy", () => {
    expect(rangoDePreset("mes_actual", "2026-11-25")).toEqual({ desde: "2026-11-01", hasta: "2026-11-25" });
    expect(rangoDePreset("mes_anterior", "2026-11-25")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
    expect(rangoDePreset("ultimos_7", "2026-11-25")).toEqual({ desde: "2026-11-19", hasta: "2026-11-25" });
    expect(presetDeRango("2026-11-01", "2026-11-25", "2026-11-25")).toBe("mes_actual");
    expect(presetDeRango("2026-11-02", "2026-11-25", "2026-11-25")).toBe("personalizado");
  });

  it("corta en ayer para los cocientes de publicidad", () => {
    expect(hastaAyer("2026-11-01", "2026-11-25", "2026-11-25")).toEqual({ desde: "2026-11-01", hasta: "2026-11-24" });
    expect(hastaAyer("2026-11-25", "2026-11-25", "2026-11-25")).toBeNull();
    expect(hastaAyer("2026-10-01", "2026-10-31", "2026-11-25")).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" });
  });
});
