import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveYapeReviews from "../LiveYapeReviews";
import {
  canReviewLivePayments,
  getLiveYapeReviewProof,
  getLiveYapeReviews,
  LIVE_PAYMENTS_HREF,
  reviewLiveYapePayment,
} from "../liveService";
import type { LiveYapeReview } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveYapeReviewProof: jest.fn(),
  getLiveYapeReviews: jest.fn(),
  reviewLiveYapePayment: jest.fn(),
}));

const storeId = "1042cd44-14dd-47e3-9503-ce24f6090853";
const orderId = "dc94e9b1-2439-4f75-a458-f83d2a740013";
const review: LiveYapeReview = {
  checkoutId: storeId,
  orderId,
  orderNumber: "ORD-153866",
  status: "PENDING",
  method: "yape",
  quote: { subtotal: 191, shipping: 8, total: 199 },
  customer: { name: "Rosa Quispe", phone: "987654321" },
  createdAt: "2026-11-24T12:00:00Z",
  manualPayment: {
    status: "UNDER_REVIEW",
    phone: "912345678",
    holder: "Kunca SAC",
    proofDeadlineAt: null,
    operationNumber: "01234567",
    reviewDeadlineAt: "2026-11-25T12:00:00Z",
    hasProof: false,
  },
};

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  (getLiveYapeReviews as jest.Mock).mockResolvedValue({
    reviews: [review],
    serverNow: "2026-11-24T12:00:00Z",
  });
  (getLiveYapeReviewProof as jest.Mock).mockResolvedValue({
    url: "https://proof.test/a.png",
  });
  (reviewLiveYapePayment as jest.Mock).mockResolvedValue({
    ...review,
    status: "PENDING",
  });
});

describe("who validates Live payments (FEAT-33 D4)", () => {
  test.each([
    [{ role: "ADMINISTRADOR", permissions: [] }, true],
    [{ role: " administrador ", permissions: [] }, true],
    [{ role: "FINANZAS", permissions: ["VIEW_FINANCES"] }, true],
    [{ role: "VENDEDOR", permissions: ["VIEW_SALES"] }, false],
    [undefined, false],
  ])("%p → %p", (user, allowed) => {
    expect(canReviewLivePayments(user)).toBe(allowed);
  });

  test("the queue lives in Finanzas, already filtered to POWIP Live y Link", () => {
    expect(LIVE_PAYMENTS_HREF).toBe("/finanzas?tab=pagos&origen=live");
  });

  test("without permission it says who can validate", () => {
    render(<LiveYapeReviews storeId={storeId} canReview={false} />);
    expect(
      screen.getByText(/rol Administrador o el permiso de Finanzas/),
    ).toBeInTheDocument();
    expect(getLiveYapeReviews).not.toHaveBeenCalled();
  });
});

describe("the order's Yape proof (FEAT-33 A9/B1)", () => {
  test("asks the server only for this order's proof", async () => {
    render(<LiveYapeReviews storeId={storeId} orderId={orderId} canReview />);
    await screen.findByText("Rosa Quispe");
    expect(getLiveYapeReviews).toHaveBeenCalledWith(
      storeId,
      expect.any(AbortSignal),
      orderId,
    );
    expect(
      screen.getByText(/mismo registro de Finanzas › Pagos por validar/),
    ).toBeInTheDocument();
  });

  test("still shows only this order if the server ignores the filter", async () => {
    (getLiveYapeReviews as jest.Mock).mockResolvedValue({
      reviews: [
        review,
        {
          ...review,
          checkoutId: "other",
          orderId: "another-order",
          customer: { name: "Otra Clienta", phone: "911111111" },
        },
      ],
      serverNow: "2026-11-24T12:00:00Z",
    });
    render(<LiveYapeReviews storeId={storeId} orderId={orderId} canReview />);
    await screen.findByText("Rosa Quispe");
    expect(screen.queryByText("Otra Clienta")).not.toBeInTheDocument();
  });

  test("a cancelled order shows its proof closed, without validation buttons", async () => {
    (getLiveYapeReviews as jest.Mock).mockResolvedValue({
      reviews: [
        {
          ...review,
          orderStatus: "ANULADO",
          buyerStatus: "CANCELLED",
          canReview: false,
        },
      ],
      serverNow: "2026-11-24T12:00:00Z",
    });
    render(<LiveYapeReviews storeId={storeId} orderId={orderId} canReview />);
    expect(
      await screen.findByText("Pedido anulado · comprobante cerrado"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revisar y validar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Plazo de revisión vencido/),
    ).not.toBeInTheDocument();
  });
});

describe("rejecting a proof with a reason the buyer understands (FEAT-33 A9/D7)", () => {
  const openReject = async () => {
    render(<LiveYapeReviews storeId={storeId} orderId={orderId} canReview />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rechazar comprobante" }),
    );
    return screen.getByLabelText("Motivo del rechazo");
  };

  test("offers the catalog and sends the chosen reason", async () => {
    const reason = await openReject();
    expect(
      Array.from((reason as HTMLSelectElement).options).map(
        (option) => option.text,
      ),
    ).toEqual([
      "No encontramos el ingreso",
      "El monto no coincide",
      "El número de operación ya se usó",
      "Otro",
    ]);
    fireEvent.change(reason, { target: { value: "El monto no coincide" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    await waitFor(() =>
      expect(reviewLiveYapePayment).toHaveBeenCalledWith(
        storeId,
        storeId,
        "reject",
        {
          reason: "El monto no coincide",
          idempotencyKey: expect.any(String),
        },
      ),
    );
  });

  test("«Otro» needs a few words for the buyer", async () => {
    const reason = await openReject();
    fireEvent.change(reason, { target: { value: "Otro" } });
    fireEvent.click(screen.getByRole("checkbox"));
    const confirm = screen.getByRole("button", { name: "Confirmar rechazo" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cuéntale al cliente qué pasó"), {
      target: { value: "La captura está cortada" },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(reviewLiveYapePayment).toHaveBeenCalledWith(
        storeId,
        storeId,
        "reject",
        {
          reason: "La captura está cortada",
          idempotencyKey: expect.any(String),
        },
      ),
    );
  });
});
