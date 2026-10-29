import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import InventoryUnitTraceModal from "../InventoryUnitTraceModal";
import {
  getInventoryUnitTrace,
  type InventoryUnitTraceResponse,
} from "@/services/inventoryUnitTraceService";
let company = "company";
let user = "user";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: company }, user: { id: user } } }),
}));
jest.mock("@/services/inventoryUnitTraceService", () => ({
  ...jest.requireActual("@/services/inventoryUnitTraceService"),
  getInventoryUnitTrace: jest.fn(),
}));
const get = jest.mocked(getInventoryUnitTrace);
const code = "001234567890123";
const result = (requestedCode = code, page = 1): InventoryUnitTraceResponse => ({
  companyId: company,
  product: {
    id: "product",
    name: "Teléfono",
    sku: "PHONE",
    attributes: { color: "Azul", capacity: "128GB" },
  },
  unit: {
    id: "unit",
    code: requestedCode,
    trackingMode: "IMEI",
    status: "RESERVED",
    variantId: "variant",
    inventoryItemId: "item-b",
    locationVersion: 2,
    inventory: { id: "warehouse-b", name: "Sucursal B" },
    purchase: { id: "purchase", itemId: "purchase-item" },
    reservedOrderId: "order",
    soldOrderId: null,
    createdAt: "2026-10-17T10:00:00Z",
    updatedAt: "2026-10-17T11:00:00Z",
  },
  data: [
    {
      movementId: `movement-${page}`,
      type: "IN",
      quantity: 1,
      movementQuantity: 10,
      physicalDelta: 1,
      reason: "UNIT_TRANSFER_IN - Reposición",
      referenceId: "transfer",
      createdAt: "2026-10-17T10:00:00Z",
      inventory: { id: "warehouse-b", name: "Sucursal B" },
      transfer: {
        operationId: "transfer",
        sourceInventory: { id: "warehouse-a", name: "Principal" },
        destinationInventory: { id: "warehouse-b", name: "Sucursal B" },
      },
    },
  ],
  meta: { total: 21, page, limit: 20, totalPages: 2 },
});
const props = { companyId: "company", onClose: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  company = "company";
  user = "user";
  get.mockImplementation(async (value, page) => result(value, page));
});
async function search(value = code) {
  fireEvent.change(screen.getByLabelText("IMEI o serie exacto"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar código" }));
  await screen.findByRole("region", { name: "Estado y ubicación actuales" });
}
test("global search waits for explicit exact input, preserves zeroes and shows current product, location and protected references", async () => {
  render(<InventoryUnitTraceModal {...props} />);
  expect(get).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Buscar código" })).toBeDisabled();
  await search();
  expect(get).toHaveBeenCalledWith(code, 1, expect.any(AbortSignal));
  const snapshot = screen.getByRole("region", { name: "Estado y ubicación actuales" });
  expect(snapshot).toHaveTextContent(`${code} · Reservada`);
  expect(snapshot).toHaveTextContent("PHONE · Teléfono · Azul · 128GB");
  expect(snapshot).toHaveTextContent("Sucursal B");
  expect(screen.getByRole("link", { name: "purchase" })).toHaveAttribute(
    "href",
    "/registrar-compra?edit=purchase&tracked=1",
  );
  expect(screen.getByRole("link", { name: "order" })).toHaveAttribute(
    "href",
    "/registrar-venta?orderId=order",
  );
  expect(screen.getByText("Transferencia de ingreso: Reposición")).toBeInTheDocument();
  expect(screen.getByText("Principal → Sucursal B")).toBeInTheDocument();
  expect(screen.getByText("Movimiento completo: 10 unidades")).toBeInTheDocument();
  expect(screen.getByText("Unidades de este código en el registro: 1")).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "+1" })).toBeInTheDocument();
});
test("prefilled lookup paginates the same exact code and new searches reset to page one", async () => {
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  await screen.findByRole("region", { name: "Estado y ubicación actuales" });
  fireEvent.click(screen.getByRole("button", { name: "Más movimientos" }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith(code, 2, expect.any(AbortSignal)));
  await screen.findByText("Página 2 de 2 · 21 movimientos");
  await search("000123");
  expect(get).toHaveBeenLastCalledWith("000123", 1, expect.any(AbortSignal));
  expect(screen.getByText("Página 1 de 2 · 21 movimientos")).toBeInTheDocument();
});
test("displays reservation zero and sale minus one separately from present state", async () => {
  const response = result();
  response.unit.status = "AVAILABLE";
  response.data = [
    {
      ...response.data[0],
      movementId: "reserved",
      type: "RESERVED",
      reason: "Reserva",
      physicalDelta: 0,
      movementQuantity: 1,
      transfer: undefined,
    },
    {
      ...response.data[0],
      movementId: "sold",
      type: "COMMITTED",
      reason: "Venta",
      physicalDelta: -1,
      movementQuantity: 1,
      transfer: undefined,
    },
    {
      ...response.data[0],
      movementId: "regularized",
      type: "ADJUSTMENT",
      reason: "Regularización",
      quantity: 0,
      physicalDelta: 0,
      movementQuantity: 0,
      transfer: undefined,
    },
  ];
  get.mockResolvedValue(response);
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  expect(await screen.findByText("Salida por venta")).toBeInTheDocument();
  expect(screen.getAllByRole("cell", { name: "Sin cambio (0)" })).toHaveLength(2);
  expect(screen.getByRole("cell", { name: "−1" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Estado y ubicación actuales" })).toHaveTextContent(
    "Disponible",
  );
  expect(screen.getByText(/corresponden a la situación actual/)).toBeInTheDocument();
});
test("distinguishes not found from connection failure and retries the same read", async () => {
  get
    .mockRejectedValueOnce({ response: { status: 404 } })
    .mockRejectedValueOnce(new Error("Conexión interrumpida"))
    .mockResolvedValue(result());
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  await screen.findByText(/No se encontró este código/);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Buscar código" }));
  await screen.findByText("Conexión interrumpida");
  fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta" }));
  await screen.findByRole("region", { name: "Estado y ubicación actuales" });
  expect(get).toHaveBeenCalledTimes(3);
});
test("discarding an older search prevents its late response from replacing the newest code", async () => {
  let complete!: (value: InventoryUnitTraceResponse) => void;
  get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  const oldSignal = get.mock.calls[0][2]!;
  await search("000999");
  expect(oldSignal.aborted).toBe(true);
  await act(async () => complete(result(code)));
  const snapshot = screen.getByRole("region", { name: "Estado y ubicación actuales" });
  expect(snapshot).toHaveTextContent("000999");
  expect(within(snapshot).queryByText(code)).not.toBeInTheDocument();
});
test.each(["company", "user"])(
  "changing %s aborts private lookup and clears old state",
  async (scope) => {
    let complete!: (value: InventoryUnitTraceResponse) => void;
    get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const view = render(<InventoryUnitTraceModal {...props} />);
    fireEvent.change(screen.getByLabelText("IMEI o serie exacto"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar código" }));
    const oldResult = result();
    const oldSignal = get.mock.calls[0][2]!;
    if (scope === "company") company = "other";
    else user = "other";
    view.rerender(<InventoryUnitTraceModal {...props} />);
    expect(oldSignal.aborted).toBe(true);
    await act(async () => complete(oldResult));
    expect(
      screen.queryByRole("region", { name: "Estado y ubicación actuales" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(code)).not.toBeInTheDocument();
    if (scope === "user") expect(screen.getByLabelText("IMEI o serie exacto")).toHaveValue("");
    else expect(screen.getByRole("alert")).toHaveTextContent("La sesión no permite");
  },
);
test("hides a response scoped to another company and offers retry without revealing its code or product", async () => {
  get.mockResolvedValue({ ...result(), companyId: "other" });
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  await screen.findByText(/No se pudo validar/);
  expect(
    screen.queryByRole("region", { name: "Estado y ubicación actuales" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/PHONE/)).not.toBeInTheDocument();
});
test("shows a location and variant fallback even if catalogue metadata or linked history is absent", async () => {
  get.mockResolvedValue({
    ...result(),
    product: null,
    unit: { ...result().unit, purchase: null },
    data: [],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  });
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  await screen.findByText("Variante: variant");
  expect(screen.getByText("Sin compra de origen vinculada.")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Estado y ubicación actuales" })).toHaveTextContent(
    "Sucursal B",
  );
  expect(screen.getByText(/No hay movimientos vinculados/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Más movimientos" })).toBeDisabled();
});

test("labels recorded sale, purchase and regularization reasons without exposing internal event names", async () => {
  const response = result();
  const reasons = [
    ["order.created:1", "Reserva por venta"],
    ["order.updated:2", "Actualización de venta"],
    ["order.cancelled:3", "Anulación de venta"],
    ["order.delivered:4", "Entrega de venta"],
    ["order.returned:5", "Devolución de venta"],
    ["order.reactivated:6", "Reactivación de venta"],
    ["PURCHASE - C001", "Compra: C001"],
    ["PURCHASE_CANCELLED - C002", "Anulación de compra: C002"],
    ["UNIT_REGULARIZATION", "Asociación de códigos al stock existente"],
  ];
  response.data = reasons.map(([reason], index) => ({
    ...response.data[0],
    movementId: `reason-${index}`,
    reason,
  }));
  get.mockResolvedValue(response);
  render(<InventoryUnitTraceModal {...props} initialCode={code} />);
  await screen.findByRole("region", { name: "Estado y ubicación actuales" });
  for (const [reason, label] of reasons) {
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(reason)).not.toBeInTheDocument();
  }
});
