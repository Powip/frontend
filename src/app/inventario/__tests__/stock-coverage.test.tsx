/**
 * Tests: Stock › columna «Cobertura» (FEAT-24 H13-D2).
 *
 * 1. Con la cobertura cargada: «N días», «—» si no hubo ventas, ámbar bajo los días objetivo y rojo en 0;
 *    la paginación no cambia y el Excel suma «Cobertura (días)».
 * 2. Pide la cobertura del almacén elegido (o del único de la vista).
 * 3. Si la cobertura no llegó (falla o servidor anterior), no hay columna y el Excel queda igual.
 * 4. Los packs al final de Stock (FEAT-24 H9) mantienen la columna con «—» y el encabezado PACKS la abarca.
 */

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { useStockCoverage, type StockCoverage } from "@/hooks/useStockCoverage";
import { listAllPacks, type PackView } from "@/services/packsService";
import InventarioView from "../_components/InventarioView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "user-1", role: "ADMINISTRADOR" }, company: { id: "company-1", stores: [{ id: "store-1", name: "Principal" }] } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["store-1"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "inv-1", name: "Almacén Principal", storeId: "store-1" }], isSuccess: true, isPending: false, refetch: jest.fn() }) }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/userWarehousesService", () => ({ getMyWarehouses: jest.fn().mockResolvedValue({ all: true, inventoryIds: [], operableIds: [] }) }));
jest.mock("@/hooks/useInventoryAlerts", () => ({ useInventoryAlerts: () => ({ data: { generatedAt: "", total: 0, alerts: [] } }) }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn().mockResolvedValue({ warehouses: [], links: [] }) }));
jest.mock("@/hooks/useStockCoverage", () => ({ useStockCoverage: jest.fn() }));
jest.mock("@/services/packsService", () => ({ listAllPacks: jest.fn() })); // FEAT-24 H9
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), usePathname: () => "/inventario/stock" }));
jest.mock("next/image", () => ({ __esModule: true, default: () => <span /> }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("exceljs", () => {
  const rows: Array<Record<string, unknown>> = [];
  const sheets: Array<{ columns: Array<{ header: string; key: string }> }> = [];
  class Workbook {
    xlsx = { writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)) };
    addWorksheet() {
      const sheet = { columns: [] as Array<{ header: string; key: string }>, addRow: (row: Record<string, unknown>) => rows.push(row), getRow: () => ({}) };
      sheets.push(sheet);
      return sheet;
    }
  }
  return { __esModule: true, default: { Workbook }, Workbook, __rows: rows, __sheets: sheets };
});

const excelMock = jest.requireMock("exceljs") as { __rows: Array<Record<string, unknown>>; __sheets: Array<{ columns: Array<{ header: string }> }> };
const rowsOf = () => excelMock.__rows;
const sheetsOf = () => excelMock.__sheets;

const item = (id: string, name: string, available: number): BusinessInventoryItem => ({
  inventoryItemId: `ii-${id}`,
  productId: `p-${id}`,
  variantId: `v-${id}`,
  productName: name,
  sku: `SKU-${id}`,
  price: 100,
  priceVta: 100,
  availableStock: available,
  physicalStock: available,
  reservedStock: 0,
  inventoryId: "inv-1",
  inventoryName: "Almacén Principal",
  storeId: "store-1",
  storeName: "Principal",
});

function coverage(value: Partial<StockCoverage>) {
  jest.mocked(useStockCoverage).mockReturnValue({ byVariant: undefined, targetDays: 30, windowDays: 30, ...value });
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InventarioView tab="stock" />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  window.URL.createObjectURL = jest.fn(() => "blob:mock");
  window.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  rowsOf().length = 0;
  jest.mocked(listAllPacks).mockResolvedValue([]);
  jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([item("a", "Polo", 40), item("b", "Gorra", 3), item("c", "Media", 0), item("d", "Bufanda", 8)]);
});

it("muestra la cobertura con «—» sin ventas y colores bajo el objetivo; el Excel la suma", async () => {
  coverage({
    byVariant: new Map([
      ["v-a", { vd: 1, coverageDays: 40 }],
      ["v-b", { vd: 1, coverageDays: 3 }],
      ["v-c", { vd: 2, coverageDays: 0 }],
      ["v-d", { vd: 0, coverageDays: null }],
    ]),
    targetDays: 30,
  });
  renderView();
  await screen.findByText("Polo");
  expect(screen.getByRole("columnheader", { name: "Cobertura" })).toBeInTheDocument();
  expect(screen.getByTestId("coverage-v-a")).toHaveTextContent("40 días");
  expect(screen.getByTestId("coverage-v-a").className).not.toMatch(/amber|destructive/);
  expect(screen.getByTestId("coverage-v-b")).toHaveTextContent("3 días");
  expect(screen.getByTestId("coverage-v-b").className).toMatch(/amber/);
  expect(screen.getByTestId("coverage-v-c")).toHaveTextContent("0 días");
  expect(screen.getByTestId("coverage-v-c").className).toMatch(/destructive/);
  expect(screen.getByTestId("coverage-v-d")).toHaveTextContent("—");
  // Una sola vista de almacén: la cobertura se pide de ese almacén y solo en la pestaña Stock.
  expect(useStockCoverage).toHaveBeenLastCalledWith({ inventoryId: "inv-1", enabled: true });

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /exportar en excel/i }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exportados 4 producto(s)"));
  expect(sheetsOf().at(-1)!.columns.map((column) => column.header).at(-1)).toBe("Cobertura (días)");
  expect(rowsOf().find((row) => row.name === "Gorra")).toMatchObject({ cobertura: 3 });
  expect(rowsOf().find((row) => row.name === "Bufanda")).toMatchObject({ cobertura: "Sin ventas" });
});

it("sin cobertura (falló o servidor anterior) no hay columna y el Excel queda igual", async () => {
  coverage({ byVariant: undefined });
  renderView();
  const table = (await screen.findByText("Polo")).closest("table") as HTMLElement;
  expect(within(table).queryByRole("columnheader", { name: "Cobertura" })).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /exportar en excel/i }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(sheetsOf().at(-1)!.columns.map((column) => column.header)).not.toContain("Cobertura (días)");
  expect(rowsOf().every((row) => !("cobertura" in row))).toBe(true);
});

it("la fila de cada pack tiene la celda de Cobertura con «—» y el encabezado PACKS abarca la columna", async () => {
  coverage({ byVariant: new Map([["v-a", { vd: 1, coverageDays: 40 }]]), targetDays: 30 });
  jest.mocked(listAllPacks).mockResolvedValue([
    {
      id: "pack-1", variantId: "pack-1-v", name: "Pack Verano", description: null, sku: "PK-VER", productSku: null, powipEan: null, barcode: null,
      imageUrl: null, price: 50, active: true, categoryId: null, brandId: null, components: [],
      available: { total: 2, byWarehouse: [{ inventoryId: "inv-1", inventoryName: "Almacén Principal", storeId: "store-1", available: 2 }] },
    } as PackView,
  ]);
  renderView();
  const row = await screen.findByTestId("pack-stock-pack-1");
  expect(within(row).getByTestId("pack-coverage-pack-1")).toHaveTextContent("—");
  const headers = within(screen.getByRole("table")).getAllByRole("columnheader");
  expect(within(row).getAllByRole("cell")).toHaveLength(headers.length);
  const groupHeader = screen.getByText(/Packs · su stock es el de sus componentes/i).closest("td") as HTMLTableCellElement;
  expect(groupHeader.colSpan).toBe(headers.length);
});
