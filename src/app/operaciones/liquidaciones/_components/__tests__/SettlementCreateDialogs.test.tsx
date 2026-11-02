jest.setTimeout(30_000);
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmCollectionDialog, CreateSettlementDialog } from "../SettlementCreateDialogs";
import * as api from "@/services/courierSettlementsService";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { Courier } from "@/services/courierService";

jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  confirmCourierCollection: jest.fn(),
  createCourierSettlement: jest.fn(),
  uploadSettlementProof: jest.fn(),
}));
const service = jest.mocked(api);
const collection = (overrides: Partial<api.CourierCollection> = {}): api.CourierCollection => ({
  id: "c1",
  companyId: "company",
  orderId: "order1",
  storeId: "store",
  orderNumber: "ORD-1",
  customerName: "Ana",
  courierId: "courier1",
  courierName: "Courier Uno",
  currency: "PEN",
  amount: 100,
  settledAmount: 0,
  remainingAmount: 100,
  reservedAmount: 0,
  availableAmount: 100,
  status: "POR_LIQUIDAR",
  collectedAt: "2026-11-02",
  notes: "Cobro verificado",
  createdAt: "2026-11-02",
  createdBy: "finance",
  ...overrides,
});
const order = {
  id: "order1",
  orderNumber: "ORD-1",
  status: "ENTREGADO",
  courierId: "courier1",
  courier: "Courier Uno",
  currency: "PEN",
  grandTotal: 100,
  customer: { fullName: "Ana" },
  payments: [],
} as unknown as OrderHeader;
const courier = {
  id: "courier1",
  name: "Courier Uno",
  companyId: "company",
  isActive: true,
} as Courier;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "request-uuid"),
  });
});

it("requires an explicitly entered collection amount and verified note, even for a delivered order", async () => {
  const user = userEvent.setup({ delay: null });
  service.confirmCourierCollection.mockResolvedValue(collection());
  const done = jest.fn();
  render(
    <ConfirmCollectionDialog
      companyId="company"
      orders={[order]}
      couriers={[courier]}
      onClose={jest.fn()}
      onPersisted={async () => {}}
      onComplete={done}
    />,
  );
  await user.selectOptions(screen.getByLabelText("Pedido"), "order1");
  expect(screen.getByLabelText("Importe cobrado PEN")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  expect(service.confirmCourierCollection).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Importe cobrado PEN"), "30");
  await user.type(
    screen.getByLabelText("Cómo se verificó el cobro"),
    "Comprobante recibido de courier",
  );
  await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));
  await waitFor(() => expect(done).toHaveBeenCalled());
  expect(service.confirmCourierCollection).toHaveBeenCalledWith(
    "company",
    expect.objectContaining({
      orderId: "order1",
      courierId: "courier1",
      amount: 30,
      notes: "Comprobante recibido de courier",
      requestId: "request-uuid",
    }),
  );
});

it("keeps the saved collection when its proof fails and retries only the upload", async () => {
  const user = userEvent.setup({ delay: null });
  service.confirmCourierCollection.mockResolvedValue(collection());
  service.uploadSettlementProof
    .mockRejectedValueOnce(new Error("Storage unavailable"))
    .mockResolvedValueOnce({ id: "proof" } as api.SettlementProof);
  const done = jest.fn();
  render(
    <ConfirmCollectionDialog
      companyId="company"
      orders={[order]}
      couriers={[courier]}
      onClose={jest.fn()}
      onPersisted={async () => {}}
      onComplete={done}
    />,
  );
  await user.selectOptions(screen.getByLabelText("Pedido"), "order1");
  await user.type(screen.getByLabelText("Importe cobrado PEN"), "30");
  await user.type(screen.getByLabelText("Cómo se verificó el cobro"), "Confirmado en evidencia");
  const file = new File(["proof"], "receipt.pdf", { type: "application/pdf" });
  await user.upload(screen.getByLabelText("Comprobante"), file);
  await user.click(screen.getByRole("button", { name: "Confirmar cobro" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("El cobro está guardado");
  expect(done).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Reintentar comprobante" }));
  await waitFor(() => expect(done).toHaveBeenCalled());
  expect(service.confirmCourierCollection).toHaveBeenCalledTimes(1);
  expect(service.uploadSettlementProof).toHaveBeenCalledTimes(2);
  expect(service.uploadSettlementProof).toHaveBeenLastCalledWith(
    "company",
    "collections",
    "c1",
    file,
  );
});

it("requires explicit partial allocations that fit the actual deposit and saves pending review", async () => {
  const user = userEvent.setup({ delay: null });
  const result = { id: "s1", status: "PENDIENTE_REVISION" } as api.SettlementDetail;
  service.createCourierSettlement.mockResolvedValue(result);
  const done = jest.fn();
  render(
    <CreateSettlementDialog
      companyId="company"
      collections={[
        collection(),
        collection({ id: "c2", orderNumber: "ORD-2", availableAmount: 50 }),
      ]}
      onClose={jest.fn()}
      onPersisted={async () => {}}
      onComplete={done}
    />,
  );
  await user.type(screen.getByLabelText("Importe real depositado PEN"), "60");
  expect(screen.getByRole("button", { name: "Guardar depósito pendiente" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Asignar a ORD-1"), { target: { value: "40" } });
  fireEvent.change(screen.getByLabelText("Asignar a ORD-2"), { target: { value: "20" } });
  await user.click(screen.getByRole("button", { name: "Guardar depósito pendiente" }));
  await waitFor(() => expect(done).toHaveBeenCalledWith(result));
  expect(service.createCourierSettlement).toHaveBeenCalledWith(
    "company",
    expect.objectContaining({
      amountDeposited: 60,
      allocations: [
        { collectionId: "c1", amount: 40 },
        { collectionId: "c2", amount: 20 },
      ],
    }),
  );
});

it.each([
  collection({ id: "c2", orderNumber: "ORD-2", courierId: "other" }),
  collection({ id: "c2", orderNumber: "ORD-2", currency: "USD" }),
  collection({ id: "c2", orderNumber: "ORD-2", availableAmount: Number.NaN }),
])("blocks mixed couriers, currencies and unknown balances", async (second) => {
  render(
    <CreateSettlementDialog
      companyId="company"
      collections={[collection(), second]}
      onClose={jest.fn()}
      onPersisted={async () => {}}
      onComplete={jest.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Importe real depositado PEN"), {
    target: { value: "200" },
  });
  expect(screen.getByRole("button", { name: "Guardar depósito pendiente" })).toBeDisabled();
  expect(service.createCourierSettlement).not.toHaveBeenCalled();
});
