import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Inventory from "../_components/InventarioView";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
jest.mock("exceljs", () => ({ __esModule: true, default: { Workbook: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: () => <span /> }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "test-token", company: { id: "company-a", stores: [{ id: "empty-store", name: "Tienda vacía" }] }, user: { id: "user-a", role: "ADMINISTRADOR" } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["empty-store", "stocked-store"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "warehouse-a", name: "Principal", storeId: "empty-store" }, { id: "warehouse-b", name: "Web", storeId: "stocked-store" }], isSuccess: true, isPending: false, refetch: jest.fn() }) }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => null }));
jest.mock("@/components/inventory/ReconciliationTab", () => ({ ReconciliationTab: () => null }));
jest.mock("@/components/modals/ImportExcelModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/AdjustStockModal", () => ({ __esModule: true, default: ({ item, open }: { item?: { inventoryItemId: string }; open: boolean }) => open ? <div data-testid="adjust-target">{item?.inventoryItemId}</div> : null }));
jest.mock("@/app/productos/shopify-sync-wizard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn().mockResolvedValue({ warehouses: [{ id: "warehouse-b", name: "Web", status: true, store_id: "stocked-store", company_id: "company-a", type: "COURIER", is_main: true }], links: [] }) }));
const fetch = jest.mocked(fetchBusinessInventoryItems);
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Inventory /></QueryClientProvider>);
}
const rows = Array.from({ length: 12 }, (_, index) => ({ inventoryItemId: `physical-item-${index}`, productId: `product-${index}`, variantId: `variant-${index}`, productName: `Producto ${String(index).padStart(2, "0")}`, sku: `SKU-${index}`, price: 20, physicalStock: 4, availableStock: 3, inventoryId: "warehouse-b", inventoryName: "Web", storeId: "stocked-store", storeName: "Tienda Web" }));
beforeEach(() => fetch.mockReset());
it("renders the business union with totals and real pagination despite the selected empty store", async () => {
  fetch.mockResolvedValue(rows); setup();
  await waitFor(() => expect(screen.getByText(/12 producto\(s\)/)).toHaveTextContent("12 producto(s) · 12 variante(s)"));
  expect(screen.getByTestId("kpi-físico")).toHaveTextContent("48");
  expect(screen.getByTestId("kpi-reservado")).toHaveTextContent("0");
  expect(screen.getByTestId("kpi-disponible")).toHaveTextContent("36");
  expect(screen.getByText("Producto 00")).toBeInTheDocument();
  expect(screen.queryByText("Producto 10")).not.toBeInTheDocument();
  // una columna por almacén: cada variante de la página muestra su disponible y debajo físico y reservado
  for (const name of [/^Principal/, /^Web/]) expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
  expect(screen.getAllByText("4 fís · 0 res")).toHaveLength(10);
  fireEvent.change(screen.getByPlaceholderText("Buscar por SKU, nombre o variante..."), { target: { value: "SKU-11" } });
  await waitFor(() => expect(screen.getByText("Producto 11")).toBeInTheDocument());
  fireEvent.click(screen.getByTitle("Ajustar stock"));
  expect(screen.getByTestId("adjust-target")).toHaveTextContent("physical-item-11");
});
it("shows an authorization error and retry without displaying zero-stock totals", async () => {
  fetch.mockRejectedValue(new Error("401 Unauthorized")); setup();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("401 Unauthorized"));
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  expect(screen.queryByText(/0 producto\(s\)/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Exportar en Excel" })).toBeDisabled();
});
it("la vista por almacén muestra una tarjeta por almacén con sus totales", async () => {
  fetch.mockResolvedValue(rows); setup();
  await screen.findByText("Producto 00");
  fireEvent.click(screen.getByRole("button", { name: "Por almacén" }));
  expect(screen.getByRole("region", { name: "Almacén Web" })).toHaveTextContent("12 SKU · 48 físico · 0 reservado · 36 disponible");
  expect(screen.getByRole("region", { name: "Almacén Principal" })).toHaveTextContent("Sin stock en este almacén.");
  // tipo y «Principal» vienen de la pantalla de almacenes; el almacén que no figura ahí se muestra sin etiquetas
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Almacén Web" })).getByRole("heading")).toHaveTextContent("WebPrincipalCourier"));
  expect(within(screen.getByRole("region", { name: "Almacén Principal" })).getByRole("heading")).toHaveTextContent(/^Principal$/);
  expect(screen.getByText("Producto 11")).toBeInTheDocument(); // sin paginar: el almacén se ve entero
});
