import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  getAvailableInventoryUnits,
  getInventoryUnitOperation,
  inventoryUnitMovementKey,
  readInventoryUnitMovement,
  submitInventoryUnitMovement,
  type InventoryUnitMovementReceipt,
} from "@/services/inventoryUnitMovementService";
import InventoryUnitMovementModal from "../InventoryUnitMovementModal";
let company = "company";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: company }, user: { id: "user" } } }),
}));
jest.mock("@/hooks/useBusinessInventories", () => ({
  useBusinessInventories: () => ({
    inventories: [
      { id: "origin", name: "Principal" },
      { id: "destination", name: "Sucursal" },
    ],
    isSuccess: true,
    isPending: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("@/services/inventoryUnitMovementService", () => ({
  ...jest.requireActual("@/services/inventoryUnitMovementService"),
  getAvailableInventoryUnits: jest.fn(),
  getInventoryUnitOperation: jest.fn(),
  submitInventoryUnitMovement: jest.fn(),
}));
const unit = { id: "unit-a", code: "001234567890123", status: "AVAILABLE" as const };
const source = {
  inventoryItemId: "item",
  variantId: "variant",
  inventoryId: "origin",
  inventoryName: "Principal",
  productName: "Teléfono",
  sku: "PHONE",
};
const available = {
  inventoryItemId: "item",
  inventoryId: "origin",
  variantId: "variant",
  trackingMode: "IMEI" as const,
  data: [unit],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};
const key = inventoryUnitMovementKey("company", "user", "item");
const props = {
  companyId: "company",
  source,
  action: "transfer" as const,
  onClose: jest.fn(),
  onSaved: jest.fn(),
};
const receipt = (
  operationId: string,
  status: "COMPLETED" | "REJECTED" = "COMPLETED",
): InventoryUnitMovementReceipt => ({
  companyId: "company",
  operationId,
  kind: "TRANSFER",
  status,
  quantity: 1,
  unitIds: ["unit-a"],
  sourceInventoryItemId: "item",
  sourceInventoryId: "origin",
  destinationInventoryId: "destination",
  units: [unit],
  movementIds: ["out", "in"],
  ...(status === "REJECTED"
    ? { error: { statusCode: 409, message: "La unidad ya está reservada" } }
    : {}),
});
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  company = "company";
  let counter = 0;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
  });
  jest.mocked(getAvailableInventoryUnits).mockResolvedValue(available);
});
async function prepareTransfer() {
  fireEvent.click(await screen.findByRole("checkbox", { name: /001234567890123 Disponible/ }));
  fireEvent.change(screen.getByLabelText("Almacén de destino"), {
    target: { value: "destination" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), {
    target: { value: "Reposición" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo los códigos/ }));
}
async function submitTransfer() {
  await prepareTransfer();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirmar transferencia" }));
  });
}

