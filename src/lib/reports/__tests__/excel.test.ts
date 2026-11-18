/**
 * @jest-environment node
 */
import type ExcelJS from "exceljs";
import { stockReportWorkbook, stockReportFilterRows, stockReportPdfSpec } from "../stockReport";
import { kardexFilterRows, kardexWorkbook } from "../kardex";
import { purchasesReportWorkbook } from "../purchasesReport";
import type { KardexRow, PurchasesReport, StockReportData } from "@/services/inventoryReportsService";

// FEAT-24 H10-D5 — Excel de los reportes: la hoja «Filtros» repite los filtros de la pantalla y las columnas
// de valor no existen para quien no ve costos.

const NOW = new Date("2026-11-18T15:30:00Z");

const sheetRows = (workbook: ExcelJS.Workbook, name: string) => {
  const sheet = workbook.getWorksheet(name)!;
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
};

const REPORT: StockReportData = {
  available: true,
  date: "2026-11-18",
  asOf: "2026-11-18T15:30:00Z",
  source: "live",
  closePeriod: null,
  cutoffAt: "2026-09-01T05:00:00Z",
  warehouses: [
    { id: "w1", name: "Central", type: "PROPIO", isMain: true, active: true },
    { id: "w2", name: "Olva", type: "COURIER", isMain: false, active: true },
  ],
  items: [
    {
      variantId: "v1", physical: 12, reserved: 2, available: 10, inTransit: 3, pendingReturn: 1, averageCost: 25.5, value: 306,
      warehouses: [
        { inventoryId: "w1", physical: 10, reserved: 2, available: 8, inTransit: 3, pendingReturn: 0, value: 255 },
        { inventoryId: "w2", physical: 2, reserved: 0, available: 2, inTransit: 0, pendingReturn: 1, value: 51 },
      ],
      productId: "p1", productName: "Polo", sku: "INT-1", companySku: "POL-M", attributes: { Talla: "M" }, brandName: "Nike", categoryName: "Polos",
    },
  ],
  totals: { variants: 1, physical: 12, reserved: 2, available: 10, value: 306, withoutCost: { variants: 0, units: 0 } },
  total: 1,
  page: 1,
  limit: 50,
};

/** Lo que llega a quien no ve costos: la fachada omite las claves. */
function withoutCosts(report: StockReportData): StockReportData {
  const { value: _v, ...totals } = report.totals;
  return {
    ...report,
    totals: totals as StockReportData["totals"],
    items: report.items.map(({ averageCost: _a, value: _b, warehouses, ...item }) => ({ ...item, warehouses: warehouses.map(({ value: _c, ...cell }) => cell) })),
  };
}

const filters = stockReportFilterRows({ date: "", inventoryId: "w1", q: "polo", onlyWithStock: true }, (id) => (id === "w1" ? "Central" : id));

