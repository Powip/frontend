/**
 * Tests: Stock › «Quitar del almacén» (FEAT-24 RMV).
 *
 * 1. /inventario pide la búsqueda con `excludeRemoved` (lo quitado no se lista).
 * 2. Administrador u Operaciones con UN almacén en la vista: papelera por variante y por producto; la variante
 *    se quita tras la doble confirmación y la lista se refresca.
 * 3. Con IMEI/serie no hay papelera (se manejan por unidades).
 * 4. Con dos almacenes en la vista no hay papelera: aparece la pista para elegir el almacén.
 * 5. Almacén, Ventas y el resto no ven la papelera ni la pista.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { removeFromWarehouse } from "@/services/warehouseOpsService";
import InventarioView from "../_components/InventarioView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["store-1"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: jest.fn() }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/warehouseOpsService", () => ({ ...jest.requireActual("@/services/warehouseOpsService"), removeFromWarehouse: jest.fn() }));
jest.mock("@/services/userWarehousesService", () => ({ getMyWarehouses: jest.fn().mockResolvedValue({ all: true, inventoryIds: [], operableIds: [] }) }));
jest.mock("@/hooks/useInventoryAlerts", () => ({ useInventoryAlerts: () => ({ data: { generatedAt: "", total: 0, alerts: [] } }) }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn().mockResolvedValue({ warehouses: [], links: [] }) }));
jest.mock("@/hooks/useStockCoverage", () => ({ useStockCoverage: () => ({ byVariant: undefined, targetDays: 30, windowDays: 30 }) }));
jest.mock("@/services/packsService", () => ({ listAllPacks: jest.fn().mockResolvedValue([]) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), usePathname: () => "/inventario/stock" }));
jest.mock("next/image", () => ({ __esModule: true, default: () => <span /> }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("exceljs", () => ({ Workbook: jest.fn() }));

const fetchItems = jest.mocked(fetchBusinessInventoryItems);
const remove = jest.mocked(removeFromWarehouse);
const lima = { id: "inv-1", name: "Almacén Lima", storeId: "store-1", storeName: "Principal" };
const cusco = { id: "inv-2", name: "Almacén Cusco", storeId: "store-1", storeName: "Principal" };

const item = (id: string, overrides: Partial<BusinessInventoryItem> = {}): BusinessInventoryItem => ({
  inventoryItemId: `ii-${id}`,
  productId: "p-polo",
  variantId: `v-${id}`,
  productName: "Polo",
  sku: `POLO-${id}`,
  price: 10,
  priceVta: 10,
  availableStock: 0,
  physicalStock: 0,
  reservedStock: 0,
  attributes: { Talla: id },
  inventoryId: "inv-1",
  inventoryName: "Almacén Lima",
  storeId: "store-1",
  storeName: "Principal",
  ...overrides,
});

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "user-1", role }, company: { id: "company-1", stores: [{ id: "store-1", name: "Principal" }] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function warehousesInView(list: Array<typeof lima>) {
  jest.mocked(useBusinessInventories).mockReturnValue({ inventories: list, isSuccess: true, isPending: false, error: null, refetch: jest.fn() } as unknown as ReturnType<typeof useBusinessInventories>);
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InventarioView tab="stock" /></QueryClientProvider>);
}

describe("Stock › Quitar del almacén (FEAT-24 RMV)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loginAs("ADMINISTRADOR");
    warehousesInView([lima]);
    fetchItems.mockResolvedValue([item("S"), item("M")]);
  });

  it("pide la búsqueda sin lo quitado del almacén", async () => {
    renderView();
    await screen.findByText("Talla: S");
    expect(fetchItems).toHaveBeenLastCalledWith(expect.objectContaining({ excludeRemoved: true }));
  });

  it.each(["ADMINISTRADOR", "OPERACIONES"])("%s con un almacén ve la papelera por variante y por producto, y quita una variante con doble confirmación", async (role) => {
    loginAs(role);
    remove.mockResolvedValue({ inventoryId: "inv-1", removed: [{ variantId: "v-S", inventoryItemId: "ii-S" }], alreadyRemoved: [], notInWarehouse: [] });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("Talla: S");
    expect(screen.getAllByTitle("Quitar del almacén")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Quitar el producto Polo del almacén" })).toBeInTheDocument();
    expect(screen.queryByTestId("hint-quitar-del-almacen")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitar Polo · Talla: S del almacén" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Vas a quitar la variante Polo · Talla: S (SKU POLO-S) del almacén Almacén Lima (Principal).");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(remove).not.toHaveBeenCalled();
    fetchItems.mockResolvedValue([item("M")]);
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("inv-1", { variantId: "v-S" }));
    expect(toast.success).toHaveBeenCalledWith("Se quitó Polo · Talla: S de Almacén Lima.");
    await waitFor(() => expect(screen.queryByText("Talla: S")).not.toBeInTheDocument());
    expect(fetchItems).toHaveBeenCalledTimes(2);
  });

  it("el producto entero se quita con su productId", async () => {
    remove.mockResolvedValue({ inventoryId: "inv-1", removed: [{ variantId: "v-S", inventoryItemId: "ii-S" }, { variantId: "v-M", inventoryItemId: "ii-M" }], alreadyRemoved: [], notInWarehouse: [] });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("Talla: S");
    await user.click(screen.getByRole("button", { name: "Quitar el producto Polo del almacén" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Sí, quitar" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("inv-1", { productId: "p-polo" }));
  });

  it("un producto con IMEI o serie no tiene papelera", async () => {
    fetchItems.mockResolvedValue([item("S", { trackingMode: "IMEI" })]);
    renderView();
    await screen.findByText("Talla: S");
    expect(screen.queryByTitle("Quitar del almacén")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Quitar el producto del almacén")).not.toBeInTheDocument();
  });

  it("con dos almacenes en la vista no hay papelera y aparece la pista para elegir uno", async () => {
    warehousesInView([lima, cusco]);
    fetchItems.mockResolvedValue([item("S"), item("S2", { variantId: "v-S2", inventoryId: "inv-2", inventoryName: "Almacén Cusco" })]);
    renderView();
    await screen.findByText("Talla: S");
    expect(screen.queryByTitle("Quitar del almacén")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Quitar el producto del almacén")).not.toBeInTheDocument();
    expect(screen.getByTestId("hint-quitar-del-almacen")).toHaveTextContent("elige ese almacén en el filtro «Almacén»");
  });

  it("la vista «Por almacén» no tiene papelera", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText("Talla: S");
    await user.click(screen.getByRole("button", { name: "Por almacén" }));
    expect(screen.queryByTitle("Quitar del almacén")).not.toBeInTheDocument();
  });

  it.each(["ALMACEN", "VENTAS", "CALLER", "COURIER"])("%s no ve la papelera ni la pista", async (role) => {
    loginAs(role);
    warehousesInView([lima, cusco]);
    renderView();
    await screen.findByText("Talla: S");
    expect(screen.queryByTitle("Quitar del almacén")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Quitar el producto del almacén")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hint-quitar-del-almacen")).not.toBeInTheDocument();
  });
});
