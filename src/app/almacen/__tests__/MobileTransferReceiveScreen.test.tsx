/**
 * Tests: Recibir › Traslados en el modo almacén (FEAT-24 H5).
 *
 * 1. Lista solo los traslados en camino hacia un almacén que el usuario opera.
 * 2. Con señal: el diálogo empieza en 0, cada escaneo suma 1 y la recepción va por la cola con su
 *    operationId (el servicio lo manda también como Idempotency-Key).
 * 3. Sin señal: queda guardada (el traslado se marca) y se envía al volver la conexión con el MISMO operationId.
 * 4. Recepción parcial: se reciben solo las líneas marcadas; lo que llega de menos lleva su decisión.
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { WarehouseQueueProvider } from "@/components/almacen/WarehouseQueueContext";
import { fetchVariantsByIds, lookupVariantsByCodes } from "@/services/variantCodesService";
import { listTransfers, receiveTransfer, type Transfer } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";
import MobileTransferReceiveScreen from "../_components/MobileTransferReceiveScreen";

const mockAuth = { user: { id: "u-1", role: "ALMACEN", permissions: [] as string[], companyId: "c-1" }, company: { id: "c-1" } };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, hasPermission: () => false }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/barcodeScanner", () => ({ ...jest.requireActual("@/lib/barcodeScanner"), scanFeedback: jest.fn() }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn(), playSuccessBeep: jest.fn() }));
jest.mock("@/services/warehouseOpsService", () => ({ listTransfers: jest.fn(), receiveTransfer: jest.fn(), addCountEntries: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn(), lookupVariantsByCodes: jest.fn() }));
const invalidate = jest.spyOn(QueryClient.prototype, "invalidateQueries");
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn(), listReturnReceptions: jest.fn(), receiveReturnReception: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({}));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

const line = (id: string, variantId: string, productName: string, quantitySent: number) => ({
  id,
  variantId,
  sku: productName.toUpperCase(),
  productName,
  quantitySent,
  quantityReceived: null,
  difference: null,
  differenceDecision: null,
  receivedAt: null,
});

const transfer = (overrides: Partial<Transfer>): Transfer =>
  ({
    id: "t-1",
    number: "TR-0001",
    originInventoryId: "w-central",
    destinationInventoryId: "w-sur",
    status: "en_camino",
    freight: null,
    remissionGuide: "T001-15",
    notes: null,
    userEmail: "ana@empresa.pe",
    userName: "ana@empresa.pe",
    dispatchedAt: "2026-11-17T15:00:00Z",
    receivedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-11-17T14:00:00Z",
    updatedAt: "2026-11-17T15:00:00Z",
    totalSent: 3,
    totalReceived: 0,
    lines: [line("i-1", "v-1", "Polo", 2), line("i-2", "v-2", "Gorra", 1)],
    ...overrides,
  }) as Transfer;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WarehouseQueueProvider>
        <MobileTransferReceiveScreen />
      </WarehouseQueueProvider>
    </QueryClientProvider>,
  );
}

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });

beforeEach(() => {
  jest.clearAllMocks();
  setOnline(true);
  mockAuth.user.role = "ALMACEN";
  __setMyWarehouses({ all: false, inventoryIds: ["w-central", "w-sur", "w-lima"], operableIds: ["w-sur"] });
  jest.mocked(listTransfers).mockResolvedValue([
    transfer({}),
    transfer({ id: "t-2", number: "TR-0002", destinationInventoryId: "w-lima" }),
  ]);
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [
      { id: "w-central", name: "Central", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: true },
      { id: "w-sur", name: "Almacén Sur", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
      { id: "w-lima", name: "Lima", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
    ],
    links: [],
  });
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-1", sku: "POLO", companySku: null, barcode: "7750001", powipEan: null, attributeValues: {}, productName: "Polo" },
    { id: "v-2", sku: "GORRA", companySku: null, barcode: "7750002", powipEan: null, attributeValues: {}, productName: "Gorra" },
  ]);
  jest.mocked(receiveTransfer).mockResolvedValue({ duplicate: false, transfer: transfer({ status: "recibido" }) });
});

afterEach(() => setOnline(true));

describe("Recibir traslados (modo almacén)", () => {
  it("lista solo los traslados hacia almacenes que el usuario opera", async () => {
    setup();
    const item = await screen.findByRole("button", { name: "Recibir traslado TR-0001" });
    expect(item).toHaveTextContent("Central → Almacén Sur");
    expect(item).toHaveTextContent("3 unidades");
    expect(screen.queryByRole("button", { name: "Recibir traslado TR-0002" })).not.toBeInTheDocument();
    expect(listTransfers).toHaveBeenCalledWith({ status: "en_camino" });
  });

  it("con señal: escanea desde 0, recibe solo lo marcado y envía por la cola con su operationId", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockResolvedValue([{ code: "7750001", variantId: "v-1", sku: "POLO", companySku: null, productId: "p-1", productName: "Polo" }]);
    setup();
    await user.click(await screen.findByRole("button", { name: "Recibir traslado TR-0001" }));
    const polo = await screen.findByLabelText("Recibido: Polo");
    expect(polo).toHaveValue("0");
    const scan = screen.getByLabelText("Escanear (suma 1 a lo recibido)");
    await user.type(scan, "7750001{Enter}");
    await waitFor(() => expect(polo).toHaveValue("1"));
    // Llegó 1 de 2: la diferencia se marca como pérdida; la gorra se recibe después.
    await user.selectOptions(within(screen.getByTestId("tr-receive-i-1")).getByLabelText("Qué hacer con la diferencia"), "perdida");
    await user.click(screen.getByRole("checkbox", { name: "Recibir ahora: Gorra" }));
    await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(receiveTransfer).toHaveBeenCalledTimes(1));
    const [transferId, body, timeoutMs] = jest.mocked(receiveTransfer).mock.calls[0];
    expect(transferId).toBe("t-1");
    expect(body.lines).toEqual([{ itemId: "i-1", quantityReceived: 1, decision: "perdida" }]);
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(timeoutMs).toBe(15_000);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    // FEAT-24 H10: lo recibido refresca el badge de Alertas.
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inventory-alerts"] }));
  });

  it("sin señal: guarda la recepción y la envía al volver con el mismo operationId", async () => {
    const user = userEvent.setup();
    jest.mocked(lookupVariantsByCodes).mockRejectedValue(networkError());
    setup();
    await user.click(await screen.findByRole("button", { name: "Recibir traslado TR-0001" }));
    await waitFor(() => expect(fetchVariantsByIds).toHaveBeenCalled());
    setOnline(false);
    const scan = screen.getByLabelText("Escanear (suma 1 a lo recibido)");
    for (const code of ["7750001", "7750001", "7750002"]) await user.type(scan, `${code}{Enter}`);
    await waitFor(() => expect(screen.getByLabelText("Recibido: Gorra")).toHaveValue("1"));
    expect(screen.getByLabelText("Recibido: Polo")).toHaveValue("2");
    await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/^Sin señal: la recepción quedó/)));
    expect(receiveTransfer).not.toHaveBeenCalled();
    const item = await screen.findByRole("button", { name: "Recibir traslado TR-0001" });
    expect(within(item).getByText("Recepción guardada: se envía al volver la señal.")).toBeInTheDocument();
    expect(item).toBeDisabled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(receiveTransfer).toHaveBeenCalledTimes(1));
    const [, body] = jest.mocked(receiveTransfer).mock.calls[0];
    expect(body.lines).toEqual([
      { itemId: "i-1", quantityReceived: 2 },
      { itemId: "i-2", quantityReceived: 1 },
    ]);
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("quien no recibe mercadería no entra", async () => {
    mockAuth.user.role = "VENTAS";
    setup();
    expect(await screen.findByText("No puedes recibir traslados")).toBeInTheDocument();
    expect(listTransfers).not.toHaveBeenCalled();
  });
});
