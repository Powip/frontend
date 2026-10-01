/**
 * @jest-environment node
 */
/**
 * Tests: exportSalesToExcel / formatProductsForExport (Ventas y Pedidos → Exportar Excel)
 *
 * Relee el .xlsx generado (SheetJS real, file-saver mockeado) para verificar:
 * 1. "Productos" lista los ítems reales de cada orden ("Nombre (atributos) xCant").
 * 2. Una fila por orden y "Total" sigue siendo el total de la orden.
 * 3. Solo una orden sin ítems queda con "-".
 * 4. Con filtro por producto aparece "Unidades del producto filtrado" (y sin filtro, no).
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  exportSalesToExcel,
  FILTERED_PRODUCT_UNITS_HEADER,
  formatProductsForExport,
  type SaleExportData,
} from "../exportSalesExcel";

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

const mockedSaveAs = jest.mocked(saveAs);

function sale(overrides: Partial<SaleExportData> = {}): SaleExportData {
  return {
    orderNumber: "ORD-001",
    clientName: "Juan Pérez",
    phoneNumber: "999111222",
    date: "1/9/2026",
    total: 150.5,
    advancePayment: 50,
    pendingPayment: 100.5,
    status: "PENDIENTE",
    salesRegion: "LIMA",
    district: "Miraflores",
    address: "Av. Test 123",
    paymentMethod: "YAPE",
    deliveryType: "DOMICILIO",
    ...overrides,
  };
}

async function exportedRows(sales: SaleExportData[]) {
  exportSalesToExcel(sales, "ventas_test");
  const blob = mockedSaveAs.mock.calls.at(-1)![0] as Blob;
  const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
}

beforeEach(() => mockedSaveAs.mockClear());

describe("formatProductsForExport", () => {
  it("nombre, atributos y cantidad de cada ítem, separados por '; '", () => {
    expect(
      formatProductsForExport([
        { productName: "Polo, algodón", quantity: 2, attributes: { Talla: "M", Color: "Negro" } },
        { productName: "Gorra", quantity: 1, attributes: {} },
      ]),
    ).toBe("Polo, algodón (M / Negro) x2; Gorra x1");
  });

  it("sin ítems devuelve vacío", () => {
    expect(formatProductsForExport([])).toBe("");
    expect(formatProductsForExport(undefined)).toBe("");
  });
});

describe("exportSalesToExcel — columna Productos", () => {
  it("completa Productos con los ítems de cada orden, una fila por orden y sin tocar el total", async () => {
    const rows = await exportedRows([
      sale({
        orderNumber: "ORD-001",
        total: 150.5,
        products: formatProductsForExport([
          { productName: "Polo", quantity: 2, attributes: { Talla: "M" } },
          { productName: "Gorra", quantity: 1 },
        ]),
      }),
      sale({ orderNumber: "ORD-002", total: 80, products: formatProductsForExport([]) }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Orden: "ORD-001", Productos: "Polo (M) x2; Gorra x1", Total: "150.50" });
    expect(rows[1]).toMatchObject({ Orden: "ORD-002", Productos: "-", Total: "80.00" });
  });

  it("con filtro por producto agrega 'Unidades del producto filtrado' después de Productos, sin tocar Total", async () => {
    exportSalesToExcel(
      [
        sale({ orderNumber: "ORD-001", total: 150.5, products: "Polo (M) x2; Gorra x1", filteredProductUnits: 2 }),
        sale({ orderNumber: "ORD-002", total: 80, products: "Polo (M) x1; Polo (M) x3", filteredProductUnits: 4 }),
      ],
      "ventas_test",
    );
    const blob = mockedSaveAs.mock.calls.at(-1)![0] as Blob;
    const wb = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const [header] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    expect(header.slice(header.indexOf("Productos"), header.indexOf("Productos") + 3)).toEqual([
      "Productos",
      FILTERED_PRODUCT_UNITS_HEADER,
      "Total",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Productos: "Polo (M) x2; Gorra x1", [FILTERED_PRODUCT_UNITS_HEADER]: 2, Total: "150.50" });
    expect(rows[1]).toMatchObject({ Productos: "Polo (M) x1; Polo (M) x3", [FILTERED_PRODUCT_UNITS_HEADER]: 4, Total: "80.00" });
  });

  it("sin filtro por producto no aparece la columna de unidades", async () => {
    const rows = await exportedRows([sale({ products: "Polo x1" })]);
    expect(rows[0]).not.toHaveProperty(FILTERED_PRODUCT_UNITS_HEADER);
  });

  it("sin el campo products la columna queda en '-' (causa del bug reportado)", async () => {
    const rows = await exportedRows([sale()]);
    expect(rows[0].Productos).toBe("-");
  });
});