test("timeout and reload recover the same committed UUID without posting a transfer twice", async () => {
  jest.mocked(submitInventoryUnitMovement).mockRejectedValue(new Error("timeout"));
  const view = render(<InventoryUnitMovementModal {...props} />);
  await submitTransfer();
  await screen.findByRole("alert");
  const saved = readInventoryUnitMovement(key, "item")!;
  expect(saved.request).toEqual({
    operationId: saved.operationId,
    sourceInventoryItemId: "item",
    destinationInventoryId: "destination",
    quantity: 1,
    unitIds: [unit.id],
    reason: "Reposición",
  });
  expect(props.onSaved).not.toHaveBeenCalled();
  view.unmount();
  jest.mocked(getInventoryUnitOperation).mockResolvedValue(receipt(saved.operationId));
  render(<InventoryUnitMovementModal {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Consultar o reintentar la misma operación" }),
  );
  await screen.findByText(/Transferencia registrada/);
  expect(submitInventoryUnitMovement).toHaveBeenCalledTimes(1);
  expect(readInventoryUnitMovement(key, "item")).toBeNull();
  expect(props.onSaved).toHaveBeenCalledTimes(1);
});
test("lookup 404 after a timeout repeats the exact original request and UUID", async () => {
  jest
    .mocked(submitInventoryUnitMovement)
    .mockRejectedValueOnce(new Error("timeout"))
    .mockImplementation(async (_action, request) => receipt(request.operationId));
  jest.mocked(getInventoryUnitOperation).mockRejectedValue({ response: { status: 404 } });
  render(<InventoryUnitMovementModal {...props} />);
  await submitTransfer();
  await screen.findByRole("alert");
  const first = jest.mocked(submitInventoryUnitMovement).mock.calls[0];
  fireEvent.click(
    screen.getByRole("button", { name: "Consultar o reintentar la misma operación" }),
  );
  await screen.findByText(/Transferencia registrada/);
  expect(jest.mocked(submitInventoryUnitMovement).mock.calls[1]).toEqual(first);
});
test("durable rejection requires rechecking that receipt before replacing the UUID", async () => {
  jest
    .mocked(submitInventoryUnitMovement)
    .mockImplementation(async (_action, request) => receipt(request.operationId, "REJECTED"));
  render(<InventoryUnitMovementModal {...props} />);
  await submitTransfer();
  fireEvent.click(await screen.findByRole("button", { name: "Corregir movimiento rechazado" }));
  // The first correction cannot proceed without a verified server receipt.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Corregir movimiento rechazado" })).toBeEnabled(),
  );
  const original = readInventoryUnitMovement(key, "item")!;
  expect(original).not.toBeNull();
  jest
    .mocked(getInventoryUnitOperation)
    .mockResolvedValue(receipt(original.operationId, "REJECTED"));
  fireEvent.click(screen.getByRole("button", { name: "Corregir movimiento rechazado" }));
  await screen.findByLabelText("Motivo del movimiento");
  expect(readInventoryUnitMovement(key, "item")).toBeNull();
  expect(screen.getByRole("button", { name: "Confirmar transferencia" })).toBeDisabled();
  await submitTransfer();
  await waitFor(() => expect(submitInventoryUnitMovement).toHaveBeenCalledTimes(2));
  expect(jest.mocked(submitInventoryUnitMovement).mock.calls[1][1].operationId).not.toBe(
    original.operationId,
  );
});
test("a DTO 400 without durable receipt remains recoverable with the same UUID", async () => {
  jest
    .mocked(submitInventoryUnitMovement)
    .mockRejectedValue({ response: { status: 400, data: { message: "Validación rechazada" } } });
  render(<InventoryUnitMovementModal {...props} />);
  await submitTransfer();
  await screen.findByText("Validación rechazada");
  expect(readInventoryUnitMovement(key, "item")).not.toBeNull();
  expect(
    screen.queryByRole("button", { name: "Corregir movimiento rechazado" }),
  ).not.toBeInTheDocument();
});
test("changing company aborts its unit lookup and never reveals the old codes", async () => {
  let complete!: (result: typeof available) => void;
  jest.mocked(getAvailableInventoryUnits).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const view = render(<InventoryUnitMovementModal {...props} />);
  await waitFor(() => expect(getAvailableInventoryUnits).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getAvailableInventoryUnits).mock.calls[0][3];
  company = "other";
  view.rerender(<InventoryUnitMovementModal {...props} />);
  await act(async () => complete(available));
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByText(unit.code)).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("La sesión no permite");
});
test("duplicate submit events produce only one immutable operation", async () => {
  let complete!: (result: InventoryUnitMovementReceipt) => void;
  jest.mocked(submitInventoryUnitMovement).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  render(<InventoryUnitMovementModal {...props} />);
  await prepareTransfer();
  const button = screen.getByRole("button", { name: "Confirmar transferencia" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(submitInventoryUnitMovement).toHaveBeenCalledTimes(1);
  const saved = readInventoryUnitMovement(key, "item")!;
  await act(async () => complete(receipt(saved.operationId)));
  expect(props.onSaved).toHaveBeenCalledTimes(1);
});
test("merma records explicit zero financial values and confirms WRITTEN_OFF receipt and shrinkage ID", async () => {
  jest.mocked(submitInventoryUnitMovement).mockImplementation(async (_action, request) => ({
    ...receipt(request.operationId),
    kind: "WRITE_OFF",
    destinationInventoryId: undefined,
    units: [{ ...unit, status: "WRITTEN_OFF" }],
    shrinkageId: "shrinkage",
  }));
  render(<InventoryUnitMovementModal {...props} action="write-off" />);
  fireEvent.click(await screen.findByRole("checkbox", { name: /001234567890123 Disponible/ }));
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), { target: { value: "Daño" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo los códigos/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar merma de unidades" }));
  await screen.findByText(/Merma y baja de inventario registradas/);
  expect(submitInventoryUnitMovement).toHaveBeenCalledWith(
    "write-off",
    expect.objectContaining({
      inventoryItemId: "item",
      shrinkageType: "otro",
      unitCost: 0,
      recoveredAmount: 0,
      unitIds: [unit.id],
    }),
  );
  expect(screen.getByText("Registro de merma: shrinkage")).toBeInTheDocument();
});
test("a receipt for another operation never clears the snapshot or announces success", async () => {
  jest.mocked(submitInventoryUnitMovement).mockResolvedValue(receipt("wrong-op"));
  render(<InventoryUnitMovementModal {...props} />);
  await submitTransfer();
  await screen.findByText(/No se pudo comprobar el resultado/);
  expect(readInventoryUnitMovement(key, "item")).not.toBeNull();
  expect(props.onSaved).not.toHaveBeenCalled();
});
