import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  getSaleAssignment,
  getSaleOperation,
  retrySaleAssignment,
} from "@/services/saleTrackingService";
import {
  getSaleUnitLifecycleContext,
  lifecycleStorageKey,
  readLifecycleOperation,
  submitSaleUnitLifecycle,
  type SaleUnitLifecycleContext,
} from "@/services/saleUnitLifecycleService";
import SaleUnitLifecycleModal from "../SaleUnitLifecycleModal";

let company = "company";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: company }, user: { id: "user" } } }),
}));
jest.mock("@/services/saleUnitLifecycleService", () => ({
  ...jest.requireActual("@/services/saleUnitLifecycleService"),
  getSaleUnitLifecycleContext: jest.fn(),
  submitSaleUnitLifecycle: jest.fn(),
}));
jest.mock("@/services/saleTrackingService", () => ({
  ...jest.requireActual("@/services/saleTrackingService"),
  getSaleAssignment: jest.fn(),
  getSaleOperation: jest.fn(),
  retrySaleAssignment: jest.fn(),
}));
jest.mock("../SaleUnitSelection", () => ({
  __esModule: true,
  default: ({ cart, onChange }: any) => (
    <>
      <button
        onClick={() =>
          onChange(cart[0].id, [{ id: "unit-b", code: "001234567890124", status: "AVAILABLE" }])
        }
      >
        Elegir unidad disponible B
      </button>
      <button
        onClick={() =>
          onChange(cart[0].id, [{ id: "unit-c", code: "001234567890125", status: "AVAILABLE" }])
        }
      >
        Elegir unidad disponible C
      </button>
    </>
  ),
}));

