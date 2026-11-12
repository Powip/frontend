/**
 * Excel de Ventas y Operaciones › columna «N° Externo» (FEAT-31): aparece junto a «Orden» solo si
 * algún pedido exportado lo trae (igual que en pantalla); el resto va vacío. Así Finanzas, que
 * comparte exportSalesToExcel y no maneja este dato, no cambia.
 */
jest.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => new ArrayBuffer(0)),
}));
jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

import * as XLSX from "xlsx";
import { exportSalesToExcel, type SaleExportData } from "../exportSalesExcel";

function sale(overrides: Partial<SaleExportData> = {}): SaleExportData {
  return {
    orderNumber: "ORD-001",
    clientName: "Cliente Uno",
    phoneNumber: "999111222",
    date: "25/9/2026",
    total: 100,
    advancePayment: 0,
    pendingPayment: 100,
    status: "PREPARADO",
    salesRegion: "LIMA",
    paymentMethod: "EFECTIVO",
    deliveryType: "DOMICILIO",
    ...overrides,
  } as SaleExportData;
}

function exportedRows(sales: SaleExportData[]): Record<string, unknown>[] {
  jest.mocked(XLSX.utils.json_to_sheet).mockClear();
  exportSalesToExcel(sales, "ventas");
  return jest.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0] as Record<string, unknown>[];
}

describe("exportSalesToExcel — N° Externo", () => {
  it("con algún pedido que lo trae, agrega la columna justo después de Orden y deja vacío el resto", () => {
    const rows = exportedRows([sale({ externalOrderNumber: "AGPE923190" }), sale({ orderNumber: "ORD-002" })]);

    expect(Object.keys(rows[0]).slice(0, 3)).toEqual(["N°", "Orden", "N° Externo"]);
    expect(rows[0]["N° Externo"]).toBe("AGPE923190");
    expect(rows[1]["N° Externo"]).toBe("");
  });

  it("sin ningún N° externo no agrega la columna", () => {
    const rows = exportedRows([sale(), sale({ orderNumber: "ORD-002", externalOrderNumber: null })]);

    expect(Object.keys(rows[0])).not.toContain("N° Externo");
  });
});
