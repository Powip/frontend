import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddProductsModal from "../AddProductsModal";
import axiosAuth from "@/lib/axiosAuth";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { toast } from "sonner";
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a" }, accessToken: "test-token" }, inventories: [{ id: "wrong-selected-warehouse" }] }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "wrong-selected-warehouse", name: "Otra", storeId: "selected" }, { id: "original", name: "Original", storeId: "owner" }], isPending: false, isSuccess: true, refetch: jest.fn() }) }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
const get = jest.mocked(axiosAuth.get);
const put = jest.mocked(axiosAuth.put);
const fetch = jest.mocked(fetchBusinessInventoryItems);
const order = { companyId: "company-a", inventoryId: "original", items: [] };
function setup() { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><AddProductsModal open orderId="order-a" onClose={jest.fn()} /></QueryClientProvider>); }
beforeEach(() => {
  jest.clearAllMocks(); get.mockResolvedValue({ data: order }); put.mockResolvedValue({ data: {} });
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "cart-item" });
  fetch.mockResolvedValue([{ inventoryItemId: "position-original", variantId: "variant-a", productId: "product-a", productName: "Producto Original", sku: "SKU", price: 10, availableStock: 3, physicalStock: 4, inventoryId: "original", inventoryName: "Original", storeId: "owner" }]);
});
it("loads only the order's warehouse and updates the existing sale without changing its origin", async () => {
  setup(); await screen.findByText("Producto Original");
  expect(screen.getByText(/Almacén de origen: Original/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ inventories: [{ id: "original", name: "Original", storeId: "owner" }], companyId: "company-a" }));
  const button = screen.getByText("Producto Original").closest("div.p-3")?.querySelector("button");
  if (!button) throw new Error("Missing product action"); fireEvent.click(button); fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  expect(get).toHaveBeenCalledTimes(2);
  expect(put).toHaveBeenCalledWith(expect.stringContaining("/order-header/order-a"), expect.objectContaining({ items: [expect.objectContaining({ productVariantId: "variant-a", quantity: 1 })] }));
  expect(put.mock.calls[0][1]).not.toHaveProperty("inventoryId");
});
it("blocks product search when the order has no recorded origin", async () => {
  get.mockResolvedValue({ data: { ...order, inventoryId: null } }); setup();
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no tiene almacén de origen"));
  expect(fetch).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
});
it("revalidates the recorded origin before mutation and refuses a changed destination", async () => {
  get.mockResolvedValueOnce({ data: order }).mockResolvedValueOnce({ data: { ...order, inventoryId: "wrong-selected-warehouse" } });
  setup(); await screen.findByText("Producto Original");
  const button = screen.getByText("Producto Original").closest("div.p-3")?.querySelector("button");
  if (!button) throw new Error("Missing product action"); fireEvent.click(button); fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("origen del pedido cambió")));
  expect(put).not.toHaveBeenCalled();
});