const header = {
  id: "order",
  inventoryId: "warehouse",
  status: "ENTREGADO",
  stockVersion: 3,
  items: [
    {
      id: "line",
      productVariantId: "phone",
      productName: "Teléfono",
      sku: "PHONE",
      quantity: 1,
      unitPrice: "100",
      trackingMode: "IMEI",
      unitIds: ["unit-a"],
      units: [{ id: "unit-a", code: "001234567890123", status: "SOLD" }],
    },
  ],
} as OrderHeader;
const context: SaleUnitLifecycleContext = {
  orderId: "order",
  status: "ENTREGADO",
  expectedStockVersion: 3,
  unitAssignmentStatus: "CONFIRMED",
  unitStockState: "committed",
  canReturn: true,
  requiresPhysicalReturnConfirmation: false,
  canReactivate: false,
  items: [
    {
      ...header.items[0],
      orderItemId: "line",
      trackingMode: "IMEI",
      unitIds: ["unit-a"],
      units: header.items[0].units!,
    },
  ],
  operations: [],
};
const key = lifecycleStorageKey("company", "user", "order");
const response = (operationId: string, status: string, kind = "return") => ({
  ...header,
  status: status === "CONFIRMED" ? (kind === "return" ? "ANULADO" : "PENDIENTE") : header.status,
  stockVersion: 4,
  confirmedStockVersion: status === "CONFIRMED" ? 4 : 3,
  unitLifecycleOperation: { operationId, kind, status, stockVersion: 4 },
});
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  company = "company";
  let number = 0;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++number).padStart(12, "0")}`,
  });
  jest.mocked(getSaleUnitLifecycleContext).mockResolvedValue(context);
  jest.mocked(getSaleAssignment).mockResolvedValue(header);
  jest.mocked(retrySaleAssignment).mockResolvedValue(header);
});
async function confirmReturn() {
  await screen.findByText("001234567890123");
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Compra devuelta" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar devolución completa" }));
}
const props = { open: true, orderId: "order", action: "return" as const, onClose: jest.fn() };

test("timeout and reload retain the exact request and UUID; a confirmed operation never posts the return twice", async () => {
  jest.mocked(submitSaleUnitLifecycle).mockRejectedValue(new Error("timeout"));
  const updated = jest.fn();
  const view = render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  await confirmReturn();
  await screen.findByRole("alert");
  const saved = readLifecycleOperation(key, "order")!;
  expect(saved.request).toEqual({
    operationId: saved.operationId,
    expectedStockVersion: 3,
    reason: "Compra devuelta",
    items: [{ orderItemId: "line", quantity: 1, unitIds: ["unit-a"] }],
  });
  expect(updated).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Revisar solicitud rechazada" }),
  ).not.toBeInTheDocument();
  view.unmount();
  jest.mocked(getSaleOperation).mockResolvedValue(response(saved.operationId, "CONFIRMED"));
  render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  await screen.findByText(/Devolución completa confirmada/);
  expect(submitSaleUnitLifecycle).toHaveBeenCalledTimes(1);
  expect(readLifecycleOperation(key, "order")).toBeNull();
  expect(updated).toHaveBeenCalledTimes(1);
});

test("an unknown result retries the same snapshot and pending acknowledgement does not announce success", async () => {
  jest
    .mocked(submitSaleUnitLifecycle)
    .mockRejectedValueOnce(new Error("timeout"))
    .mockImplementation(
      async (_id, _kind, request) => response(request.operationId, "PENDING") as any,
    );
  jest.mocked(getSaleOperation).mockRejectedValue({ response: { status: 404 } });
  const updated = jest.fn();
  render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  await confirmReturn();
  await screen.findByRole("alert");
  const first = jest.mocked(submitSaleUnitLifecycle).mock.calls[0];
  fireEvent.click(screen.getByRole("button", { name: "Reintentar misma operación" }));
  await waitFor(() => expect(submitSaleUnitLifecycle).toHaveBeenCalledTimes(2));
  expect(jest.mocked(submitSaleUnitLifecycle).mock.calls[1]).toEqual(first);
  expect(updated).not.toHaveBeenCalled();
  expect(screen.queryByText(/Devolución completa confirmada/)).not.toBeInTheDocument();
});

test("a rejected reactivation can select another unit under a new operation while keeping fixed lines", async () => {
  jest
    .mocked(getSaleUnitLifecycleContext)
    .mockResolvedValue({
      ...context,
      status: "ANULADO",
      canReturn: false,
      canReactivate: true,
      unitStockState: "released",
    });
  jest
    .mocked(submitSaleUnitLifecycle)
    .mockImplementation(
      async (_id, _kind, request) => response(request.operationId, "REJECTED", "reactivate") as any,
    );
  render(<SaleUnitLifecycleModal {...props} action="reactivate" />);
  await screen.findByRole("button", { name: "Elegir unidad disponible B" });
  fireEvent.click(screen.getByRole("button", { name: "Elegir unidad disponible B" }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Reactivar" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Solicitar nueva reserva" }));
  await screen.findByRole("button", { name: "Revisar solicitud rechazada" });
  const first = readLifecycleOperation(key, "order")!;
  jest
    .mocked(getSaleOperation)
    .mockResolvedValue(response(first.operationId, "REJECTED", "reactivate"));
  fireEvent.click(screen.getByRole("button", { name: "Revisar solicitud rechazada" }));
  await screen.findByRole("button", { name: "Elegir unidad disponible B" });
  expect(readLifecycleOperation(key, "order")).toBeNull();
  expect(screen.getByRole("button", { name: "Solicitar nueva reserva" })).toBeDisabled();
  expect(first.request?.items).toEqual([{ orderItemId: "line", quantity: 1, unitIds: ["unit-b"] }]);
  fireEvent.click(screen.getByRole("button", { name: "Elegir unidad disponible C" }));
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Unidad B ocupada; elegir C" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Solicitar nueva reserva" }));
  await waitFor(() => expect(submitSaleUnitLifecycle).toHaveBeenCalledTimes(2));
  const second = jest.mocked(submitSaleUnitLifecycle).mock.calls[1][2];
  expect(second.operationId).not.toBe(first.operationId);
  expect(second.items).toEqual([{ orderItemId: "line", quantity: 1, unitIds: ["unit-c"] }]);
});

test("a late context from the previous company is aborted and never displays its codes", async () => {
  let resolve!: (value: SaleUnitLifecycleContext) => void;
  jest.mocked(getSaleUnitLifecycleContext).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const view = render(<SaleUnitLifecycleModal {...props} />);
  await waitFor(() => expect(getSaleUnitLifecycleContext).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getSaleUnitLifecycleContext).mock.calls[0][1];
  company = "other";
  jest.mocked(getSaleUnitLifecycleContext).mockRejectedValue(new Error("no access"));
  view.rerender(<SaleUnitLifecycleModal {...props} />);
  await screen.findByRole("alert");
  await act(async () => resolve(context));
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByText("001234567890123")).not.toBeInTheDocument();
});

test("a pending server operation is recoverable without a local request and never posts a new operation", async () => {
  jest
    .mocked(getSaleUnitLifecycleContext)
    .mockResolvedValue({
      ...context,
      canReturn: false,
      operations: [
        { operationId: "server-op", kind: "return", status: "PENDING", stockVersion: 4 },
      ],
    });
  jest
    .mocked(getSaleOperation)
    .mockResolvedValueOnce(response("server-op", "PENDING"))
    .mockResolvedValueOnce(response("server-op", "CONFIRMED"));
  render(<SaleUnitLifecycleModal {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar misma operación" }));
  await screen.findByText(/Devolución completa confirmada/);
  expect(retrySaleAssignment).toHaveBeenCalledWith("order");
  expect(submitSaleUnitLifecycle).not.toHaveBeenCalled();
});

test("a reply for another operation cannot clear the pending snapshot or report success", async () => {
  jest
    .mocked(submitSaleUnitLifecycle)
    .mockResolvedValue(response("other-operation", "CONFIRMED") as any);
  const updated = jest.fn();
  render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  await confirmReturn();
  await screen.findByText(/No se pudo comprobar la respuesta/);
  expect(readLifecycleOperation(key, "order")).not.toBeNull();
  expect(updated).not.toHaveBeenCalled();
});

test("recovery of a confirmed reactivation from a previous cycle does not announce a current reservation", async () => {
  sessionStorage.setItem(
    key,
    JSON.stringify({ orderId: "order", kind: "reactivate", operationId: "old-reactivation" }),
  );
  jest
    .mocked(getSaleUnitLifecycleContext)
    .mockResolvedValue({
      ...context,
      status: "ANULADO",
      expectedStockVersion: 6,
      canReturn: false,
      canReactivate: true,
      unitStockState: "released",
    });
  jest
    .mocked(getSaleOperation)
    .mockResolvedValue({
      ...response("old-reactivation", "CONFIRMED", "reactivate"),
      status: "ANULADO",
      stockVersion: 6,
      confirmedStockVersion: 6,
    });
  const updated = jest.fn();
  render(<SaleUnitLifecycleModal {...props} action="reactivate" onUpdated={updated} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar resultado" }));
  await screen.findByText(/reactivación de la versión 4 fue confirmada.*estado actual es ANULADO/);
  expect(screen.queryByText(/La venta está reactivada/)).not.toBeInTheDocument();
  expect(readLifecycleOperation(key, "order")).toBeNull();
  expect(submitSaleUnitLifecycle).not.toHaveBeenCalled();
  await waitFor(() => expect(getSaleUnitLifecycleContext).toHaveBeenCalledTimes(2));
  expect(updated).toHaveBeenCalledWith(
    expect.objectContaining({ status: "ANULADO", confirmedStockVersion: 6 }),
  );
});


function configureInTransitContext() {
  const units = [{ id: "unit-a", code: "001234567890123", status: "RESERVED" as const }];
  jest.mocked(getSaleAssignment).mockResolvedValue({ ...header, status: "EN_ENVIO", items: [{ ...header.items[0], units }] });
  jest.mocked(getSaleUnitLifecycleContext).mockResolvedValue({ ...context, status: "EN_ENVIO", unitStockState: "reserved", requiresPhysicalReturnConfirmation: true, items: [{ ...context.items[0], units }] });
}

test("an in-transit return keeps its physical confirmation and same UUID across timeout and reload", async () => {
  configureInTransitContext();
  jest.mocked(submitSaleUnitLifecycle).mockRejectedValueOnce(new Error("timeout")).mockImplementation(async (_id, _kind, request) => ({ ...response(request.operationId, "PENDING"), status: "EN_ENVIO" }) as any);
  jest.mocked(getSaleOperation).mockRejectedValue({ response: { status: 404 } });
  const updated = jest.fn();
  const view = render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  const confirm = await screen.findByRole("button", { name: "Confirmar retorno físico" });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Retorno del courier" } });
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(confirm);
  await screen.findByRole("alert");
  const saved = readLifecycleOperation(key, "order")!;
  expect(saved.request).toMatchObject({ physicalReturnConfirmed: true, expectedStockVersion: 3, items: [{ orderItemId: "line", quantity: 1, unitIds: ["unit-a"] }] });
  expect(saved.request).not.toHaveProperty("returnFromReserved");
  expect(updated).not.toHaveBeenCalled();
  view.unmount();
  render(<SaleUnitLifecycleModal {...props} onUpdated={updated} />);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar misma operación" }));
  await waitFor(() => expect(submitSaleUnitLifecycle).toHaveBeenCalledTimes(2));
  expect(jest.mocked(submitSaleUnitLifecycle).mock.calls[1][2]).toEqual(saved.request);
  expect(updated).not.toHaveBeenCalled();
  expect(screen.queryByText(/Devolución completa confirmada/)).not.toBeInTheDocument();
});

test("closing an in-transit return without confirmation sends no mutation or durable request", async () => {
  configureInTransitContext();
  const view = render(<SaleUnitLifecycleModal {...props} />);
  await screen.findByRole("button", { name: "Confirmar retorno físico" });
  view.unmount();
  expect(submitSaleUnitLifecycle).not.toHaveBeenCalled();
  expect(readLifecycleOperation(key, "order")).toBeNull();
});

test("an in-transit context lacking the physical confirmation contract cannot submit", async () => {
  configureInTransitContext();
  jest.mocked(getSaleUnitLifecycleContext).mockResolvedValue({ ...context, status: "EN_ENVIO", unitStockState: "reserved", requiresPhysicalReturnConfirmation: false });
  render(<SaleUnitLifecycleModal {...props} />);
  await screen.findByText(/todavía no permite una devolución/);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(submitSaleUnitLifecycle).not.toHaveBeenCalled();
});
