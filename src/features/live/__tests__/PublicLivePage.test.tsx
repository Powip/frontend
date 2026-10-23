import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  checkoutLivePurchase,
  getLiveCheckoutSnapshot,
  getPublicLive,
  quoteLivePurchase,
  reserveLiveProduct,
} from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LiveCheckoutSnapshot, LivePublicData, LiveQuote } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  quoteLivePurchase: jest.fn(),
  checkoutLivePurchase: jest.fn(),
  getLiveCheckoutSnapshot: jest.fn(),
  liveVisitorToken: jest.fn(() => "1042cd44-14dd-47e3-9503-ce24f6090853"),
}));
configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(20000);
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
    combineShipping: false,
    homeShipping: 8,
    agencyShipping: null,
    reminderEnabled: false,
    showBackLink: false,
    allowSellerLive: false,
    closePolicy: "MANUAL",
    liveUrl: "",
  },
  session: { id: storeId, status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
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
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
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
  expect(screen.getByRole("button", { name: "Comprar ahora" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Apartar" })).toBeEnabled();
  expect(screen.getByText(/El pago con Yape aún no está disponible/)).toBeInTheDocument();
});
test("return query does not claim paid order without verified server response", async () => {
  window.history.replaceState(null, "", `/live/${storeId}?payment_status=approved&payment_id=123`);
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  expect(screen.queryByText("Pago verificado")).not.toBeInTheDocument();
});

test("a trusted-customer flag does not advertise accumulation when the store does not offer it", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    isTrusted: true,
    config: { ...data.config, allowAccumulation: false },
  });
  render(<PublicLivePage storeId={storeId} />);
  expect(await screen.findByRole("button", { name: "Apartar" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Acumular" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Acumula sin vencimiento/)).not.toBeInTheDocument();
});

test("checkout offers only delivery methods with an explicit tariff, including free shipping", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    paymentMethods: ["yape"],
    deliveryMethods: ["AGENCY"],
    config: { ...data.config, homeShipping: null, agencyShipping: 0 },
  });
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  fireEvent.click(screen.getByRole("button", { name: "Comprar ahora" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.queryByRole("button", { name: "Domicilio" })).not.toBeInTheDocument();
  expect(dialog.getByRole("button", { name: "Agencia" })).toBeEnabled();
  expect(dialog.getByLabelText("Dirección de la agencia")).toBeInTheDocument();
});

test("missing shipping configuration explains the unavailable checkout instead of allowing a quote", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    paymentMethods: ["yape"],
    deliveryMethods: [],
    config: { ...data.config, homeShipping: null, agencyShipping: null },
  });
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  fireEvent.click(screen.getByRole("button", { name: "Comprar ahora" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText(/habilitar una modalidad de entrega/)).toBeInTheDocument();
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeDisabled();
  expect(quoteLivePurchase).not.toHaveBeenCalled();
});
test("retries a failed reserve with same idempotency key", async () => {
  (reserveLiveProduct as jest.Mock)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ reservation: {} });
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Torres" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Apartar" }));
  expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Apartar" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Apartar" }));
  await waitFor(() => expect(reserveLiveProduct).toHaveBeenCalledTimes(2));
  const calls = (reserveLiveProduct as jest.Mock).mock.calls;
  expect(calls[0][2].idempotencyKey).toBe(calls[1][2].idempotencyKey);
  expect(calls[0][2].customer.phone).toBe("987654321");
});

