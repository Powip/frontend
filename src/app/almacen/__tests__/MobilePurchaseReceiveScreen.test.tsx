/**
 * Tests: Recibir › Órdenes de compra en el modo almacén (FEAT-24 H3-E).
 *
 * 1. Lista las OC pedidas y recibidas en parte; el diálogo empieza en 0 y cada escaneo suma 1.
 * 2. Con señal, la recepción va por la cola: se envía con su operationId.
 * 3. Sin señal, el código se lee con los productos descargados, la recepción queda guardada (la OC se marca)
 *    y se envía sola al volver la conexión.
 * 4. Quien no recibe mercadería no entra.
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { WarehouseQueueProvider } from "@/components/almacen/WarehouseQueueContext";
import { getPurchaseOrder, listPurchaseOrders, receivePurchaseOrder, type PurchaseOrder } from "@/services/purchasesService";
import { fetchVariantsByIds, lookupVariantsByCodes } from "@/services/variantCodesService";
import { listWarehouses } from "@/services/warehousesService";
import MobilePurchaseReceiveScreen from "../_components/MobilePurchaseReceiveScreen";

const mockAuth = { user: { id: "u-1", role: "ALMACEN", permissions: [] as string[], companyId: "c-1" }, company: { id: "c-1" } };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, hasPermission: () => false }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/barcodeScanner", () => ({
  ...jest.requireActual("@/lib/barcodeScanner"),
  scanFeedback: jest.fn(),
}));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn(), playSuccessBeep: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({
  listPurchaseOrders: jest.fn(),
  getPurchaseOrder: jest.fn(),
  receivePurchaseOrder: jest.fn(),
}));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn(), lookupVariantsByCodes: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({
  listWarehouses: jest.fn(),
  listReturnReceptions: jest.fn(),
  receiveReturnReception: jest.fn(),
}));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

const order = {
  id: "oc-1",
  number: "OC-0001",
  status: "RECIBIDA_PARCIAL",
  supplierName: "Textiles",
  inventoryId: "w-1",
  document: "F001-1",
  purchaseDate: "2026-11-17",
  createdAt: "2026-11-17T15:00:00Z",
  lines: [
    {
      id: "item-1",
      variantId: "v-1",
      sku: "POLO-M",
      productName: "Polo",
      attributes: { Talla: "M" },
      purchaseUnit: null,
      purchaseFactor: 1,
      purchaseQuantity: 10,
      quantity: 10,
      receivedQuantity: 8,
      returnedQuantity: 0,
      pendingQuantity: 2,
    },
  ],
} as unknown as PurchaseOrder;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WarehouseQueueProvider>
        <MobilePurchaseReceiveScreen />
      </WarehouseQueueProvider>
    </QueryClientProvider>,
  );
}

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

beforeEach(() => {
  jest.clearAllMocks();
  setOnline(true);
  mockAuth.user.role = "ALMACEN";
  jest.mocked(listPurchaseOrders).mockImplementation(async (filters) => ({
    items: filters?.status === "RECIBIDA_PARCIAL" ? [order] : [],
    total: 1,
    page: 1,
    limit: 100,
  }));
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [{ id: "w-1", name: "Almacén central", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: true }],
    links: [],
  });
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-1", sku: "POLO-M", companySku: null, barcode: "7750001", powipEan: null, attributeValues: { Talla: "M" }, productName: "Polo" },
  ]);
  jest.mocked(getPurchaseOrder).mockResolvedValue({ ...order, receptions: [] });
});

afterEach(() => setOnline(true));

describe("Recibir órdenes de compra (modo almacén)", () => {
  it("con señal: escanea, suma 1 desde 0 y envía la recepción por la cola con su operationId", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([
      { code: "7750001", variantId: "v-1", sku: "POLO-M", companySku: null, productId: "p-1", productName: "Polo" },
    ]);
    jest.mocked(receivePurchaseOrder).mockResolvedValue({ duplicate: false, reception: {} as never, purchaseOrder: { ...order, status: "RECIBIDA" } });
    setup();
    const item = await screen.findByRole("button", { name: "Recibir compra OC-0001" });
    expect(item).toHaveTextContent("Almacén central");
    expect(item).toHaveTextContent("2 pendientes");
    await user.click(item);
    const quantity = await screen.findByLabelText("Recibe ahora: Polo · Talla: M");
    expect(quantity).toHaveValue(0);
    await user.type(screen.getByLabelText("Escanear (suma 1 a lo recibido)"), "7750001{Enter}");
    await waitFor(() => expect(quantity).toHaveValue(1));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (1)" }));
    await waitFor(() => expect(receivePurchaseOrder).toHaveBeenCalledTimes(1));
    const [orderId, body, options] = jest.mocked(receivePurchaseOrder).mock.calls[0];
    expect(orderId).toBe("oc-1");
    expect(body.lines).toEqual([{ itemId: "item-1", quantity: 1 }]);
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
    // FEAT-24 H5: el header es el mismo operationId del cuerpo (la fachada da 400 si difieren).
    expect(options).toMatchObject({ idempotencyKey: body.operationId, timeoutMs: 15_000 });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("OC-0001 · Recibida", expect.anything()));
  });

  it("sin señal: lee el código con lo descargado, guarda la recepción y la envía al volver la conexión", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockRejectedValue(networkError());
    jest.mocked(receivePurchaseOrder).mockResolvedValue({ duplicate: false, reception: {} as never, purchaseOrder: order });
    setup();
    await user.click(await screen.findByRole("button", { name: "Recibir compra OC-0001" }));
    await waitFor(() => expect(fetchVariantsByIds).toHaveBeenCalled());
    setOnline(false);
    const quantity = await screen.findByLabelText("Recibe ahora: Polo · Talla: M");
    const scan = screen.getByLabelText("Escanear (suma 1 a lo recibido)");
    await user.type(scan, "7750001{Enter}");
    await user.type(scan, "7750001{Enter}");
    await waitFor(() => expect(quantity).toHaveValue(2));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción (2)" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/^Sin señal: la recepción quedó/)));
    expect(receivePurchaseOrder).not.toHaveBeenCalled();
    const item = await screen.findByRole("button", { name: "Recibir compra OC-0001" });
    expect(within(item).getByText("Recepción guardada: se envía al volver la señal.")).toBeInTheDocument();
    expect(item).toBeDisabled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(receivePurchaseOrder).toHaveBeenCalledTimes(1));
    expect(getPurchaseOrder).toHaveBeenCalledWith("oc-1");
    expect(jest.mocked(receivePurchaseOrder).mock.calls[0][1].lines).toEqual([{ itemId: "item-1", quantity: 2 }]);
  });

  it("quien no recibe mercadería no entra", async () => {
    mockAuth.user.role = "VENTAS";
    setup();
    expect(await screen.findByText("No puedes recibir compras")).toBeInTheDocument();
    expect(listPurchaseOrders).not.toHaveBeenCalled();
  });
});
