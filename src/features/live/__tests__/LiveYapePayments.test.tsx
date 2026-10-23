import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveManualPaymentDialog from "../LiveManualPaymentDialog";
import LivePaymentSettings from "../LivePaymentSettings";
import LiveYapeReviews from "../LiveYapeReviews";
import {
  getLiveCheckoutSnapshot,
  getLiveYapeConfig,
  getLiveYapeReviewProof,
  getLiveYapeReviews,
  reviewLiveYapePayment,
  uploadLiveYapeProof,
} from "../liveService";
import type { LiveCheckoutSnapshot, LiveYapeReview } from "../types";

configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(20000);

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveCheckoutSnapshot: jest.fn(),
  getLiveYapeConfig: jest.fn(),
  getLiveYapeReviewProof: jest.fn(),
  getLiveYapeReviews: jest.fn(),
  reviewLiveYapePayment: jest.fn(),
  uploadLiveYapeProof: jest.fn(),
}));
const id = "1042cd44-14dd-47e3-9503-ce24f6090853";
const second = "dc94e9b1-2439-4f75-a458-f83d2a740013";
const snapshot: LiveCheckoutSnapshot = {
  checkoutId: id,
  status: "PENDING",
  method: "yape",
  quote: { quoteId: id, expiresAt: "2026-10-21T12:00:00Z", subtotal: 69, shipping: 8, total: 77 },
  customer: { name: "Cliente de prueba", phone: "987654321" },
  manualPayment: {
    status: "AWAITING_PROOF",
    phone: "912345678",
    holder: "Negocio de prueba",
    proofDeadlineAt: "2026-10-21T12:00:00Z",
    reviewDeadlineAt: null,
  },
};
const reviewing: LiveYapeReview = {
  ...snapshot,
  quote: { quoteId: id, expiresAt: "2026-10-21T12:00:00Z", subtotal: 69, shipping: 8, total: 77 },
  customer: { name: "Cliente de prueba", phone: "987654321" },
  createdAt: "2026-10-20T12:00:00Z",
  manualPayment: {
    phone: "912345678",
    holder: "Negocio de prueba",
    proofDeadlineAt: "2026-10-21T12:00:00Z",
    status: "UNDER_REVIEW",
    operationNumber: "01234567",
    reviewDeadlineAt: "2026-10-21T12:00:00Z",
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => second),
  });
  (getLiveYapeReviews as jest.Mock).mockResolvedValue({
    reviews: [reviewing],
    serverNow: "2026-10-20T12:00:00Z",
  });
  (getLiveYapeReviewProof as jest.Mock).mockResolvedValue({
    url: "https://example.test/private-proof.png",
    expiresAt: "2026-10-20T12:10:00Z",
  });
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue(snapshot);
  (getLiveYapeConfig as jest.Mock).mockResolvedValue({
    config: { enabled: false, phone: "", holder: "", qrUrl: null, reviewHours: 24 },
  });
});

