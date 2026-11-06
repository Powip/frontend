import { toLimaDayKey } from "../lima-time";
import { prorratearMetaMensual, resolvePeriod } from "../period";

const at = (iso: string) => new Date(iso).getTime();

describe("toLimaDayKey", () => {
  it("usa el corte 00:00 de Lima (UTC−5)", () => {
    expect(toLimaDayKey(at("2026-09-22T04:59:59Z"))).toBe("2026-09-21");
    expect(toLimaDayKey(at("2026-09-22T05:00:00Z"))).toBe("2026-09-22");
  });
});

describe("resolvePeriod", () => {
  const now = at("2026-09-21T21:00:00Z");

  it("mes actual se compara con el mismo tramo del mes anterior", () => {
    const period = resolvePeriod({ preset: "mes", personalizado: null }, now);
    expect(period).toMatchObject({
      desde: "2026-09-01",
      hasta: "2026-09-21",
      anteriorDesde: "2026-08-01",
      anteriorHasta: "2026-08-21",
      desfaseDias: 31,
      dias: 21,
      incluyeHoy: true,
      zonaHoraria: "America/Lima",
    });
  });

  it("recorta el tramo anterior al fin del mes previo cuando es más corto", () => {
    const period = resolvePeriod(
      { preset: "mes", personalizado: null },
      at("2026-03-31T15:00:00Z"),
    );
    expect(period.anteriorDesde).toBe("2026-02-01");
    expect(period.anteriorHasta).toBe("2026-02-28");
  });

  it("hoy y ayer se comparan con el mismo día de la semana anterior", () => {
    expect(resolvePeriod({ preset: "hoy", personalizado: null }, now)).toMatchObject({
      desde: "2026-09-21",
      anteriorDesde: "2026-09-14",
      anteriorHasta: "2026-09-14",
      desfaseDias: 7,
    });
    expect(resolvePeriod({ preset: "ayer", personalizado: null }, now)).toMatchObject({
      desde: "2026-09-20",
      hasta: "2026-09-20",
      anteriorDesde: "2026-09-13",
    });
  });

  it("últimos 7 días se comparan con los 7 días previos", () => {
    expect(resolvePeriod({ preset: "7d", personalizado: null }, now)).toMatchObject({
      desde: "2026-09-15",
      hasta: "2026-09-21",
      anteriorDesde: "2026-09-08",
      anteriorHasta: "2026-09-14",
    });
  });

  it("mes anterior se compara con el mes previo completo", () => {
    expect(resolvePeriod({ preset: "mes_anterior", personalizado: null }, now)).toMatchObject({
      desde: "2026-08-01",
      hasta: "2026-08-31",
      anteriorDesde: "2026-07-01",
      anteriorHasta: "2026-07-31",
      incluyeHoy: false,
    });
  });

  it("personalizado ordena fechas invertidas, no pasa de hoy y usa un rango previo de igual duración", () => {
    const period = resolvePeriod(
      { preset: "personalizado", personalizado: { desde: "2026-09-30", hasta: "2026-09-10" } },
      now,
    );
    expect(period).toMatchObject({
      desde: "2026-09-10",
      hasta: "2026-09-21",
      dias: 12,
      anteriorDesde: "2026-08-29",
      anteriorHasta: "2026-09-09",
    });
  });

  it("prorratea metas mensuales por días", () => {
    expect(prorratearMetaMensual(30000, 21)).toBe(21000);
  });
});