const acceptedQuote: LiveQuote = {
  quoteId: "b23178ed-6f1a-4d69-b052-4e463a67ea87",
  expiresAt: "2099-10-22T12:05:00Z",
  items: [
    { variantId: storeId, name: "Crema Centella", sku: "CREMA-1", quantity: 1, unitPrice: 20 },
  ],
  subtotal: 20,
  shipping: 8,
  total: 28,
};
const manualCheckout: LiveCheckoutSnapshot = {
  checkoutId: "10af55e7-a133-48f6-b969-39e72ec0985d",
  method: "yape",
  status: "PENDING",
  quote: acceptedQuote,
  manualPayment: {
    status: "AWAITING_PROOF",
    phone: "912345678",
    holder: "Titular de prueba",
    proofDeadlineAt: "2099-10-22T13:00:00Z",
    reviewDeadlineAt: null,
  },
};
async function openCheckoutForm(config: Partial<LivePublicData["config"]> = {}) {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    config: { ...data.config, ...config },
    paymentMethods: ["yape"],
  });
  (quoteLivePurchase as jest.Mock).mockResolvedValue(acceptedQuote);
  (getLiveCheckoutSnapshot as jest.Mock).mockResolvedValue(manualCheckout);
  render(<PublicLivePage storeId={storeId} />);
  await screen.findByText("Crema Centella");
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Torres" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Comprar ahora" }));
  const dialog = within(screen.getByRole("dialog"));
  return dialog;
}
async function selectLocation(dialog: ReturnType<typeof within>, index: number, value: string) {
  const select = dialog.getByRole("combobox", {
    name: ["Departamento", "Provincia", "Distrito"][index],
    exact: true,
  });
  expect(select).toBeEnabled();
  fireEvent.change(select, { target: { value } });
  expect(select).toHaveValue(value);
}
async function completeCheckoutDetails(dialog: ReturnType<typeof within>) {
  await selectLocation(dialog, 0, "Arequipa");
  await selectLocation(dialog, 1, "Arequipa");
  await selectLocation(dialog, 2, "Cayma");
  fireEvent.change(dialog.getByLabelText("Dirección"), {
    target: { value: "Dirección de prueba 123" },
  });
  fireEvent.change(dialog.getByLabelText(/^DNI del comprador/), { target: { value: "46789123" } });
}
async function openQuotedCheckout() {
  const dialog = await openCheckoutForm();
  await completeCheckoutDetails(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Calcular total" }));
  await dialog.findByRole("button", { name: /Ver instrucciones Yape/ });
  return dialog;
}

test("invoice accepts only the server's 3–150 character business name contract", async () => {
  const dialog = await openCheckoutForm();
  await completeCheckoutDetails(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Factura (RUC)" }));
  fireEvent.change(dialog.getByLabelText("RUC"), { target: { value: "20123456789" } });
  const business = dialog.getByLabelText("Razón social");
  expect(business).toHaveAttribute("minLength", "3");
  expect(business).toHaveAttribute("maxLength", "150");
  fireEvent.change(business, { target: { value: "AB" } });
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeDisabled();
  fireEvent.change(business, { target: { value: "A".repeat(151) } });
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeDisabled();
  fireEvent.change(business, { target: { value: "Empresa de prueba" } });
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeEnabled();
});

test("customer conflict stops before checkout and shows a safe contact-the-business message", async () => {
  const dialog = await openCheckoutForm();
  await completeCheckoutDetails(dialog);
  (quoteLivePurchase as jest.Mock).mockRejectedValue(
    Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: "CUSTOMER_REVIEW_REQUIRED", message: "private server detail" },
      },
    }),
  );
  fireEvent.click(dialog.getByRole("button", { name: "Calcular total" }));
  expect(await dialog.findByRole("alert")).toHaveTextContent(/Contacta al negocio antes de pagar/);
  expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("checkout sends the accepted quote and a duplicate click does not start another payment", async () => {
  (checkoutLivePurchase as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const dialog = await openQuotedCheckout();
  const confirm = dialog.getByRole("button", { name: /Ver instrucciones Yape/ });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
  expect((checkoutLivePurchase as jest.Mock).mock.calls[0][2]).toMatchObject({
    quoteId: acceptedQuote.quoteId,
    method: "yape",
    items: [{ variantId: storeId, quantity: 1 }],
    delivery: {
      type: "HOME",
      department: "Arequipa",
      province: "Arequipa",
      district: "Cayma",
      address: "Dirección de prueba 123",
    },
    receipt: { type: "BOLETA", dni: "46789123" },
  });
});

test.each(["PRICE_CHANGED", "QUOTE_EXPIRED", "QUOTE_MISMATCH"])(
  "%s requotes and waits for a new acceptance",
  async (code) => {
    (checkoutLivePurchase as jest.Mock)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { code, message: "Revisa la cotización" } },
      })
      .mockResolvedValue(manualCheckout);
    const dialog = await openQuotedCheckout();
    const updated = {
      ...acceptedQuote,
      quoteId: "227b49b3-07e9-487d-967c-288a14577826",
      shipping: 10,
      total: 30,
    };
    (quoteLivePurchase as jest.Mock).mockResolvedValue(updated);
    fireEvent.click(dialog.getByRole("button", { name: /Ver instrucciones Yape/ }));
    await dialog.findByText(/Revisa el total actualizado y vuelve a confirmar/);
    expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
    expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
    const confirm = dialog.getByRole("button", { name: /Ver instrucciones Yape/ });
    expect(confirm).toHaveTextContent("30.00");
    fireEvent.click(confirm);
    await waitFor(() => expect(checkoutLivePurchase).toHaveBeenCalledTimes(2));
    expect((checkoutLivePurchase as jest.Mock).mock.calls[1][2].quoteId).toBe(updated.quoteId);
    await screen.findByText("Titular de prueba");
  },
);