describe("Excel del reporte general", () => {
  it("empieza con los filtros de la pantalla", () => {
    const workbook = stockReportWorkbook(REPORT, { filters, canSeeCosts: true, generatedBy: "Ana Pérez", now: NOW });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Filtros", "Resumen", "Detalle por almacén"]);
    expect(sheetRows(workbook, "Filtros")).toEqual([
      ["Dato", "Valor"],
      ["Reporte", "Reporte general de inventario · Stock de hoy"],
      ["Generado el", "18/11/2026 10:30"],
      ["Generado por", "Ana Pérez"],
      ["Fecha", "Hoy"],
      ["Almacén", "Central"],
      ["Búsqueda", "polo"],
      ["Solo con stock", "Sí"],
    ]);
  });

  it("tiene una columna por almacén, el total, en camino y el valor con permiso", () => {
    const workbook = stockReportWorkbook(REPORT, { filters, canSeeCosts: true, now: NOW });
    const [header, row] = sheetRows(workbook, "Resumen");
    expect(header).toEqual(["SKU", "Producto", "Marca", "Categoría", "Central (disponible)", "Olva (disponible)", "Físico", "Reservado", "Disponible", "En camino", "Por recibir", "Costo prom.", "Valor"]);
    expect(row).toEqual(["POL-M", "Polo · Talla: M", "Nike", "Polos", 8, 2, 12, 2, 10, 3, 1, 25.5, 306]);
    expect(sheetRows(workbook, "Detalle por almacén")[2]).toEqual(["Olva", "POL-M", "Polo · Talla: M", 2, 0, 2, 0, 1, 51]);
  });

  it("sin rol de costos no hay columnas de valor (ni en el PDF)", () => {
    const workbook = stockReportWorkbook(withoutCosts(REPORT), { filters, canSeeCosts: false, now: NOW });
    const [header] = sheetRows(workbook, "Resumen");
    expect(header).not.toContain("Valor");
    expect(header).not.toContain("Costo prom.");
    expect(sheetRows(workbook, "Detalle por almacén")[0]).not.toContain("Valor");
    const pdf = stockReportPdfSpec(withoutCosts(REPORT), { filters, canSeeCosts: false });
    expect(pdf.tables[0].head).not.toContain("Valor");
    expect(pdf.foot?.map(([label]) => label)).not.toContain("Valor del inventario");
  });

  it("una fecha pasada no tiene «en camino» y el filtro de almacén deja solo esa columna", () => {
    const past = { ...REPORT, source: "ledger" as const, date: "2026-10-31" };
    const workbook = stockReportWorkbook(past, { filters, canSeeCosts: true, inventoryId: "w2", now: NOW });
    const [header] = sheetRows(workbook, "Resumen");
    expect(header).toContain("Olva (disponible)");
    expect(header).not.toContain("Central (disponible)");
    expect(header).not.toContain("En camino");
  });
});

const KARDEX: KardexRow[] = [
  {
    id: "m1", createdAt: "2026-11-17T17:47:00Z", type: "ENTRADA_COMPRA", variantId: "v1", inventoryId: "w1", inventoryName: "Central", quantity: 24,
    physicalDelta: 24, reservedDelta: 0, physicalAfter: 36, reservedAfter: 2, transitDelta: 0, unitCost: 10, averageCostAfter: 9.5, value: 240,
    reason: "PURCHASE_RECEPTION - OC-0001 - REC-0001", referenceType: "PURCHASE", referenceId: "OC-0001", referenceNumber: "REC-0001",
    userEmail: "ops@kunca.pe", userName: "Operaciones", productId: "p1", productName: "Polo", sku: "INT-1", companySku: "POL-M", attributes: { Talla: "M" },
  },
  {
    id: "m2", createdAt: "2026-11-16T15:00:00Z", type: "DEVOLUCION_EN_CAMINO", variantId: "v1", inventoryId: "w1", inventoryName: "Central", quantity: 1,
    physicalDelta: 0, reservedDelta: 0, physicalAfter: 12, reservedAfter: 2, transitDelta: -1, pendingReturnDelta: 1, unitCost: null, averageCostAfter: null, value: null,
    reason: "order.cancelled:4", referenceType: "ORDER", referenceId: "0f8fad5b-d9cb-469f-a165-70867728950e", referenceNumber: null,
    userEmail: null, userName: null, productId: "p1", productName: "Polo", sku: "INT-1", companySku: null, attributes: { Talla: "M" },
  },
];

