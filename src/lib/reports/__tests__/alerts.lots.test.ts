/**
 * Tests: alertas de lotes (FEAT-24 H5-L) y «Vencimiento en dinero» (Excel y PDF).
 *
 * 1. `lotes_por_vencer` y `lotes_vencidos_con_stock`: un renglón por lote y almacén, con el nombre de la variante
 *    (si ya se sabe), y el enlace a «Vencimiento en dinero».
 * 2. Excel y PDF de «Vencimiento en dinero»: sin rol de costos no hay columnas de valor y los montos salen «••••».
 */

import type ExcelJS from "exceljs";
import { alertCounts, alertLotVariantIds, alertRows } from "../alerts";
import { expiryFilterRows, expiryLabel, expiryPdfSpec, expiryTone, expiryWorkbook, lostByMonthText, lostTotal } from "../expiry";
import type { InventoryAlerts } from "@/services/inventoryReportsService";
import type { ExpiringLots } from "@/services/lotsService";

const lotItem = (lotId: string, lotNumber: string, daysToExpiry: number, quantity: number, status = "vigente") => ({
  lotId,
  lotNumber,
  variantId: "v1",
  inventoryId: "w1",
  inventoryName: "Breña",
  expiresAt: "2026-11-25",
  daysToExpiry,
  status,
  quantity,
});

const ALERTS: InventoryAlerts = {
  generatedAt: "2026-11-18T15:00:00Z",
  total: 4,
  alerts: [
    { type: "lotes_por_vencer", enabled: true, thresholdDays: 30, count: 3, items: [lotItem("l2", "L2402", 7, 12), lotItem("l4", "B500", 20, 5, "bloqueado")] },
    { type: "lotes_vencidos_con_stock", enabled: true, count: 1, items: [lotItem("l3", "A117", -18, 3, "vencido")] },
  ],
};

describe("alertas de lotes", () => {
  it("un renglón por lote con su nombre, días y el enlace a «Vencimiento en dinero»", () => {
    const rows = alertRows(ALERTS, { variantName: (id) => (id === "v1" ? "Crema Centella · 50 ml" : undefined) });
    expect(rows.map((row) => [row.title, row.tone, row.description, row.href, row.action])).toEqual([
      ["Lotes por vencer", "amber", "Crema Centella · 50 ml · lote L2402 en Breña: 12 und vencen en 7 días. Véndelo primero, trasládalo o haz una promoción.", "/inventario/alertas#vencimiento", "Ver vencimientos"],
      ["Lotes por vencer", "amber", "Crema Centella · 50 ml · lote B500 (bloqueado) en Breña: 5 und vencen en 20 días. Véndelo primero, trasládalo o haz una promoción.", "/inventario/alertas#vencimiento", "Ver vencimientos"],
      ["Lotes por vencer", "amber", "Y 1 más.", "/inventario/alertas#vencimiento", "Ver vencimientos"],
      ["Lote vencido con stock", "red", "Crema Centella · 50 ml · lote A117 en Breña: 3 und vencidas hace 18 días. No se despachan: registra la merma.", "/inventario/alertas#vencimiento", "Ver vencimientos"],
    ]);
    expect(alertCounts(ALERTS)).toEqual([
      { type: "lotes_por_vencer", title: "Lotes por vencer", tone: "amber", count: 3 },
      { type: "lotes_vencidos_con_stock", title: "Lote vencido con stock", tone: "red", count: 1 },
    ]);
  });

  it("sin el nombre todavía, dice «Lote X»; vence hoy", () => {
    const today: InventoryAlerts = { ...ALERTS, alerts: [{ ...ALERTS.alerts[0], count: 1, items: [lotItem("l9", "Z1", 0, 2)] }] };
    expect(alertRows(today)[0].description).toBe("Lote Z1 en Breña: 2 und vencen hoy. Véndelo primero, trasládalo o haz una promoción.");
  });

  it("pide los nombres solo de las variantes de las alertas de lotes encendidas", () => {
    const withOthers: InventoryAlerts = {
      ...ALERTS,
      alerts: [
        ...ALERTS.alerts,
        { type: "bajo_minimo", enabled: true, count: 1, items: [{ variantId: "v9" }] },
        { type: "lotes_vencidos_con_stock", enabled: false, count: 0, items: [{ variantId: "v8" }] },
      ],
    };
    expect(alertLotVariantIds(withOthers)).toEqual(["v1"]);
  });
});