test("proof submission remains under review and does not confirm delivery", async () => {
  (uploadLiveYapeProof as jest.Mock).mockImplementation(async () => {
    (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue(reviewing);
    return reviewing;
  });
  render(
    <LiveManualPaymentDialog
      storeId={id}
      visitor="visitor-a"
      checkoutId={id}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  await screen.findByText("Negocio de prueba");
  fireEvent.change(screen.getByLabelText("Número de operación Yape"), {
    target: { value: "01234567" },
  });
  fireEvent.change(screen.getByLabelText("Comprobante de Yape"), {
    target: {
      files: [new File([new Uint8Array([137, 80, 78, 71])], "yape.png", { type: "image/png" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante para revisión" }));
  expect(
    await screen.findByRole("heading", { name: "Comprobante en revisión" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Pago validado por el negocio" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ver mis compras" })).not.toBeInTheDocument();
  expect((uploadLiveYapeProof as jest.Mock).mock.calls[0].slice(0, 3)).toEqual([
    id,
    "visitor-a",
    id,
  ]);
});

test("approved payment exposes only the tracking link confirmed by the server", async () => {
  const trackingUrl = "https://courier.example.invalid/tracking/fixture";
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue({
    ...snapshot,
    status: "PAID",
    trackingUrl,
    manualPayment: { ...snapshot.manualPayment, status: "APPROVED" },
  });
  render(
    <LiveManualPaymentDialog
      storeId={id}
      visitor="visitor-a"
      checkoutId={id}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  expect(await screen.findByRole("link", { name: "Seguir pedido" })).toHaveAttribute(
    "href",
    trackingUrl,
  );
  expect(screen.getByText(/El negocio continuará con la entrega/)).toBeInTheDocument();
});

test("a cancelled paid order keeps the payment result but does not promise delivery", async () => {
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue({
    ...snapshot,
    status: "PAID",
    orderStatus: "ANULADO",
    manualPayment: { ...snapshot.manualPayment, status: "APPROVED" },
  });
  render(
    <LiveManualPaymentDialog
      storeId={id}
      visitor="visitor-a"
      checkoutId={id}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  expect(await screen.findByText("Pedido anulado")).toBeInTheDocument();
  expect(
    screen.getByText(/Contacta al negocio para coordinar el pago o la entrega/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/El negocio continuará con la entrega/)).not.toBeInTheDocument();
});

test("review customer conflicts do not appear as approval success", async () => {
  (reviewLiveYapePayment as jest.Mock).mockRejectedValue(
    Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: "CUSTOMER_REVIEW_REQUIRED", message: "private data" },
      },
    }),
  );
  render(<LiveYapeReviews storeId={id} canReview />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar y validar" }));
  await screen.findByAltText("Comprobante Yape enviado por el cliente");
  fireEvent.change(screen.getByLabelText("Número de operación verificado en Yape"), {
    target: { value: "01234567" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Validar pago y confirmar pedido" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/no apruebes otro pago/);
  expect(
    screen.queryByText("Pago validado. El pedido fue confirmado por el servidor."),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("private data")).not.toBeInTheDocument();
});

test("changing visitor/checkout clears selected file and operation", async () => {
  const { rerender } = render(
    <LiveManualPaymentDialog
      key="a"
      storeId={id}
      visitor="visitor-a"
      checkoutId={id}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  await screen.findByText("Negocio de prueba");
  fireEvent.change(screen.getByLabelText("Número de operación Yape"), {
    target: { value: "01234567" },
  });
  fireEvent.change(screen.getByLabelText("Comprobante de Yape"), {
    target: { files: [new File(["png"], "yape.png", { type: "image/png" })] },
  });
  expect(screen.getByRole("button", { name: "Enviar comprobante para revisión" })).toBeEnabled();
  rerender(
    <LiveManualPaymentDialog
      key="b"
      storeId={second}
      visitor="visitor-b"
      checkoutId={second}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  await screen.findByText("Negocio de prueba");
  expect(screen.getByLabelText("Número de operación Yape")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Enviar comprobante para revisión" })).toBeDisabled();
  expect(uploadLiveYapeProof).not.toHaveBeenCalled();
});

test("financial approval needs proof, verified operation and confirmation; duplicate clicks send once", async () => {
  const decision = deferred<LiveCheckoutSnapshot>();
  (reviewLiveYapePayment as jest.Mock).mockReturnValue(decision.promise);
  render(<LiveYapeReviews storeId={id} canReview />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar y validar" }));
  await screen.findByAltText("Comprobante Yape enviado por el cliente");
  const button = screen.getByRole("button", { name: "Validar pago y confirmar pedido" });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Número de operación verificado en Yape"), {
    target: { value: "01234567" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(reviewLiveYapePayment).toHaveBeenCalledTimes(1));
  expect((reviewLiveYapePayment as jest.Mock).mock.calls[0]).toEqual([
    id,
    id,
    "approve",
    { operationNumber: "01234567", idempotencyKey: second },
  ]);
  await act(async () => {
    decision.resolve({ ...reviewing, status: "PAID" });
  });
});

test("late financial list response from previous store cannot replace current store", async () => {
  const old = deferred<{ reviews: LiveYapeReview[]; serverNow: string }>();
  (getLiveYapeReviews as jest.Mock).mockImplementation((storeId: string) =>
    storeId === id
      ? old.promise
      : Promise.resolve({
          reviews: [
            {
              ...reviewing,
              checkoutId: second,
              customer: { name: "Cliente tienda nueva", phone: "912345678" },
            },
          ],
          serverNow: "2026-10-20T12:00:00Z",
        }),
  );
  const { rerender } = render(<LiveYapeReviews storeId={id} canReview />);
  rerender(<LiveYapeReviews storeId={second} canReview />);
  await screen.findByText("Cliente tienda nueva");
  await act(async () => {
    old.resolve({ reviews: [reviewing], serverNow: "2026-10-20T12:00:00Z" });
  });
  expect(screen.getByText("Cliente tienda nueva")).toBeInTheDocument();
  expect(screen.queryByText("Cliente de prueba")).not.toBeInTheDocument();
});

test("Yape settings expose manual account configuration without a payment processor", async () => {
  render(<LivePaymentSettings storeId={id} canManage />);
  expect(await screen.findByLabelText("Número Yape")).toBeInTheDocument();
  expect(screen.queryByText("Mercado Pago")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Contraseña/i)).not.toBeInTheDocument();
});

test("settings discard a late response from the previous store", async () => {
  const oldYape = deferred<{
    config: { enabled: boolean; phone: string; holder: string; qrUrl: null; reviewHours: number };
  }>();
  (getLiveYapeConfig as jest.Mock).mockImplementation((storeId: string) =>
    storeId === id
      ? oldYape.promise
      : Promise.resolve({
          config: {
            enabled: true,
            phone: "912345678",
            holder: "Titular tienda nueva",
            qrUrl: null,
            reviewHours: 24,
          },
        }),
  );
  const { rerender } = render(<LivePaymentSettings storeId={id} canManage />);
  rerender(<LivePaymentSettings storeId={second} canManage />);
  await screen.findByDisplayValue("Titular tienda nueva");
  await act(async () => {
    oldYape.resolve({
      config: {
        enabled: true,
        phone: "987654321",
        holder: "Titular anterior",
        qrUrl: null,
        reviewHours: 24,
      },
    });
  });
  expect(screen.getByDisplayValue("Titular tienda nueva")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("Titular anterior")).not.toBeInTheDocument();
});

test("review controls are unavailable without financial capability", () => {
  render(<LiveYapeReviews storeId={id} canReview={false} />);
  expect(screen.getByText(/rol Administrador vigente/)).toBeInTheDocument();
  expect(getLiveYapeReviews).not.toHaveBeenCalled();
});

test("missing server amount never becomes a zero-sol Yape instruction", async () => {
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue({ ...snapshot, quote: undefined });
  render(
    <LiveManualPaymentDialog
      storeId={id}
      visitor="visitor-a"
      checkoutId={id}
      onClose={jest.fn()}
      onUpdated={jest.fn()}
    />,
  );
  expect(await screen.findByText(/No pudimos confirmar el monto/)).toBeInTheDocument();
  expect(screen.queryByText("Monto exacto a yapear")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Enviar comprobante para revisión" }),
  ).not.toBeInTheDocument();
});