describe("Excel del kardex", () => {
  const kardexFilters = kardexFilterRows({ variantLabel: "Polo · Talla: M", inventoryName: "Central", type: "ENTRADA_COMPRA", from: "2026-11-01", to: "", document: "" });

  it("lleva los filtros, los tipos en español y el número de pedido", () => {
    const workbook = kardexWorkbook(KARDEX, {
      filters: kardexFilters, canSeeCosts: true, now: NOW,
      orderNumbers: { "0f8fad5b-d9cb-469f-a165-70867728950e": "ORD-150200" },
    });
    expect(sheetRows(workbook, "Filtros").slice(3)).toEqual([
      ["Producto", "Polo · Talla: M"],
      ["Almacén", "Central"],
      ["Tipo", "Entrada por compra"],
      ["Desde", "01/11/2026"],
      ["Hasta", "—"],
      ["Documento", "—"],
    ]);
    const [header, first, second] = sheetRows(workbook, "Movimientos");
    expect(header).toEqual(["Fecha y hora", "Tipo", "Detalle", "SKU", "Producto", "Almacén", "Físico", "Saldo físico", "Reservado", "Saldo reservado", "En camino", "Costo unit.", "Valor", "Costo prom. después", "Referencia", "Usuario"]);
    expect(first).toEqual(["17/11/26, 12:47", "Entrada por compra", "", "POL-M", "Polo · Talla: M", "Central", 24, 36, undefined, undefined, undefined, 10, 240, 9.5, "REC-0001", "Operaciones"]);
    expect(second[1]).toBe("Devolución en camino");
    expect(second[14]).toBe("ORD-150200");
    expect(second[15]).toBe("Sistema");
  });

  it("sin rol de costos no hay columnas de costo; si se cortó, lo avisa", () => {
    const masked = KARDEX.map(({ unitCost: _a, value: _b, averageCostAfter: _c, ...row }) => row as KardexRow);
    const workbook = kardexWorkbook(masked, { filters: kardexFilters, canSeeCosts: false, truncated: true, now: NOW });
    expect(sheetRows(workbook, "Movimientos")[0]).not.toEqual(expect.arrayContaining(["Costo unit.", "Valor"]));
    expect(sheetRows(workbook, "Filtros").at(-1)).toEqual(["Aviso", "Hay más de 10.000 movimientos: se exportaron los 10.000 más nuevos."]);
  });
});

describe("Excel del reporte de compras", () => {
  const PURCHASES: PurchasesReport = {
    from: "2026-07-01", to: "2026-09-30",
    totals: { amount: 1500, units: 60, orders: 3, suppliers: 2, averageTicket: 500 },
    byMonth: [{ month: "2026-07", amount: 500, units: 20, orders: 1 }],
    bySupplier: [{ supplierId: "s1", supplierName: "Textiles Lima", amount: 1000, units: 40, orders: 2, share: 0.6667, lastDate: "2026-09-10" }],
    byVariant: [{ variantId: "v1", sku: "POL-M", productName: "Polo", productId: "p1", attributes: { Talla: "M" }, units: 40, amount: 1000, averageUnitCost: 25, suppliers: [{ supplierId: "s1", supplierName: "Textiles Lima" }] }],
    byProduct: [{ productId: "p1", productName: "Polo", brandName: "Nike", categoryName: null, units: 40, amount: 1000, variants: 1, share: 0.6667 }],
    byBrand: [{ brandId: null, brandName: null, units: 40, amount: 1000, variants: 1, share: 0.6667 }],
    byCategory: [{ categoryId: "c1", categoryName: "Polos", units: 40, amount: 1000, variants: 1, share: 0.6667 }],
    topProducts: [], topSuppliers: [], topSupplier: null,
    orders: [{ id: "o1", number: "OC-0001", date: "2026-09-10", origin: "order", status: "RECIBIDA", supplierNames: ["Textiles Lima"], units: 40, amount: 1000 }],
  };

  it("trae el periodo y las hojas por proveedor, producto, marca, categoría y mes", () => {
    const workbook = purchasesReportWorkbook(PURCHASES, { rangeLabel: "jul–set 2026", now: NOW });
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Filtros", "Proveedores", "Productos", "Variantes", "Marcas", "Categorías", "Por mes", "Órdenes"]);
    expect(sheetRows(workbook, "Filtros")[3]).toEqual(["Periodo", "jul–set 2026"]);
    expect(sheetRows(workbook, "Proveedores")[1]).toEqual(["Textiles Lima", 1000, "67%", 40, 2, "10/09/2026"]);
    expect(sheetRows(workbook, "Productos")[1]).toEqual(["Polo", "Nike", "Sin categoría", 40, 1000, 25]);
    expect(sheetRows(workbook, "Marcas")[1]).toEqual(["Sin marca", 40, 1000, "67%"]);
    expect(sheetRows(workbook, "Por mes")[1]).toEqual(["Julio 2026", 500, 20, 1]);
  });
});
