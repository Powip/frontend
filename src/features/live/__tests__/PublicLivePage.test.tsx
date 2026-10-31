import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getPublicLive, reserveLiveProduct, identifyLiveCustomer } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LivePublicData } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  identifyLiveCustomer: jest.fn(),
  lookupLiveCustomer: jest.fn().mockResolvedValue({ known: false, name: null }),
  liveVisitorToken: jest.fn(() => "1042cd44-14dd-47e3-9503-ce24f6090853"),
}));
const storeId = "1042cd44-14dd-47e3-9503-ce24f6090853";
const data: LivePublicData = {
  store: { id: storeId, name: "Negocio de prueba" },
  config: {
    enabled: true,
    allowBuyNow: true,
    allowReservations: true,
    reservationMinutes: 15,
    maxReservedUnits: 5,
    allowAccumulation: true,
    combineShipping: true,
    reminderEnabled: false,
    showBackLink: false,
    allowSellerLive: false,
    closePolicy: "MANUAL",
    liveUrl: "",
  },
  session: {
    id: storeId,
    status: "LIVE",
    platform: "TIKTOK",
    pinnedVariantId: null,
  },
  products: [
    {
      variantId: storeId,
      name: "Crema Centella",
      sku: "CREMA-1",
      regularPrice: 25,
      livePrice: 20,
      availableStock: 2,
      maxPerCustomer: 2,
      enabled: true,
    },
  ],
  reservations: [],
  isTrusted: false,
  paymentMethods: [],
  serverNow: "2026-10-20T17:00:00.000Z",
};
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, "", `/live/${storeId}`);
  (getPublicLive as jest.Mock).mockResolvedValue(data);
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "dc94e9b1-2439-4f75-a458-f83d2a740013"),
  });
});
test("shows actual catalog and disables payment when store has no gateway", async () => {
  render(<PublicLivePage storeId={storeId} />);
  expect(await screen.findByText("Crema Centella")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Solo quiero mirar primero" }));
  expect(screen.queryByRole("button", { name: "Comprar ahora" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Separar ·/ })).toBeEnabled();
});
test("return query does not claim paid order without verified server response", async () => {
  window.history.replaceState(null, "", `/live/${storeId}?payment_status=approved&payment_id=123`);
  render(<PublicLivePage storeId={storeId} />);
  expect(await screen.findByText(/Estamos verificando el pago/)).toBeInTheDocument();
  expect(screen.queryByText("Pago verificado")).not.toBeInTheDocument();
});
test("retries a failed reserve with same idempotency key", async () => {
  (reserveLiveProduct as jest.Mock)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ reservation: {} });
  (identifyLiveCustomer as jest.Mock).mockResolvedValue({
    customer: { name: "María Torres", phone: "987654321" },
  });
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "987654321" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Torres" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar a comprar" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Entrar a comprar" })).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: /Separar ·/ }));
  expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: /Separar ·/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Separar ·/ }));
  await waitFor(() => expect(reserveLiveProduct).toHaveBeenCalledTimes(2));
  const calls = (reserveLiveProduct as jest.Mock).mock.calls;
  expect(calls[0][2].idempotencyKey).toBe(calls[1][2].idempotencyKey);
  expect(calls[0][2].customer.phone).toBe("987654321");
});
