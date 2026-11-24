import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import LiveCheckoutDelivery from "../LiveCheckoutDelivery";
import LiveManualPaymentDialog from "../LiveManualPaymentDialog";
import {
  getLiveCheckoutSnapshot,
  quoteLivePurchase,
  uploadLiveYapeProof,
} from "../liveService";
import type { LiveCheckoutSnapshot, LiveDelivery, LiveReservation } from "../types";

/**
 * FEAT-33 L4 (mockup): pagar es una sola pantalla en 3 pasos (Entrega → Paga → Confirma) con «←»
 * arriba, el total abajo y, al enviar el comprobante, la pantalla final «¡Listo, …!».
 */
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  quoteLivePurchase: jest.fn(),
  checkoutLivePurchase: jest.fn(),
  getLiveCheckoutSnapshot: jest.fn(),
  uploadLiveYapeProof: jest.fn(),
}));
const delivery: LiveDelivery = {
  type: "AGENCY",
  courier: "SHALOM",
  department: "Cajamarca",
  province: "Cajamarca",
  district: "Los Baños Del Inca",
  agencyId: "247",
  agency: "Baños del Inca",
  dni: "45678901",
};
const pending: LiveCheckoutSnapshot = {
  checkoutId: "checkout-1",
  status: "PENDING",
  method: "yape",
  orderNumber: "ORD-157900",
  trackingUrl: `/p/${"a".repeat(43)}`,
  quote: {
    quoteId: "q",
    expiresAt: "2026-11-24T20:00:00Z",
    subtotal: 69,
    shipping: 8,
    total: 77,
    items: [
      { variantId: "v1", name: "Polo", sku: "P-1", quantity: 2, unitPrice: 25 },
      { variantId: "v2", name: "Crema", sku: "C-1", quantity: 1, unitPrice: 19 },
    ],
  },
  customer: { name: "Rosa Quispe", phone: "987654321" },
  manualPayment: {
    status: "AWAITING_PROOF",
    phone: "912345678",
    holder: "Kunca SAC",
    proofDeadlineAt: "2026-11-25T12:00:00Z",
    reviewDeadlineAt: null,
  },
};
const steps = () => within(screen.getByRole("list", { name: "Pasos de la compra" }));
beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "00000000-0000-4000-8000-000000000001"),
  });
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue(pending);
});

test("step 1 asks where to send it, shows the total below and goes back to the cart", async () => {
  (quoteLivePurchase as jest.Mock).mockResolvedValue({
    quoteId: "quote",
    subtotal: 234,
    shipping: 10,
    total: 244,
  });
  const onClose = jest.fn();
  render(
    <LiveCheckoutDelivery
      storeId="store"
      visitor="visitor"
      customer={{ name: "Rosa Quispe", phone: "987654321", savedDelivery: delivery }}
      reservations={[
        { id: "a", quantity: 2, unitPrice: 100 } as LiveReservation,
        { id: "b", quantity: 1, unitPrice: 34 } as LiveReservation,
      ]}
      options={[]}
      methods={["yape"]}
      onClose={onClose}
      onYape={jest.fn()}
    />,
  );
  expect(screen.getByRole("heading", { name: "¿Dónde te lo enviamos?" })).toBeInTheDocument();
  expect(steps().getByText(/Entrega/).closest("li")).toHaveAttribute("aria-current", "step");
  expect(screen.getByText(/3 prendas · productos S\/\s234\.00/)).toBeInTheDocument();
  expect(
    await screen.findByRole("button", { name: /^Continuar · S\/\s244\.00$/ }),
  ).toBeEnabled();
  expect(screen.getByText(/Envío S\/\s10\.00 · Shalom/)).toBeInTheDocument();
  const card = screen.getByTestId("saved-delivery");
  expect(within(card).getByText("🏢 Recoger en agencia Shalom")).toBeInTheDocument();
  expect(within(card).getByText("Recibe: Rosa Quispe · 987654321")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(onClose).toHaveBeenCalled();
});

test("steps 2 and 3: pay with Yape, then confirm; back moves between them", async () => {
  const onClose = jest.fn();
  render(
    <LiveManualPaymentDialog
      storeId="store"
      visitor="visitor"
      checkoutId="checkout-1"
      initial={pending}
      onClose={onClose}
      onUpdated={jest.fn()}
    />,
  );
  expect(await screen.findByRole("heading", { name: "Paga con Yape" })).toBeInTheDocument();
  expect(steps().getByText(/Entrega/)).toHaveTextContent("✓");
  expect(steps().getByText(/Paga/).closest("li")).toHaveAttribute("aria-current", "step");
  expect(screen.getByText("912 345 678")).toBeInTheDocument();
  expect(screen.getByText("Tus prendas siguen separadas mientras pagas.")).toBeInTheDocument();
  expect(screen.getByText(/3 prendas · productos S\/\s69\.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ya yapeé →" }));
  expect(screen.getByRole("heading", { name: "Confirma tu pago" })).toBeInTheDocument();
  expect(screen.getByText(/Yapeaste/)).toHaveTextContent("Yapeaste S/ 77.00 a Kunca SAC");
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(screen.getByRole("heading", { name: "Paga con Yape" })).toBeInTheDocument();
  // Desde «Paga» se cierra: el pedido queda en «Mis compras» para pagarlo después.
  fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  expect(onClose).toHaveBeenCalled();
});

test("after sending the proof it shows the final screen of the mockup", async () => {
  const reviewing = {
    ...pending,
    buyerStatus: "UNDER_REVIEW",
    manualPayment: { ...pending.manualPayment!, status: "UNDER_REVIEW" as const },
  };
  (uploadLiveYapeProof as jest.Mock).mockImplementation(async () => {
    (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue(reviewing);
    return reviewing;
  });
  const onClose = jest.fn();
  render(
    <LiveManualPaymentDialog
      storeId="store"
      visitor="visitor"
      checkoutId="checkout-1"
      initial={pending}
      storeName="Kunca Store"
      continueLabel="Seguir comprando en el live"
      combineShipping
      onClose={onClose}
      onUpdated={jest.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Ya yapeé →" }));
  fireEvent.change(screen.getByLabelText("Número de operación Yape"), {
    target: { value: "01234567" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));
  expect(await screen.findByRole("heading", { name: "¡Listo, Rosa!" })).toBeInTheDocument();
  expect(screen.getByText(/Recibimos tu Yape de/)).toHaveTextContent(
    "Recibimos tu Yape de S/ 77.00. Kunca Store lo valida y te avisa por WhatsApp. Tus prendas siguen separadas.",
  );
  const summary = within(screen.getByTestId("done-summary"));
  expect(summary.getByText("ORD-157900")).toBeInTheDocument();
  expect(summary.getByText("3")).toBeInTheDocument();
  expect(summary.getByText("Validando tu pago")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver mi pedido" })).toHaveAttribute(
    "href",
    `/p/${"a".repeat(43)}`,
  );
  expect(screen.getByText("Si vuelves a comprar hoy, se suma al mismo envío.")).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "Pasos de la compra" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Seguir comprando en el live" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
