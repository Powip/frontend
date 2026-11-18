/**
 * Tests: Contar en el modo almacén (FEAT-24 H5).
 *
 * 1. Lista las tomas en curso de los almacenes que el usuario opera.
 * 2. Cada escaneo suma 1: va por la cola con el código tal cual y una clave propia como operationId; la
 *    pantalla muestra solo lo contado (nunca el stock del sistema).
 * 3. Un código que el servidor no resuelve se avisa y no suma.
 * 4. Sin señal: el escaneo queda guardado, se ve como «sin enviar», no deja terminar y se envía al volver.
 * 5. Terminar envía a validación.
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { WarehouseQueueProvider } from "@/components/almacen/WarehouseQueueContext";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { addCountEntries, closeCount, getCount, listCounts, type StockCount } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";
import MobileCountScreen from "../_components/MobileCountScreen";

const mockAuth = { user: { id: "u-1", role: "ALMACEN", permissions: [] as string[], companyId: "c-1" }, company: { id: "c-1" } };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, hasPermission: () => false }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/lib/barcodeScanner", () => ({ ...jest.requireActual("@/lib/barcodeScanner"), scanFeedback: jest.fn() }));
jest.mock("@/lib/errorBeep", () => ({ playErrorBeep: jest.fn(), playSuccessBeep: jest.fn() }));
jest.mock("@/services/warehouseOpsService", () => ({
  listCounts: jest.fn(),
  getCount: jest.fn(),
  addCountEntries: jest.fn(),
  closeCount: jest.fn(),
  receiveTransfer: jest.fn(),
}));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn(), lookupVariantsByCodes: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn(), listReturnReceptions: jest.fn(), receiveReturnReception: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({}));
jest.mock("@/services/orderStockService", () => ({}));
jest.mock("@/services/inventoryItems.service", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");
const { scanFeedback } = jest.requireMock("@/lib/barcodeScanner") as { scanFeedback: jest.Mock };

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

const count = (overrides: Partial<StockCount> = {}): StockCount =>
  ({
    id: "ct-1",
    number: "TI-0004",
    inventoryId: "w-sur",
    scope: "total",
    scopeFilter: null,
    blind: true,
    status: "en_curso",
    notes: null,
    userEmail: "ana@empresa.pe",
    userName: "ana@empresa.pe",
    closedAt: null,
    appliedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-11-17T14:00:00Z",
    updatedAt: "2026-11-17T14:00:00Z",
    summary: { lines: 2, counted: 0 },
    ...overrides,
  }) as StockCount;

// Conteo ciego en curso: la API no manda esperado ni diferencias.
const detail = count({
  lines: [
    { id: "l-1", variantId: "v-1", sku: "POLO", productName: "Polo", counted: null, decision: null },
    { id: "l-2", variantId: "v-2", sku: "GORRA", productName: "Gorra", counted: 3, decision: null },
  ],
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WarehouseQueueProvider>
        <MobileCountScreen />
      </WarehouseQueueProvider>
    </QueryClientProvider>,
  );
}

async function openCount(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Contar TI-0004" }));
  return screen.findByTestId("mobile-count-line-l-1");
}

beforeEach(() => {
  jest.clearAllMocks();
  setOnline(true);
  mockAuth.user.role = "ALMACEN";
  __setMyWarehouses({ all: false, inventoryIds: ["w-sur", "w-lima"], operableIds: ["w-sur"] });
  jest.mocked(listCounts).mockResolvedValue([count(), count({ id: "ct-2", number: "TI-0005", inventoryId: "w-lima" })]);
  jest.mocked(getCount).mockResolvedValue(detail);
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [
      { id: "w-sur", name: "Almacén Sur", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
      { id: "w-lima", name: "Lima", status: true, store_id: "s", company_id: "c-1", type: "PROPIO", is_main: false },
    ],
    links: [],
  });
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-1", sku: "POLO", companySku: null, barcode: "7750001", powipEan: null, attributeValues: {}, productName: "Polo" },
    { id: "v-2", sku: "GORRA", companySku: null, barcode: "7750002", powipEan: null, attributeValues: {}, productName: "Gorra" },
  ]);
});

afterEach(() => setOnline(true));

describe("Contar (modo almacén)", () => {
  it("lista solo las tomas en curso de los almacenes que opera", async () => {
    setup();
    const item = await screen.findByRole("button", { name: "Contar TI-0004" });
    expect(item).toHaveTextContent("Almacén Sur");
    expect(screen.queryByRole("button", { name: "Contar TI-0005" })).not.toBeInTheDocument();
    expect(listCounts).toHaveBeenCalledWith({ status: "en_curso" });
  });

  it("cada escaneo suma 1 con el código tal cual y su propia clave; solo se ve lo contado", async () => {
    const user = userEvent.setup();
    jest.mocked(addCountEntries).mockResolvedValue({
      countId: "ct-1",
      status: "en_curso",
      applied: [{ lineId: "l-1", variantId: "v-1", counted: 1 }],
      unresolved: [],
      duplicate: false,
    });
    setup();
    const polo = await openCount(user);
    expect(screen.queryByText(/Esperado|Diferencia|sistema/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Escanea cada unidad del estante"), "7750001{Enter}");
    await waitFor(() => expect(addCountEntries).toHaveBeenCalledTimes(1));
    const [countId, body, timeoutMs] = jest.mocked(addCountEntries).mock.calls[0];
    expect(countId).toBe("ct-1");
    expect(body).toEqual({ mode: "add", entries: [{ code: "7750001", quantity: 1 }], operationId: expect.any(String) });
    expect(timeoutMs).toBe(15_000);
    await waitFor(() => expect(within(polo).getByText("1")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("+1: Polo (contado 1)");
    expect(scanFeedback).toHaveBeenCalledWith("ok");

    await user.type(screen.getByLabelText("Escanea cada unidad del estante"), "7750001{Enter}");
    await waitFor(() => expect(addCountEntries).toHaveBeenCalledTimes(2));
    expect(jest.mocked(addCountEntries).mock.calls[1][1].operationId).not.toBe(body.operationId);
  });

  it("un código que el servidor no resuelve se avisa y no suma", async () => {
    const user = userEvent.setup();
    jest.mocked(addCountEntries).mockResolvedValue({
      countId: "ct-1",
      status: "en_curso",
      applied: [],
      unresolved: [{ code: "999", variantId: null, quantity: 1, reason: "fuera_del_conteo" }],
      duplicate: false,
    });
    setup();
    await openCount(user);
    await user.type(screen.getByLabelText("Escanea cada unidad del estante"), "999{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("El código 999 no es parte de este conteo (TI-0004).");
    expect(scanFeedback).toHaveBeenCalledWith("error");
  });

  it("sin señal: guarda el escaneo, lo muestra sin enviar, no deja terminar y lo envía al volver", async () => {
    const user = userEvent.setup();
    jest.mocked(addCountEntries).mockResolvedValue({
      countId: "ct-1",
      status: "en_curso",
      applied: [{ lineId: "l-1", variantId: "v-1", counted: 1 }],
      unresolved: [],
      duplicate: false,
    });
    setup();
    const polo = await openCount(user);
    await waitFor(() => expect(fetchVariantsByIds).toHaveBeenCalled());
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await user.type(screen.getByLabelText("Escanea cada unidad del estante"), "7750001{Enter}");
    await waitFor(() => expect(within(polo).getByText("1 sin enviar")).toBeInTheDocument());
    expect(screen.getByText("1 escaneo guardado en el celular: se envían al volver la señal.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminar y enviar a validación" })).toBeDisabled();
    expect(addCountEntries).not.toHaveBeenCalled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(addCountEntries).toHaveBeenCalledTimes(1));
    expect(jest.mocked(addCountEntries).mock.calls[0][1].entries).toEqual([{ code: "7750001", quantity: 1 }]);
  });

  it("terminar envía el conteo a validación", async () => {
    const user = userEvent.setup();
    jest.mocked(closeCount).mockResolvedValue(count({ status: "por_validar" }));
    setup();
    await openCount(user);
    await user.click(screen.getByRole("button", { name: "Terminar y enviar a validación" }));
    await waitFor(() => expect(closeCount).toHaveBeenCalledWith("ct-1"));
    expect(toast.success).toHaveBeenCalledWith("TI-0004 enviado a validación");
  });

  it("quien no cuenta inventario no entra", async () => {
    mockAuth.user.role = "VENTAS";
    setup();
    expect(await screen.findByText("No puedes contar inventario")).toBeInTheDocument();
    expect(listCounts).not.toHaveBeenCalled();
  });
});
