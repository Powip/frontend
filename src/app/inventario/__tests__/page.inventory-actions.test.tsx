import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import {
  fetchBusinessInventoryItems,
  type BusinessInventoryItem,
} from "@/services/businessInventoryItemsService";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import AlmacenPage from "../page";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: jest.fn() }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: jest.fn() }));
jest.mock("@/services/businessInventoryItemsService", () => ({
  ...jest.requireActual("@/services/businessInventoryItemsService"),
  fetchBusinessInventoryItems: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { delete: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
jest.mock("exceljs", () => ({ Workbook: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("../../productos/shopify-sync-wizard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => null }));
jest.mock("@/components/inventory/InventoryUnitMovementModal", () => ({
  __esModule: true, default: ({ action, source, onSaved }: any) => <div role="dialog" aria-label={`Movimiento ${action}`}><span>{source.inventoryItemId}:{source.inventoryId}</span><button onClick={onSaved}>Guardar movimiento de prueba</button></div>,
}));
jest.mock("@/components/inventory/InventoryUnitTraceModal", () => ({
  __esModule: true, default: ({ companyId, initialCode }: {companyId: string; initialCode: string}) => <div role="dialog" aria-label="Historial del código">{companyId}:{initialCode || "global"}</div>,
}));
jest.mock("@/components/inventory/InventoryUnitsModal", () => ({
  __esModule: true, default: ({ onViewHistory }: {onViewHistory: (code: string) => void}) => <button onClick={() => onViewHistory("001234567890123")}>Historial de prueba</button>,
}));
jest.mock("@/components/inventory/ReconciliationTab", () => ({ ReconciliationTab: () => null }));
jest.mock("@/components/modals/AddStockModal", () => ({
  __esModule: true,
  default: ({ open, onSuccess }: { open: boolean; onSuccess: () => void }) =>
    open ? <button onClick={onSuccess}>Confirmar ajuste de prueba</button> : null,
}));
jest.mock("@/components/modals/ImportExcelModal", () => ({
  __esModule: true,
  default: ({ open, onSuccess }: { open: boolean; onSuccess: () => void }) =>
    open ? <button onClick={onSuccess}>Confirmar importación de prueba</button> : null,
}));
jest.mock("@/components/modals/EditProductImageModal", () => ({
  __esModule: true,
  default: ({ item, onSuccess, onClose }: {
    item: { productName: string };
    onSuccess: (imageUrl: string) => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label={`Cambiar imagen de ${item.productName}`}>
      <button onClick={() => {
        onSuccess("https://images.example.com/new.jpg");
        onClose();
      }}>Guardar imagen de prueba</button>
    </div>
  ),
}));

const fetchItems = jest.mocked(fetchBusinessInventoryItems);
const inventoryKey = ["business-inventory-items", "company-a", "user-a"];
const warehouses = [{ id: "warehouse-a", name: "Almacén A", storeId: "store-a" }];

function item(id: string, overrides: Partial<BusinessInventoryItem> = {}): BusinessInventoryItem {
  return {
    inventoryItemId: id,
    inventoryId: "warehouse-a",
    inventoryName: "Almacén A",
    storeId: "store-a",
    productId: `product-${id}`,
    variantId: `variant-${id}`,
    productName: `Producto ${id}`,
    sku: `SKU-${id}`,
    price: 10,
    priceVta: 10,
    availableStock: 2,
    physicalStock: 2,
    imageUrl: "https://images.example.com/old.jpg",
    ...overrides,
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  render(<QueryClientProvider client={client}><AlmacenPage /></QueryClientProvider>);
  return client;
}

async function confirmDeletion() {
  fireEvent.click(screen.getAllByTitle("Eliminar")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByLabelText("Escribe ELIMINAR para confirmar"), { target: { value: "ELIMINAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Eliminar Definitivamente" }));
}

describe("Warehouse product actions with business inventory queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchItems.mockReset();
    jest.mocked(useAuth).mockReturnValue({
      auth: { company: { id: "company-a", stores: [] }, user: { id: "user-a" }, accessToken: "test-token" },
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useBusinessScope).mockReturnValue({
      scope: "business", storeIds: ["store-a"], canFetch: true,
    } as ReturnType<typeof useBusinessScope>);
    jest.mocked(useBusinessInventories).mockReturnValue({
      inventories: warehouses, isPending: false, isSuccess: true, error: null, refetch: jest.fn(),
    } as unknown as ReturnType<typeof useBusinessInventories>);
    jest.mocked(axiosAuth.delete).mockResolvedValue({ data: { deleted: true } });
  });

  it("opens company-wide exact search independently of the warehouse and visible tracking mode", async () => {
    fetchItems.mockResolvedValue([item("normal", { trackingMode: "NONE" })]);
    setup(); await screen.findByText("Producto normal");
    fireEvent.click(screen.getByRole("button", { name: "Buscar IMEI/serie" }));
    expect(screen.getByRole("dialog", { name: "Historial del código" })).toHaveTextContent("company-a:global");
  });

  it("opens trace from a unit using its full leading-zero code", async () => {
    fetchItems.mockResolvedValue([item("serial", { trackingMode: "IMEI" })]);
    setup(); await screen.findByText("Producto serial");
    fireEvent.click(screen.getByRole("button", { name: "Ver unidades" }));
    fireEvent.click(screen.getByRole("button", { name: "Historial de prueba" }));
    expect(screen.getByRole("dialog", { name: "Historial del código" })).toHaveTextContent("company-a:001234567890123");
  });

  it("exposes unit lookup and disables aggregate adjustments and deletion for IMEI products", async () => {
    fetchItems.mockResolvedValue([item("serial", { trackingMode: "IMEI" })]);
    setup();
    await screen.findByText("Producto serial");
    expect(screen.getByRole("button", { name: "Ver unidades" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Transferir unidades" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Registrar merma" })).toBeEnabled();
    expect(screen.getByTitle("Registra los IMEI o series desde Compras")).toBeDisabled();
    expect(screen.getByTitle("Conserva las unidades identificadas y su historial")).toBeDisabled();
  });

  it("routes the actual source position to transfer and refreshes inventory after completion", async () => {
    fetchItems.mockResolvedValue([item("serial", { trackingMode: "IMEI", inventoryId: "warehouse-b", inventoryName: "Almacén B" })]);
    const client = setup();
    await screen.findByText("Producto serial");
    fireEvent.click(screen.getByRole("button", { name: "Transferir unidades" }));
    expect(screen.getByRole("dialog", { name: "Movimiento transfer" })).toHaveTextContent("serial:warehouse-b");
    fireEvent.click(screen.getByRole("button", { name: "Guardar movimiento de prueba" }));
    await waitFor(() => expect(fetchItems).toHaveBeenCalledTimes(2));
    expect(client.getQueryData([...inventoryKey, "business", ["store-a"], ["warehouse-a"]])).toBeDefined();
  });

  it("normal quantity products retain their original actions without unit movement buttons", async () => {
    fetchItems.mockResolvedValue([item("normal", { trackingMode: "NONE" })]);
    setup(); await screen.findByText("Producto normal");
    expect(screen.getByTitle("Ajustar Stock")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Transferir unidades" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar merma" })).not.toBeInTheDocument();
  });

  it("reports a failed refetch after deletion instead of falsely reporting a refreshed warehouse", async () => {
    fetchItems.mockResolvedValueOnce([item("a")]).mockRejectedValueOnce(new Error("Inventory unavailable"));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    setup();
    await screen.findByText("Producto a");
    await confirmDeletion();
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "Producto eliminado, pero no se pudo actualizar el almacén. Recarga la página.",
    ));
    expect(toast.success).not.toHaveBeenCalled();
    expect(axiosAuth.delete).toHaveBeenCalledWith(expect.stringContaining("/inventory-item/a"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    errorLog.mockRestore();
  });

  it("returns to the last valid page after removing its final row", async () => {
    const initial = Array.from({ length: 11 }, (_, index) => item(String(index + 1)));
    fetchItems.mockResolvedValueOnce(initial).mockResolvedValueOnce(initial.slice(0, 10));
    setup();
    await screen.findByText("Producto 1");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Producto 11")).toBeInTheDocument();
    await confirmDeletion();
    await waitFor(() => expect(screen.getByText("Producto 1")).toBeInTheDocument());
    expect(screen.getByText("Mostrando 1 - 10 de 10 productos")).toBeInTheDocument();
    expect(screen.queryByText("No hay productos en este alcance")).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Producto eliminado del almacén");
  });

  it("opens the image editor and keeps every variant and warehouse cache updated when refresh fails", async () => {
    const selected = item("a", { productId: "shared-product" });
    const sibling = item("b", { productId: "shared-product" });
    const other = item("c");
    fetchItems.mockResolvedValueOnce([selected, sibling, other]).mockRejectedValueOnce(new Error("Refresh unavailable"));
    const client = setup();
    await screen.findByText("Producto a");
    const storeCacheKey = [...inventoryKey, "store", ["store-b"], ["warehouse-b"]];
    client.setQueryData(storeCacheKey, [item("d", { productId: "shared-product", inventoryId: "warehouse-b" }), other]);
    const otherUserKey = ["business-inventory-items", "company-a", "other-user", "business"];
    client.setQueryData(otherUserKey, [selected]);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar imagen de Producto a" }));
    expect(screen.getByRole("dialog", { name: "Cambiar imagen de Producto a" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar imagen de prueba" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "Imagen guardada, pero no se pudo actualizar el almacén. Recarga la página.",
    ));
    expect(screen.getByAltText("Producto a")).toHaveAttribute("src", "https://images.example.com/new.jpg");
    expect(screen.getByAltText("Producto b")).toHaveAttribute("src", "https://images.example.com/new.jpg");
    expect(screen.getByAltText("Producto c")).toHaveAttribute("src", "https://images.example.com/old.jpg");
    expect(client.getQueryData<BusinessInventoryItem[]>(storeCacheKey)?.map((row) => row.imageUrl)).toEqual([
      "https://images.example.com/new.jpg", "https://images.example.com/old.jpg",
    ]);
    expect(client.getQueryData<BusinessInventoryItem[]>(otherUserKey)?.[0].imageUrl).toBe("https://images.example.com/old.jpg");
    expect(fetchItems.mock.calls[0][0]).toMatchObject({
      companyId: "company-a", accessToken: "test-token", signal: expect.any(AbortSignal),
    });
  });

  it("cancels an older fetch in another store cache before applying the saved image", async () => {
    const selected = item("a", { productId: "shared-product" });
    const storeRow = item("b", { productId: "shared-product", inventoryId: "warehouse-b" });
    fetchItems.mockResolvedValueOnce([selected]).mockRejectedValueOnce(new Error("Refresh unavailable"));
    const client = setup();
    await screen.findByText("Producto a");
    const storeCacheKey = [...inventoryKey, "store", ["store-b"], ["warehouse-b"]];
    client.setQueryData(storeCacheKey, [storeRow]);
    let resolveOlderFetch!: (rows: BusinessInventoryItem[]) => void;
    let olderSignal: AbortSignal | undefined;
    const olderFetch = client.fetchQuery({
      queryKey: storeCacheKey,
      queryFn: ({ signal }) => {
        olderSignal = signal;
        return new Promise<BusinessInventoryItem[]>((resolve) => { resolveOlderFetch = resolve; });
      },
    }).catch(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar imagen de Producto a" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar imagen de prueba" }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "Imagen guardada, pero no se pudo actualizar el almacén. Recarga la página.",
    ));
    await act(async () => {
      resolveOlderFetch([storeRow]);
      await olderFetch;
    });
    expect(olderSignal?.aborted).toBe(true);
    expect(client.getQueryData<BusinessInventoryItem[]>(storeCacheKey)?.[0].imageUrl).toBe("https://images.example.com/new.jpg");
    expect(screen.getByAltText("Producto a")).toHaveAttribute("src", "https://images.example.com/new.jpg");
  });

  it.each([
    ["Ajustar Stock", "Confirmar ajuste de prueba"],
    ["Importar Excel", "Confirmar importación de prueba"],
  ])("handles refresh failures from the non-awaited %s callback", async (openLabel, confirmLabel) => {
    fetchItems.mockResolvedValueOnce([item("a")]).mockRejectedValueOnce(new Error("Refresh unavailable"));
    setup();
    await screen.findByText("Producto a");
    fireEvent.click(openLabel === "Ajustar Stock" ? screen.getByTitle(openLabel) : screen.getByRole("button", { name: openLabel }));
    fireEvent.click(screen.getByRole("button", { name: confirmLabel }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      "Los cambios se guardaron, pero no se pudo actualizar el almacén. Recarga la página.",
    ));
  });
});
