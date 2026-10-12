import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Inventory from "../page";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
jest.mock("exceljs", () => ({ __esModule: true, default: { Workbook: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => <span /> }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "test-token", company: { id: "company-a", stores: [{ id: "empty-store", name: "Tienda vacía" }] }, user: { id: "user-a" } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["empty-store", "stocked-store"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "warehouse-a", name: "Principal", storeId: "empty-store" }, { id: "warehouse-b", name: "Web", storeId: "stocked-store" }], isSuccess: true, isPending: false, refetch: jest.fn() }) }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => null }));
jest.mock("@/components/inventory/ReconciliationTab", () => ({ ReconciliationTab: () => null }));
jest.mock("@/components/modals/ImportExcelModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/DeleteInventoryItemModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/AddStockModal", () => ({ __esModule: true, default: ({ item, open }: { item?: { inventoryItemId: string }; open: boolean }) => open ? <div data-testid="adjust-target">{item?.inventoryItemId}</div> : null }));
jest.mock("@/app/productos/shopify-sync-wizard", () => ({ __esModule: true, default: () => null }));
const fetch = jest.mocked(fetchBusinessInventoryItems);
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Inventory /></QueryClientProvider>);
}
const rows = Array.from({ length: 12 }, (_, index) => ({ inventoryItemId: `physical-item-${index}`, productId: "product", variantId: "variant", productName: `Producto ${String(index).padStart(2, "0")}`, sku: `SKU-${index}`, price: 20, physicalStock: 4, availableStock: 3, inventoryId: "warehouse-b", inventoryName: "Web", storeId: "stocked-store", storeName: "Tienda Web" }));
beforeEach(() => fetch.mockReset());
it("renders the business union with totals and real pagination despite the selected empty store", async () => {
  fetch.mockResolvedValue(rows); setup();
  await waitFor(() => expect(screen.getByText(/12 posiciones/)).toHaveTextContent("Stock físico: 48 · Disponible: 36"));
  expect(screen.getByText("Producto 00")).toBeInTheDocument();
  expect(screen.queryByText("Producto 10")).not.toBeInTheDocument();
  expect(screen.getAllByText("Tienda Web · Web")).toHaveLength(10);
  fireEvent.change(screen.getByPlaceholderText("Buscar por SKU, nombre o variante..."), { target: { value: "SKU-11" } });
  await waitFor(() => expect(screen.getByText("Producto 11")).toBeInTheDocument());
  fireEvent.click(screen.getByTitle("Ajustar Stock"));
  expect(screen.getByTestId("adjust-target")).toHaveTextContent("physical-item-11");
});
it("shows an authorization error and retry without displaying zero-stock totals", async () => {
  fetch.mockRejectedValue(new Error("401 Unauthorized")); setup();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("401 Unauthorized"));
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  expect(screen.queryByText(/0 posiciones/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Exportar en Excel" })).toBeDisabled();
});
