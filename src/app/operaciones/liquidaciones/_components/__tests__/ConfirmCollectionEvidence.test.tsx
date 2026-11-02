import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmCollectionDialog } from "../SettlementCreateDialogs";
import * as settlements from "@/services/courierSettlementsService";
import * as evidence from "@/services/courierPaymentEvidenceService";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { Courier } from "@/services/courierService";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "user" } } }),
}));
jest.mock("@/services/courierPaymentEvidenceService", () => ({
  getOrderCourierPaymentEvidence: jest.fn(),
}));
jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  confirmCourierCollection: jest.fn(),
  uploadSettlementProof: jest.fn(),
}));

it("links the chosen provider report while requiring the operator's verified amount", async () => {
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "request",
  });
  jest
    .mocked(evidence.getOrderCourierPaymentEvidence)
    .mockResolvedValue({
      orderId: "o1",
      payments: [],
      evidence: [
        {
          id: "ev1",
          orderId: "o1",
          provider: "EVA",
          providerStatus: "ENTREGADO",
          trackingId: "track",
          reportedAmount: "100.00",
          photos: [],
          occurredAt: "2026-11-02",
          createdAt: "2026-11-02",
          verificationStatus: "PENDING_REVIEW",
        },
      ],
    });
  jest
    .mocked(settlements.confirmCourierCollection)
    .mockResolvedValue({ id: "collection" } as settlements.CourierCollection);
  const order = {
    id: "o1",
    orderNumber: "ORD-1",
    status: "ENTREGADO",
    courierId: "courier",
    courier: "EVA",
    currency: "PEN",
    customer: { fullName: "Ana" },
  } as unknown as OrderHeader;
  const courier = { id: "courier", name: "EVA", companyId: "company" } as Courier;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConfirmCollectionDialog
        companyId="company"
        orders={[order]}
        couriers={[courier]}
        onClose={jest.fn()}
        onPersisted={async () => {}}
        onComplete={jest.fn()}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Pedido"), { target: { value: "o1" } });
  expect(evidence.getOrderCourierPaymentEvidence).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Consultar reportes de courier" }));
  fireEvent.click(await screen.findByRole("radio", { name: /100.00 · Por verificar/ }));
  expect(screen.getByLabelText("Importe cobrado PEN")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Importe cobrado PEN"), { target: { value: "80" } });
  fireEvent.change(screen.getByLabelText("Cómo se verificó el cobro"), {
    target: { value: "Comprobante y courier confirman ochenta" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cobro" }));
  await waitFor(() =>
    expect(settlements.confirmCourierCollection).toHaveBeenCalledWith(
      "company",
      expect.objectContaining({ providerEvidenceId: "ev1", amount: 80 }),
    ),
  );
});
