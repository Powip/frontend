jest.setTimeout(30_000);
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { RegisterLiquidationDialog } from "../RegisterLiquidationDialog";
import type { PendingCollection } from "../pendingCollections";
import * as api from "@/services/courierSettlementsService";

jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  confirmCourierCollection: jest.fn(),
  createCourierSettlement: jest.fn(),
  uploadSettlementProof: jest.fn(),
}));
const service = jest.mocked(api);

const row = (orderId: string, pendingCents: number, overrides: Partial<PendingCollection> = {}): PendingCollection => ({
  orderId,
  orderNumber: `ORD-${orderId}`,
  customerName: `Cliente ${orderId}`,
  courierLabel: "Shalom",
  courierId: "courier1",
  currency: "PEN",
  updatedAt: "2026-11-20T15:00:00.000Z",
  days: 7,
  totalCents: pendingCents,
  paidToBusinessCents: 0,
  courierHeldPaymentsCents: 0,
  expectedCents: pendingCents,
  confirmedCents: 0,
  pendingCents,
  issue: null,
  ...overrides,
});
const collection = (orderId: string, amount: number) =>
  ({ id: `col-${orderId}`, orderId, amount, currency: "PEN", courierId: "courier1" }) as api.CourierCollection;
const httpError = (status: number, message: string) =>
  new AxiosError(message, "ERR", undefined, undefined, {
    status,
    statusText: message,
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message },
  });

let uuid = 0;
beforeEach(() => {
  jest.clearAllMocks();
  uuid = 0;
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => `request-${++uuid}`),
  });
  service.confirmCourierCollection.mockImplementation(async (_company, input) => collection(input.orderId, input.amount));
  service.createCourierSettlement.mockImplementation(
    async () => ({ id: "settlement1", status: "PENDIENTE_REVISION" }) as api.SettlementDetail,
  );
});

function view(rows: PendingCollection[]) {
  const props = {
    onClose: jest.fn(),
    onPersisted: jest.fn().mockResolvedValue(undefined),
    onComplete: jest.fn(),
  };
  render(<RegisterLiquidationDialog companyId="company" rows={rows} {...props} />);
  return props;
}

it("confirms each collection, then registers one pending deposit and uploads the proof", async () => {
  const props = view([row("a", 5000), row("b", 3000)]);
  fireEvent.change(screen.getByLabelText("N.º de operación"), { target: { value: "OP-77" } });
  const proof = new File(["%PDF"], "deposito.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText("Comprobante"), { target: { files: [proof] } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar liquidación" }));

  await waitFor(() => expect(props.onComplete).toHaveBeenCalled());
  expect(service.confirmCourierCollection.mock.calls.map(([, input]) => input)).toEqual([
    expect.objectContaining({ orderId: "a", courierId: "courier1", amount: 50, collectedAt: "2026-11-20" }),
    expect.objectContaining({ orderId: "b", amount: 30 }),
  ]);
  expect(service.createCourierSettlement).toHaveBeenCalledWith("company", {
    requestId: "request-3",
    courierId: "courier1",
    allocations: [
      { collectionId: "col-a", amount: 50 },
      { collectionId: "col-b", amount: 30 },
    ],
    amountDeposited: 80,
    method: "transferencia",
    date: expect.any(String),
    operationNumber: "OP-77",
    notes: undefined,
  });
  expect(service.uploadSettlementProof).toHaveBeenCalledWith("company", "settlements", "settlement1", proof);
  expect(props.onPersisted).toHaveBeenCalledTimes(2);
});

it("allocates a short deposit in order and leaves the rest pending", async () => {
  const props = view([row("a", 5000), row("b", 3000), row("c", 2000)]);
  fireEvent.change(screen.getByLabelText("Importe depositado PEN"), { target: { value: "60" } });
  expect(screen.getByText(/Depósito parcial/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar liquidación" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalled());
  expect(service.confirmCourierCollection).toHaveBeenCalledTimes(3);
  expect(service.createCourierSettlement.mock.calls[0][1]).toMatchObject({
    amountDeposited: 60,
    allocations: [
      { collectionId: "col-a", amount: 50 },
      { collectionId: "col-b", amount: 10 },
    ],
  });
});

it("does not let the user claim more than what is pending", () => {
  view([row("a", 5000)]);
  fireEvent.change(screen.getByLabelText("Cobrado en ORD-a"), { target: { value: "60" } });
  expect(screen.getByText("Máximo PEN 50.00")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar liquidación" })).toBeDisabled();
});

it("retries only what failed: saved collections are not sent again", async () => {
  service.createCourierSettlement.mockRejectedValueOnce(new Error("Network Error"));
  const props = view([row("a", 5000), row("b", 3000)]);
  fireEvent.click(screen.getByRole("button", { name: "Guardar liquidación" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Los cobros quedaron confirmados");
  expect(screen.getByRole("button", { name: "Cerrar; cobros guardados" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalled());
  expect(service.confirmCourierCollection).toHaveBeenCalledTimes(2);
  const [first, second] = service.createCourierSettlement.mock.calls.map(([, input]) => input);
  expect(second.requestId).toBe(first.requestId);
});

it("names the order the server rejected and lets the user drop it", async () => {
  service.confirmCourierCollection.mockImplementation(async (_company, input) => {
    if (input.orderId === "b") throw httpError(409, "El courier no coincide con el pedido");
    return collection(input.orderId, input.amount);
  });
  const props = view([row("a", 5000), row("b", 3000)]);
  fireEvent.click(screen.getByRole("button", { name: "Guardar liquidación" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("ORD-b: El courier no coincide con el pedido");
  expect(service.createCourierSettlement).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Quitar ORD-b" }));
  fireEvent.change(screen.getByLabelText("Importe depositado PEN"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(props.onComplete).toHaveBeenCalled());
  expect(service.confirmCourierCollection).toHaveBeenCalledTimes(2);
  expect(service.createCourierSettlement.mock.calls[0][1].allocations).toEqual([{ collectionId: "col-a", amount: 50 }]);
});

it("recalculates the default deposit when an order is removed or an amount is corrected, until the user edits it", () => {
  view([row("a", 5000), row("b", 3000), row("c", 2000)]);
  const deposit = () => screen.getByLabelText("Importe depositado PEN");
  expect(deposit()).toHaveValue("100");
  fireEvent.click(screen.getByRole("button", { name: "Quitar ORD-c" }));
  expect(deposit()).toHaveValue("80");
  fireEvent.change(screen.getByLabelText("Cobrado en ORD-b"), { target: { value: "25" } });
  expect(deposit()).toHaveValue("75");
  expect(screen.queryByText(/El depósito supera lo cobrado/)).not.toBeInTheDocument();
  fireEvent.change(deposit(), { target: { value: "70" } });
  fireEvent.click(screen.getByRole("button", { name: "Quitar ORD-b" }));
  expect(deposit()).toHaveValue("70");
});

it("explains that a short deposit leaves the rest confirmed in «Cobros confirmados», not back in «Por liquidar»", () => {
  view([row("a", 5000), row("b", 3000)]);
  fireEvent.change(screen.getByLabelText("Importe depositado PEN"), { target: { value: "50" } });
  expect(screen.getByText(/Depósito parcial/)).toHaveTextContent("queda en «Cobros confirmados» esperando otro depósito");
});