test("an unconfigured shipping price blocks checkout and shows the server explanation", async () => {
  const dialog = await openQuotedCheckout();
  fireEvent.change(dialog.getByLabelText("Dirección"), { target: { value: "Otra dirección 456" } });
  (quoteLivePurchase as jest.Mock).mockRejectedValue({
    isAxiosError: true,
    response: {
      status: 503,
      data: {
        code: "SHIPPING_NOT_CONFIGURED",
        message: "El negocio aún no configuró el envío a domicilio.",
      },
    },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Calcular total" }));
  expect(
    await dialog.findByText("El negocio aún no configuró el envío a domicilio."),
  ).toBeInTheDocument();
  expect(dialog.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("quote requires a selected hierarchy, a real address and a valid DNI before any payment starts", async () => {
  const dialog = await openCheckoutForm();
  const calculate = dialog.getByRole("button", { name: "Calcular total" });
  expect(calculate).toBeDisabled();
  expect(dialog.getByRole("combobox", { name: "Departamento", exact: true })).toHaveValue("");
  expect(dialog.getAllByRole("combobox")[1]).toBeDisabled();
  expect(dialog.getAllByRole("combobox")[2]).toBeDisabled();
  await completeCheckoutDetails(dialog);
  for (const dni of ["", "12345678", "87654321", "00000000", "11111111", "4678912"]) {
    fireEvent.change(dialog.getByLabelText(/^DNI del comprador/), { target: { value: dni } });
    expect(calculate).toBeDisabled();
    fireEvent.click(calculate);
  }
  fireEvent.change(dialog.getByLabelText(/^DNI del comprador/), { target: { value: "46789123" } });
  fireEvent.change(dialog.getByLabelText("Nombre"), { target: { value: "Al" } });
  expect(calculate).toBeDisabled();
  expect(quoteLivePurchase).not.toHaveBeenCalled();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("changing a department clears province and district and invalidates the accepted quote", async () => {
  const dialog = await openQuotedCheckout();
  await selectLocation(dialog, 0, "Cusco");
  expect(dialog.getByRole("combobox", { name: "Provincia", exact: true })).toHaveValue("");
  expect(dialog.getByRole("combobox", { name: "Distrito", exact: true })).toHaveValue("");
  expect(dialog.getAllByRole("combobox")[2]).toBeDisabled();
  expect(dialog.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeDisabled();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("agency delivery requires its branch name and street address and preserves the selected geography", async () => {
  const dialog = await openCheckoutForm({ agencyShipping: 11 });
  await completeCheckoutDetails(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Agencia", exact: true }));
  const calculate = dialog.getByRole("button", { name: "Calcular total" });
  expect(calculate).toBeDisabled();
  fireEvent.change(dialog.getByLabelText("Agencia y sucursal"), {
    target: { value: "Shalom Cayma" },
  });
  fireEvent.change(dialog.getByLabelText("Dirección de la agencia"), { target: { value: "" } });
  expect(calculate).toBeDisabled();
  fireEvent.change(dialog.getByLabelText("Dirección de la agencia"), {
    target: { value: "Av. Ejército 456" },
  });
  fireEvent.click(calculate);
  await dialog.findByRole("button", { name: /Ver instrucciones Yape/ });
  expect((quoteLivePurchase as jest.Mock).mock.calls[0][2].delivery).toEqual({
    type: "AGENCY",
    department: "Arequipa",
    province: "Arequipa",
    district: "Cayma",
    address: "Av. Ejército 456",
    agency: "Shalom Cayma",
  });
});

test("factura requires RUC and business name instead of omitting the buyer document", async () => {
  const dialog = await openCheckoutForm();
  await completeCheckoutDetails(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Factura (RUC)" }));
  const calculate = dialog.getByRole("button", { name: "Calcular total" });
  expect(calculate).toBeDisabled();
  fireEvent.change(dialog.getByLabelText("RUC"), { target: { value: "20654321987" } });
  fireEvent.change(dialog.getByLabelText("Razón social"), {
    target: { value: "Negocio de prueba SAC" },
  });
  fireEvent.click(calculate);
  await dialog.findByRole("button", { name: /Ver instrucciones Yape/ });
  expect((quoteLivePurchase as jest.Mock).mock.calls[0][2].receipt).toEqual({
    type: "FACTURA",
    ruc: "20654321987",
    businessName: "Negocio de prueba SAC",
  });
});
