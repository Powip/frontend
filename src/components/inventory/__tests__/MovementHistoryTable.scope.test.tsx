import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MovementHistoryTable } from "../MovementHistoryTable";
import { fetchScopedInventoryMovements, type InventoryMovement } from "@/services/inventoryMovementService";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a" }, accessToken: "test-token" } }) }));
jest.mock("@/services/inventoryMovementService", () => ({ ...jest.requireActual("@/services/inventoryMovementService"), fetchScopedInventoryMovements: jest.fn() }));
const fetch = jest.mocked(fetchScopedInventoryMovements);
const warehouses = [{ id: "warehouse-a", name: "Principal", storeId: "store-a" }];
const rows = Array.from({ length: 17 }, (_, index) => ({ id: `movement-${index}`, type: "IN", quantity: 2, reason: null, companyId: "company-a", userEmail: null, userName: null, referenceId: null, created_at: "2026-10-12T19:00:00Z", inventoryItem: { id: `item-${index}`, sku: `SKU-${index}`, product: { name: `Producto ${index}` } } })) as InventoryMovement[];
function setup(scope: "business" | "store" = "business") { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MovementHistoryTable companyId="company-a" scope={scope} inventories={warehouses} /></QueryClientProvider>); }
beforeEach(() => { fetch.mockReset(); fetch.mockResolvedValue(rows); });
it("paginates complete history and searches later pages without dropping same-day records", async () => {
  setup(); await screen.findByText("Producto 0");
  expect(screen.queryByText("Producto 16")).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Nombre o SKU..."), { target: { value: "SKU-16" } });
  await screen.findByText("Producto 16");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/incluidos registros históricos/)).toBeInTheDocument();
});
it("uses the validated store warehouses when requesting store history", async () => {
  setup("store"); await screen.findByText("Producto 0");
  expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ scope: "store", inventories: warehouses, companyId: "company-a", accessToken: "test-token" }));
});
it("shows error and retry without false empty history, then recovers", async () => {
  fetch.mockRejectedValueOnce(new Error("401 Unauthorized")).mockResolvedValueOnce(rows); setup();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("401 Unauthorized"));
  expect(screen.queryByText("No se encontraron movimientos.")).not.toBeInTheDocument();
  expect(screen.queryByText(/0 registros/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await screen.findByText("Producto 0");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
