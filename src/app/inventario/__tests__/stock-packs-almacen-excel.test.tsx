/**
 * Tests: packs en «Por almacén» y en el Excel de Stock (FEAT-24 H9).
 *
 * 1. «Por almacén»: cada tarjeta lista, al final, los packs con disponible calculado en ese almacén (sin
 *    físico ni reservado propios) y no los suma al resumen del almacén.
 * 2. Excel: una sección «Packs» al final, con una fila por pack y almacén visible y su disponible calculado.
 */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import Inventory from "../_components/InventarioView";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { listAllPacks, type PackView } from "@/services/packsService";

const mockAddedRows: Array<Record<string, unknown>> = [];
jest.mock("exceljs", () => ({
  __esModule: true,
  default: {
    Workbook: jest.fn().mockImplementation(() => ({
      addWorksheet: () => ({
        columns: [],
        getRow: () => ({}),
        addRow: (row: Record<string, unknown>) => {
          mockAddedRows.push(row);
          return {};
        },
      }),
      xlsx: { writeBuffer: async () => new ArrayBuffer(0) },
    })),
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/userWarehousesService", () => ({ getMyWarehouses: jest.fn().mockResolvedValue({ all: true, inventoryIds: [], operableIds: [] }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => <span /> }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "test-token", company: { id: "company-a", stores: [] }, user: { id: "user-a", role: "ADMINISTRADOR" } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["s-a", "s-b"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({
  useBusinessInventories: () => ({
    inventories: [
      { id: "warehouse-a", name: "Principal", storeId: "s-a", storeName: "Tienda A" },
      { id: "warehouse-b", name: "Web", storeId: "s-b", storeName: "Tienda Web" },
    ],
    isSuccess: true, isPending: false, refetch: jest.fn(),
  }),
}));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => null }));
jest.mock("@/components/inventory/ReconciliationTab", () => ({ ReconciliationTab: () => null }));
jest.mock("@/components/modals/ImportExcelModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/productos/shopify-sync-wizard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn().mockResolvedValue({ warehouses: [], links: [] }) }));
jest.mock("@/services/packsService", () => ({ listAllPacks: jest.fn() }));

const rows = [
  { inventoryItemId: "ii-a", productId: "p-polo", variantId: "v-polo", productName: "Polo", sku: "POL", price: 20, priceVta: 20, physicalStock: 4, reservedStock: 1, availableStock: 3, inventoryId: "warehouse-a", inventoryName: "Principal", storeId: "s-a", storeName: "Tienda A" },
  { inventoryItemId: "ii-b", productId: "p-polo", variantId: "v-polo", productName: "Polo", sku: "POL", price: 20, priceVta: 20, physicalStock: 10, reservedStock: 0, availableStock: 10, inventoryId: "warehouse-b", inventoryName: "Web", storeId: "s-b", storeName: "Tienda Web" },
];
const PACK = {
  id: "pack-1", variantId: "pack-1-v", name: "Pack Verano", description: null, sku: "PK-VER", productSku: null, powipEan: null, barcode: null,
  imageUrl: null, price: 50, active: true, categoryId: null, brandId: null, components: [],
  available: { total: 6, byWarehouse: [{ inventoryId: "warehouse-a", inventoryName: "Principal", storeId: "s-a", available: 1 }, { inventoryId: "warehouse-b", inventoryName: "Web", storeId: "s-b", available: 5 }] },
} as PackView;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Inventory /></QueryClientProvider>);
}

beforeAll(() => {
  Object.assign(window.URL, { createObjectURL: jest.fn(() => "blob:x"), revokeObjectURL: jest.fn() });
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
beforeEach(() => {
  jest.clearAllMocks();
  mockAddedRows.length = 0;
  jest.mocked(fetchBusinessInventoryItems).mockResolvedValue(rows);
  jest.mocked(listAllPacks).mockResolvedValue([PACK]);
});

it("«Por almacén» lista los packs de cada almacén al final, sin sumarlos al resumen", async () => {
  setup();
  await screen.findAllByText("Polo");
  fireEvent.click(screen.getByRole("button", { name: "Por almacén" }));
  const web = screen.getByRole("region", { name: "Almacén Web" });
  const row = await within(web).findByTestId("pack-warehouse-warehouse-b-pack-1");
  expect(within(web).getByText(/Packs · su stock es el de sus componentes/i)).toBeInTheDocument();
  expect(within(row).getByRole("link", { name: "Pack Verano" })).toHaveAttribute("href", "/productos/pack-1");
  expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Pack VeranoCalculado", "PK-VER", "—", "—", "5"]);
  expect(web).toHaveTextContent("1 SKU · 10 físico · 0 reservado · 10 disponible · 1 pack");
  expect(within(screen.getByRole("region", { name: "Almacén Principal" })).getByTestId("pack-warehouse-warehouse-a-pack-1")).toHaveTextContent("1");
});

it("el Excel de Stock trae una sección «Packs» con el disponible calculado por almacén", async () => {
  setup();
  await screen.findAllByText("Polo");
  await waitFor(() => expect(listAllPacks).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Exportar en Excel" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exportados 2 producto(s) y 1 pack(s)"));
  const title = mockAddedRows.findIndex((row) => row.companySku === "Packs · su stock es el de sus componentes");
  expect(title).toBeGreaterThan(1);
  expect(mockAddedRows.slice(title + 1)).toEqual([
    expect.objectContaining({ companySku: "PK-VER", name: "Pack Verano", variante: "Pack", store: "Tienda A", inventory: "Principal", stock: "", reservado: "", disponible: 1, precio: 50 }),
    expect.objectContaining({ companySku: "PK-VER", name: "Pack Verano", variante: "Pack", store: "Tienda Web", inventory: "Web", stock: "", reservado: "", disponible: 5, precio: 50 }),
  ]);
  expect(toast.warning).not.toHaveBeenCalled();
});

it("si los packs no se pueden leer, el Excel sale igual y lo avisa", async () => {
  jest.mocked(listAllPacks).mockRejectedValue(new Error("caído"));
  setup();
  await screen.findAllByText("Polo");
  fireEvent.click(screen.getByRole("button", { name: "Exportar en Excel" }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exportados 2 producto(s)"));
  expect(toast.warning).toHaveBeenCalledWith("El Excel salió sin packs: no se pudo leer su stock calculado.");
  expect(mockAddedRows.some((row) => row.variante === "Pack")).toBe(false);
});
