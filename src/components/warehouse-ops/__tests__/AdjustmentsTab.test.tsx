/**
 * Tests: Inventario › Ajustes y mermas (FEAT-24 H5).
 *
 * 1. Aprobar y rechazar: solo el Administrador; Operaciones ve la bandeja sin esos botones.
 * 2. Aprobar reintenta con la MISMA Idempotency-Key; rechazar lleva motivo.
 * 3. Anular: un pendiente, Administrador u Operaciones; uno aplicado, solo el Administrador.
 * 4. Sin rol de costos los montos salen como «••••».
 * 5. Pedir una merma: solo almacenes operables, cuerpo con kind/reason/direction y operationId estable.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { listProductVariants, listPurchasableProducts } from "@/services/purchasesService";
import { approveAdjustment, cancelAdjustment, createAdjustment, listAdjustments, rejectAdjustment } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";
import AdjustmentsTab from "../adjustments/AdjustmentsTab";
import { adjustment, WAREHOUSES } from "./fixtures";

const mockUser = { id: "u-1", role: "ADMINISTRADOR", email: "admin@empresa.pe", permissions: [] as string[] };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: mockUser } }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/warehouseOpsService", () => ({
  listAdjustments: jest.fn(),
  createAdjustment: jest.fn(),
  approveAdjustment: jest.fn(),
  rejectAdjustment: jest.fn(),
  cancelAdjustment: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn(), listProductVariants: jest.fn(), getVariantCosts: jest.fn().mockResolvedValue([]) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const networkError = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });
const pending = adjustment();
const applied = adjustment({ id: "a-2", number: "AJ-0002", kind: "ajuste", status: "aplicado", reason: "error_registro", note: null });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdjustmentsTab companyId="c-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.role = "ADMINISTRADOR";
  __setMyWarehouses(null);
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
  jest.mocked(listAdjustments).mockImplementation(async (filters) => (filters?.status === "pendiente_aprobacion" ? [pending] : [pending, applied]));
});

describe("Ajustes y mermas", () => {
  it("el Administrador aprueba desde la bandeja y el reintento usa la misma clave", async () => {
    const user = userEvent.setup();
    jest.mocked(approveAdjustment).mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ duplicate: false, adjustment: { ...pending, status: "aplicado" } });
    setup();
    const tray = await screen.findByTestId("pending-AJ-0001");
    expect(within(tray).getByText("S/ 120.00")).toBeInTheDocument();
    await user.click(within(tray).getByRole("button", { name: "Aprobar" }));
    expect(await within(tray).findByRole("alert")).toHaveTextContent("No hubo respuesta del servidor. Reintenta: la acción no se duplica.");
    await user.click(within(tray).getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(approveAdjustment).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(approveAdjustment).mock.calls;
    expect(first[0]).toBe("a-1");
    expect(second[1].operationId).toBe(first[1].operationId);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("AJ-0001 aprobado y aplicado"));
  });

  it("rechazar lleva el motivo", async () => {
    const user = userEvent.setup();
    jest.mocked(rejectAdjustment).mockResolvedValue({ duplicate: false, adjustment: { ...pending, status: "rechazado" } });
    setup();
    await user.click(within(await screen.findByTestId("pending-AJ-0001")).getByRole("button", { name: "Rechazar" }));
    await user.type(await screen.findByLabelText(/Motivo/), "No hay foto");
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(rejectAdjustment).toHaveBeenCalledWith("a-1", { reason: "No hay foto", operationId: expect.any(String) }));
  });

  it("Operaciones no aprueba ni rechaza; anula el pendiente pero no el aplicado", async () => {
    mockUser.role = "OPERACIONES";
    setup();
    const tray = await screen.findByTestId("pending-AJ-0001");
    expect(within(tray).queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(within(tray).queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.getByText("Los aprueba o rechaza el Administrador.")).toBeInTheDocument();
    expect(within(await screen.findByTestId("adjustment-AJ-0001")).getByRole("button", { name: "Anular" })).toBeInTheDocument();
    expect(within(screen.getByTestId("adjustment-AJ-0002")).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("el Administrador anula uno aplicado (movimientos inversos)", async () => {
    const user = userEvent.setup();
    jest.mocked(cancelAdjustment).mockResolvedValue({ duplicate: false, adjustment: { ...applied, status: "anulado" } });
    setup();
    await user.click(within(await screen.findByTestId("adjustment-AJ-0002")).getByRole("button", { name: "Anular" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/movimientos inversos/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Anular" }));
    await waitFor(() => expect(cancelAdjustment).toHaveBeenCalledWith("a-2", { operationId: expect.any(String) }));
  });

  it("sin rol de costos los montos salen ocultos y no hay botones de aprobación", async () => {
    mockUser.role = "ALMACEN";
    const { totalValue: _omit, ...withoutValue } = pending;
    const line = { ...pending.lines[0] } as Record<string, unknown>;
    delete line.unitCost;
    delete line.lineValue;
    jest.mocked(listAdjustments).mockResolvedValue([{ ...withoutValue, lines: [line] } as never]);
    setup();
    const tray = await screen.findByTestId("pending-AJ-0001");
    expect(within(tray).getByLabelText("Costo oculto")).toBeInTheDocument();
    expect(within(tray).queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("adjustment-AJ-0001")).getByLabelText("Costo oculto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("pedir una merma: solo almacenes operables y el cuerpo con su operationId (igual al reintentar)", async () => {
    const user = userEvent.setup();
    mockUser.role = "ALMACEN";
    __setMyWarehouses({ all: false, inventoryIds: ["w-1", "w-2"], operableIds: ["w-2"] });
    jest.mocked(listPurchasableProducts).mockResolvedValue([{ id: "p-1", name: "Polo", sku: "POLO", companySku: null, status: true, purchaseUnit: null, purchaseFactor: 1 }]);
    jest.mocked(listProductVariants).mockResolvedValue([{ id: "v-1", sku: "POLO-M", companySku: null, attributeValues: { Talla: "M" }, isActive: true, mergedInto: null }]);
    jest.mocked(createAdjustment)
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ duplicate: false, adjustment: adjustment({ number: "AJ-0003" }) });
    setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo ajuste o merma" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(within(dialog).getByLabelText("Almacén")).getAllByRole("option")).toHaveLength(2));
    expect(within(within(dialog).getByLabelText("Almacén")).getByRole("option", { name: "Tienda Sur" })).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Almacén"), "w-2");
    await user.selectOptions(within(dialog).getByLabelText("Motivo"), "dano");
    await screen.findByRole("option", { name: /Polo/ });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Producto" }), "p-1");
    await user.click(within(dialog).getByRole("button", { name: "Agregar con sus variantes" }));
    const quantity = await within(dialog).findByLabelText("Cantidad: Polo · Talla: M");
    await user.clear(quantity);
    await user.type(quantity, "2");
    expect(within(dialog).getByText("••••")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));
    expect(await within(dialog).findByText("No hubo respuesta del servidor. Reintenta: la acción no se duplica.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(createAdjustment).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(createAdjustment).mock.calls;
    expect(first[0]).toEqual({ inventoryId: "w-2", kind: "merma", reason: "dano", lines: [{ variantId: "v-1", quantity: 2, direction: "OUT" }], operationId: expect.any(String) });
    expect(second[0].operationId).toBe(first[0].operationId);
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("AJ-0003 enviado a aprobación", expect.anything()));
  });
});
