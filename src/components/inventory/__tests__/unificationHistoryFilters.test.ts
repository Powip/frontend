/**
 * Tests: filtros y CSV del Historial de la Unificación (FEAT-24 H11).
 * Fechas en días de Lima (UTC−5) enviadas como instantes ISO; CSV con BOM,
 * `;`, todo entre comillas y sin fórmulas; el costo solo para quien ve costos.
 */
import type { UnificationHistoryItem } from "@/services/unification.service";
import {
  RANGE_ORDER_ERROR,
  buildHistoryCsv,
  historyCsvFilename,
  historyDateRange,
  limaToday,
  normalizeEmailFilter,
} from "../unificationHistoryFilters";

// 17/11/2026 a las 22:30 en Lima (ya es 18/11 en UTC).
const NOW = new Date("2026-11-18T03:30:00.000Z");

const item = (overrides: Partial<UnificationHistoryItem> = {}): UnificationHistoryItem => ({
  id: "t-1", type: "manual", status: "confirmed", via: "union_manual", action: "merge",
  created_at: "2026-11-17T15:00:00.000Z", resolved_at: "2026-11-17T15:00:00.000Z",
  resolved_by: { user_id: "u-1", email: "ana@fixture.invalid" },
  winner: { variant_id: "v-1", product_id: "p-1", product_name: "Polo \"Azul\"", sku: "INT-1", company_sku: "POL-M", attribute_values: { Talla: "M" }, is_active: true },
  losers: [{ variant_id: "v-2", product_id: "p-2", product_name: "=HYPERLINK(\"x\")", sku: "SHP-1", company_sku: null, attribute_values: { Talla: "M" }, is_active: false }],
  stock_mode: "count", counted_quantity: 12, price_base: 20, derived: false, items: [],
  ...overrides,
});

describe("historyDateRange (días de Lima)", () => {
  it("toma el día de Lima, no el de UTC", () => {
    expect(limaToday(NOW)).toBe("2026-11-17");
    expect(historyCsvFilename(NOW)).toBe("powip_historial_unificacion_2026-11-17.csv");
  });

  it("«Hoy», «Últimos 7 días» y «Últimos 30 días» empiezan a las 00:00 de Lima y no tienen tope", () => {
    expect(historyDateRange("today", "", "", NOW)).toEqual({ from: "2026-11-17T05:00:00.000Z", error: null });
    expect(historyDateRange("7d", "", "", NOW)).toEqual({ from: "2026-11-11T05:00:00.000Z", error: null });
    expect(historyDateRange("30d", "", "", NOW)).toEqual({ from: "2026-10-19T05:00:00.000Z", error: null });
    expect(historyDateRange("", "2026-11-01", "2026-11-02", NOW)).toEqual({ error: null });
  });

  it("un rango incluye los dos días enteros; cada extremo es opcional", () => {
    expect(historyDateRange("range", "2026-11-01", "2026-11-17", NOW)).toEqual({
      from: "2026-11-01T05:00:00.000Z",
      to: "2026-11-18T04:59:59.999Z",
      error: null,
    });
    expect(historyDateRange("range", "2026-11-17", "2026-11-17", NOW).error).toBeNull();
    expect(historyDateRange("range", "", "2026-11-17", NOW)).toEqual({ from: undefined, to: "2026-11-18T04:59:59.999Z", error: null });
    expect(historyDateRange("range", "", "", NOW)).toEqual({ from: undefined, to: undefined, error: null });
    expect(historyDateRange("range", "17/11/2026", "", NOW).from).toBeUndefined();
  });

  it("«desde» después de «hasta» es un error", () => {
    expect(historyDateRange("range", "2026-11-18", "2026-11-17", NOW)).toEqual({ error: RANGE_ORDER_ERROR });
  });

  it("el correo se recorta y vacío no filtra", () => {
    expect(normalizeEmailFilter("  Ana@Fixture.invalid ")).toBe("Ana@Fixture.invalid");
    expect(normalizeEmailFilter("   ")).toBeUndefined();
  });
});

describe("buildHistoryCsv", () => {
  const lines = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

  it("lleva BOM, `;`, comillas escapadas y neutraliza fórmulas", () => {
    const csv = buildHistoryCsv([item()], true);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, row] = lines(csv);
    expect(header).toBe(
      '"Fecha";"Usuario";"Estado";"Acción";"Vía";"Queda (madre)";"SKU madre";"Se unió";"SKU de las que se unieron";"Stock";"Costo";"Detalle reconstruido"',
    );
    const cells = row.split(";");
    expect(cells[1]).toBe('"ana@fixture.invalid"');
    expect(cells[2]).toBe('"Aplicada"');
    expect(cells[3]).toBe('"Unificación"');
    expect(cells[4]).toBe('"Unión manual"');
    expect(cells[5]).toBe('"Polo ""Azul"" · Talla: M"');
    expect(cells[6]).toBe('"POL-M"');
    expect(cells[7]).toBe(`"'=HYPERLINK(""x"") · Talla: M"`);
    expect(cells[8]).toBe('"SHP-1"');
    expect(cells[9]).toBe('"Conteo físico: 12"');
    expect(cells[10]).toBe('"20.00"');
    expect(cells[11]).toBe('"No"');
  });

  it("sin permiso de costos no lleva la columna «Costo»", () => {
    const [header, row] = lines(buildHistoryCsv([item()], false));
    expect(header).not.toContain("Costo");
    expect(header.split(";")).toHaveLength(11);
    expect(row.split(";")).toHaveLength(11);
    expect(row).not.toContain("20.00");
  });

  it("una rechazada vieja lista lo que no se unió y marca el detalle reconstruido", () => {
    const rejected = item({
      status: "rejected", via: "bandeja", action: null, winner: null, losers: [], stock_mode: null, counted_quantity: null,
      price_base: null, derived: true, resolved_by: { user_id: null, email: null },
      items: [
        { variant_id: "v-7", product_id: "p-7", variant_name: "Short negro", sku: null, company_sku: null, external_id: null, source: null, confidence: 0.8 },
        { variant_id: "v-8", product_id: "p-8", variant_name: "Short azul", sku: null, company_sku: null, external_id: null, source: null, confidence: 0.8 },
      ],
    });
    const cells = lines(buildHistoryCsv([rejected], true))[1].split(";");
    expect(cells.slice(1, 5)).toEqual(['""', '"Rechazada"', '"Rechazada"', '"Bandeja"']);
    expect(cells[7]).toBe('"No se unió: Short negro | Short azul"');
    expect(cells[9]).toBe('"Sin detalle"');
    expect(cells[10]).toBe('""');
    expect(cells[11]).toBe('"Sí"');
  });
});