const EXPIRING: ExpiringLots = {
  today: "2026-11-18",
  days: 90,
  alertDays: 30,
  items: [
    { lotId: "l3", lotNumber: "A117", variantId: "v1", inventoryId: "w1", inventoryName: "Breña", expiresAt: "2026-10-31", daysToExpiry: -18, status: "vencido", quantity: 3, averageCost: 10, value: 30 },
    { lotId: "l2", lotNumber: "L2402", variantId: "v1", inventoryId: "w1", inventoryName: "Breña", expiresAt: "2026-11-25", daysToExpiry: 7, status: "vigente", quantity: 12, averageCost: 10, value: 120 },
    { lotId: "l4", lotNumber: "B500", variantId: "v2", inventoryId: "w2", inventoryName: "Arequipa", expiresAt: "2027-02-01", daysToExpiry: 75, status: "bloqueado", quantity: 5, averageCost: null, value: null },
  ],
  truncated: false,
  totals: {
    expired: { lots: 1, units: 3, value: 30, withoutCost: { lots: 0, units: 0 } },
    withinAlert: { lots: 1, units: 12, value: 120, withoutCost: { lots: 0, units: 0 } },
    later: { lots: 1, units: 5, value: 0, withoutCost: { lots: 1, units: 5 } },
    all: { lots: 3, units: 20, value: 150, withoutCost: { lots: 1, units: 5 } },
  },
  lostByExpiry: [
    { period: "2026-08", units: 4, value: 64.8, unitsWithoutCost: 0 },
    { period: "2026-09", units: 8, value: 129.6, unitsWithoutCost: 0 },
    { period: "2026-10", units: 0, value: 0, unitsWithoutCost: 0 },
    { period: "2026-11", units: 2, value: 20, unitsWithoutCost: 1 },
  ],
};

const masked = (): ExpiringLots => ({
  ...EXPIRING,
  items: EXPIRING.items.map((row) => {
    const copy = { ...row };
    delete copy.averageCost;
    delete copy.value;
    return copy;
  }),
  totals: Object.fromEntries(Object.entries(EXPIRING.totals).map(([key, total]) => [key, { lots: total.lots, units: total.units }])) as ExpiringLots["totals"],
  lostByExpiry: EXPIRING.lostByExpiry.map((month) => ({ period: month.period, units: month.units })),
});

const NAMES = new Map([
  ["v1", { name: "Crema Centella · 50 ml", sku: "CRE-50" }],
  ["v2", { name: "Sérum", sku: "SER-30" }],
]);

const sheetRows = (workbook: ExcelJS.Workbook, name: string) => {
  const rows: unknown[][] = [];
  workbook.getWorksheet(name)!.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
};

describe("Vencimiento en dinero", () => {
  const filters = expiryFilterRows({ inventoryName: "", days: 90, alertDays: 30 });

  it("textos y colores de cada lote", () => {
    expect(EXPIRING.items.map((row) => [expiryLabel(row), expiryTone(row, 30)])).toEqual([
      ["Vencido hace 18 días", "red"],
      ["En 7 días", "amber"],
      ["En 75 días · Bloqueado", "neutral"],
    ]);
    expect(lostTotal(EXPIRING)).toBeCloseTo(214.4);
    expect(lostByMonthText(masked())).toBe("Ago •••• · Sep •••• · Oct •••• · Nov ••••");
    expect(lostTotal(masked())).toBeUndefined();
  });

  it("Excel con costos: lotes con valor y lo perdido por mes", () => {
    const workbook = expiryWorkbook(EXPIRING, { names: NAMES, filters, now: new Date("2026-11-18T15:30:00Z") });
    const [header, first] = sheetRows(workbook, "Lotes por vencer");
    expect(header).toEqual(["Producto", "SKU", "Lote", "Almacén", "Vence", "Días", "Estado", "Unidades", "Costo prom.", "Valor"]);
    expect(first).toEqual(["Crema Centella · 50 ml", "CRE-50", "A117", "Breña", "31/10/2026", -18, "Vencido hace 18 días", 3, 10, 30]);
    const lost = sheetRows(workbook, "Perdido por vencimiento");
    expect(lost[0]).toEqual(["Mes", "Unidades", "Valor", "Unidades sin costo"]);
    expect(lost.at(-1)).toEqual(["Noviembre (a la fecha) 2026", 2, 20, 1]);
    expect(sheetRows(workbook, "Filtros").slice(3)).toEqual([
      ["Almacén", "Todos los almacenes"],
      ["Vence en", "90 días o menos (y lo ya vencido)"],
      ["Días de aviso", "30"],
    ]);
  });

  it("sin rol de costos no hay columnas de valor y el PDF los oculta", () => {
    const workbook = expiryWorkbook(masked(), { names: NAMES, filters });
    expect(sheetRows(workbook, "Lotes por vencer")[0]).not.toEqual(expect.arrayContaining(["Valor", "Costo prom."]));
    expect(sheetRows(workbook, "Perdido por vencimiento")[0]).toEqual(["Mes", "Unidades"]);
    const pdf = expiryPdfSpec(masked(), { names: NAMES, filters, today: "2026-11-18" });
    expect(pdf.tables[0].rows[0]).toEqual(["Crema Centella · 50 ml", "CRE-50", "A117", "Breña", "31/10/2026", "Vencido hace 18 días", 3, "••••"]);
    expect(pdf.foot).toEqual([
      ["Ya vencido", "••••"],
      ["Vence en 30 días", "••••"],
      ["Vence en 31–90 días", "••••"],
      ["Perdido por vencimiento", "••••"],
    ]);
    expect(pdf.fileName).toBe("vencimiento-2026-11-18");
  });
});
