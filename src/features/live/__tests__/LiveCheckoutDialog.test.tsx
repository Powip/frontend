import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import LiveCheckoutDialog, { type LiveCheckoutDraft } from "../LiveCheckoutDialog";
import { checkoutLivePurchase, quoteLivePurchase } from "../liveService";
import type { LiveCustomer, LivePublicData, LiveQuote } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  quoteLivePurchase: jest.fn(),
  checkoutLivePurchase: jest.fn(),
}));
jest.mock("../LiveManualPaymentDialog", () => ({
  __esModule: true,
  default: () => (
    <div role="dialog" aria-label="Instrucciones Yape">
      Instrucciones de pago
    </div>
  ),
}));
const storeId = "store-one";
const customer: LiveCustomer = { name: "María Torres", phone: "987654321" };
const draft: LiveCheckoutDraft = {
  delivery: {
    type: "HOME",
    department: "Lima",
    province: "Lima",
    district: "Lima",
    address: "Av. Prueba 123",
    agency: "",
  },
  receipt: { type: "BOLETA", dni: "71829364" },
};
const data: LivePublicData = {
  store: { id: storeId, name: "Negocio" },
  config: {
    enabled: true,
    allowBuyNow: true,
    allowReservations: true,
    reservationMinutes: 15,
    maxReservedUnits: 5,
    allowAccumulation: true,
    combineShipping: false,
    homeShipping: 8,
    agencyShipping: 12,
    reminderEnabled: false,
    showBackLink: false,
    allowSellerLive: false,
    closePolicy: "MANUAL",
    liveUrl: "",
  },
  session: { id: "session", status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
  products: [
    {
      variantId: "variant-one",
      name: "Zapatilla",
      sku: "ZAP-41-N",
      variantLabel: "Negro · 41",
      regularPrice: 30,
      livePrice: 20,
      availableStock: 2,
      maxPerCustomer: 2,
      enabled: true,
    },
  ],
  reservations: [],
  isTrusted: false,
  paymentMethods: ["yape"],
  serverNow: new Date().toISOString(),
};
const selection = { items: [{ variantId: "variant-one", quantity: 1 }] };
function quote(overrides: Partial<LiveQuote> = {}): LiveQuote {
  return {
    quoteId: "quote-one",
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    items: [
      { variantId: "variant-one", name: "Zapatilla", sku: "ZAP-41-N", quantity: 1, unitPrice: 21 },
    ],
    subtotal: 21,
    shipping: 8,
    total: 29,
    ...overrides,
  };
}
function renderCheckout(
  options: {
    initialDraft?: LiveCheckoutDraft;
    buyer?: LiveCustomer;
    onDraftChange?: (draft: LiveCheckoutDraft) => void;
    store?: string;
    publicData?: LivePublicData;
    selection?: { items: { variantId: string; quantity: number }[]; reservationIds?: string[] };
  } = {},
) {
  const onUpdated = jest.fn();
  const onClose = jest.fn();
  function Harness({ store = options.store ?? storeId }: { store?: string }) {
    const [buyer, setBuyer] = useState(options.buyer ?? customer);
    return (
      <LiveCheckoutDialog
        storeId={store}
        visitor="visitor"
        data={options.publicData ?? data}
        selection={options.selection ?? selection}
        customer={buyer}
        onCustomerChange={setBuyer}
        onClose={onClose}
        onUpdated={onUpdated}
        initialDraft={options.initialDraft}
        onDraftChange={options.onDraftChange}
      />
    );
  }
  const result = render(<Harness />);
  return { ...result, onUpdated, onClose, Harness };
}
beforeEach(() => {
  jest.clearAllMocks();
  (quoteLivePurchase as jest.Mock).mockReset();
  (checkoutLivePurchase as jest.Mock).mockReset();
  (quoteLivePurchase as jest.Mock).mockImplementation(() => Promise.resolve(quote()));
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "attempt-one"),
  });
});
afterEach(() => jest.useRealTimers());

test("explains the disabled action and focuses the first missing field with linked feedback", () => {
  renderCheckout({ buyer: { name: "", phone: "" } });
  const action = screen.getByRole("button", { name: "Ver total con envío" });
  expect(action).toBeDisabled();
  expect(action).toHaveAccessibleDescription(/Completa tus datos/);
  fireEvent.click(screen.getByRole("button", { name: "Revisar datos" }));
  const name = screen.getByRole("textbox", { name: /^Nombre/ });
  expect(name).toHaveFocus();
  expect(name).toHaveAttribute("aria-invalid", "true");
  expect(name).toHaveAccessibleDescription("Ingresa un nombre de 3 a 120 caracteres.");
  expect(quoteLivePurchase).not.toHaveBeenCalled();
});

test("shows variants and SKU, native option semantics, and a single informational Yape method", () => {
  renderCheckout({ initialDraft: draft });
  expect(screen.getByText("Negro · 41")).toBeInTheDocument();
  expect(screen.getByText("SKU: ZAP-41-N")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Domicilio" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Boleta" })).toBeChecked();
  expect(screen.queryByRole("button", { name: /Yape · comprobante/ })).not.toBeInTheDocument();
  expect(screen.getByText("Yape · comprobante")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Agencia" }));
  expect(screen.getByRole("radio", { name: "Agencia" })).toBeChecked();
  expect(screen.getByLabelText("Agencia y sucursal")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ver total con envío" })).toBeDisabled();
});

test("keeps a quote failure visible and focused by the action while retaining entered data", async () => {
  (quoteLivePurchase as jest.Mock).mockRejectedValueOnce(
    new Error("No se pudo calcular. Reintenta."),
  );
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("No se pudo calcular. Reintenta.");
  expect(error).toHaveFocus();
  expect(screen.getByLabelText("Dirección")).toHaveValue("Av. Prueba 123");
  expect(screen.getByLabelText("DNI del comprador")).toHaveValue("71829364");
  expect(screen.getByRole("button", { name: "Reintentar total con envío" })).toBeEnabled();
});

const reviewConflict = () =>
  Object.assign(new Error("review"), {
    isAxiosError: true,
    response: {
      status: 409,
      data: { code: "CUSTOMER_REVIEW_REQUIRED", message: "PRIVATE_STORED_CUSTOMER_DETAIL" },
    },
  });

test("a customer review explains what to check and lets the buyer correct the same held purchase", async () => {
  const heldSelection = { items: [], reservationIds: ["held-one"] };
  const heldData: LivePublicData = {
    ...data,
    customer,
    reservations: [
      {
        id: "held-one",
        variantId: "variant-one",
        customer,
        quantity: 2,
        unitPrice: 20,
        status: "ACTIVE",
        type: "TIMED",
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        createdAt: data.serverNow,
      },
    ],
  };
  (quoteLivePurchase as jest.Mock).mockRejectedValueOnce(reviewConflict());
  const onDraftChange = jest.fn();
  renderCheckout({
    initialDraft: draft,
    publicData: heldData,
    selection: heldSelection,
    onDraftChange,
  });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  const error = await screen.findByRole("alert");
  expect(error).toHaveFocus();
  expect(error).toHaveTextContent(/nombre completo o razón social, WhatsApp y DNI\/RUC/);
  expect(error).toHaveTextContent(/mismo comprador/);
  expect(error).toHaveTextContent(/vuelve a intentar/);
  expect(screen.queryByText("PRIVATE_STORED_CUSTOMER_DETAIL")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Dirección")).toHaveValue(draft.delivery.address);
  expect(screen.getByLabelText("DNI del comprador")).toHaveValue("71829364");
  expect(screen.getByLabelText("WhatsApp")).toHaveAttribute("readOnly");
  expect(screen.getByText(/Este WhatsApp está vinculado a tus apartados/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Revisar datos del comprador" }));
  const name = screen.getByRole("textbox", { name: /^Nombre/ });
  expect(name).toHaveFocus();
  fireEvent.change(name, { target: { value: "María Torres García" } });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  expect(await screen.findByRole("button", { name: /Ver instrucciones Yape/ })).toBeEnabled();
  expect((quoteLivePurchase as jest.Mock).mock.calls[1][2]).toMatchObject({
    ...heldSelection,
    ...draft,
    customer: { ...customer, name: "María Torres García" },
  });
  expect(heldData.reservations[0]).toMatchObject({ id: "held-one", quantity: 2, status: "ACTIVE" });
  expect(onDraftChange).toHaveBeenLastCalledWith(draft);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("customer review at confirmation invalidates the accepted total without dropping the draft", async () => {
  (checkoutLivePurchase as jest.Mock).mockRejectedValueOnce(reviewConflict());
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  fireEvent.click(await screen.findByRole("button", { name: /Ver instrucciones Yape/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/mismo comprador/);
  expect(screen.getByRole("button", { name: "Reintentar total con envío" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Dirección")).toHaveValue(draft.delivery.address);
  expect(screen.getByLabelText("DNI del comprador")).toHaveValue("71829364");
  expect(screen.queryByRole("dialog", { name: "Instrucciones Yape" })).not.toBeInTheDocument();
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
});

test("an explicit total preview uses the server amount without starting payment automatically", async () => {
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  expect(
    await screen.findByRole("button", { name: /Ver instrucciones Yape · S\/\s*29/ }),
  ).toBeEnabled();
  expect(screen.getByText(/Total válido hasta/)).toBeInTheDocument();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
  expect(quoteLivePurchase).toHaveBeenCalledWith(storeId, "visitor", {
    ...selection,
    customer,
    ...draft,
  });
});

test("automatically confirms the total with shipping after the completed form settles", async () => {
  jest.useFakeTimers();
  renderCheckout({ initialDraft: draft });
  await act(async () => jest.advanceTimersByTime(599));
  expect(quoteLivePurchase).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape · S\/\s*29/ })).toBeEnabled();
  expect(screen.getByText("Total con envío")).toBeInTheDocument();
  expect(quoteLivePurchase).toHaveBeenCalledTimes(1);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("previewing just before the automatic timer fires only requests one total", async () => {
  jest.useFakeTimers();
  renderCheckout({ initialDraft: draft });
  await act(async () => jest.advanceTimersByTime(599));
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  await act(async () => jest.advanceTimersByTime(1_000));
  expect(quoteLivePurchase).toHaveBeenCalledTimes(1);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("an incomplete form never requests a total and rapid edits only quote the final draft", async () => {
  jest.useFakeTimers();
  renderCheckout({ initialDraft: { ...draft, receipt: { type: "BOLETA", dni: "" } } });
  await act(async () => jest.advanceTimersByTime(1_000));
  expect(quoteLivePurchase).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("DNI del comprador"), { target: { value: "71829364" } });
  await act(async () => jest.advanceTimersByTime(400));
  fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Av. Nueva 456" } });
  await act(async () => jest.advanceTimersByTime(400));
  expect(quoteLivePurchase).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(200));
  expect(quoteLivePurchase).toHaveBeenCalledTimes(1);
  expect((quoteLivePurchase as jest.Mock).mock.calls[0][2].delivery.address).toBe("Av. Nueva 456");
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("editing during a pending total stays possible and late responses cannot replace the latest total", async () => {
  jest.useFakeTimers();
  let resolveFirst!: (value: LiveQuote) => void;
  (quoteLivePurchase as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce(quote({ quoteId: "latest-quote", total: 44 }));
  renderCheckout({ initialDraft: draft });
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole("button", { name: "Confirmando total…" })).toBeDisabled();
  const address = screen.getByLabelText("Dirección");
  expect(address).toBeEnabled();
  fireEvent.change(address, { target: { value: "Av. Nueva 456" } });
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape · S\/\s*44/ })).toBeEnabled();
  await act(async () => resolveFirst(quote({ total: 99 })));
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape · S\/\s*44/ })).toBeEnabled();
  expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("automatic total failure waits for a correction or an explicit retry", async () => {
  jest.useFakeTimers();
  (quoteLivePurchase as jest.Mock).mockRejectedValueOnce(new Error("Sin conexión"));
  renderCheckout({ initialDraft: draft });
  const address = screen.getByLabelText("Dirección");
  address.focus();
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole("alert")).toHaveTextContent("Sin conexión");
  expect(address).toHaveFocus();
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(quoteLivePurchase).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("delivery review identifies the delivery issue and focuses its address without exposing stored data", async () => {
  jest.useFakeTimers();
  (quoteLivePurchase as jest.Mock).mockRejectedValueOnce({
    isAxiosError: true,
    response: {
      status: 409,
      data: { code: "DELIVERY_REVIEW_REQUIRED", message: "PRIVATE_ADDRESS" },
    },
  });
  renderCheckout({ initialDraft: draft });
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.getByRole("alert")).toHaveTextContent(/dirección de entrega no coincide/);
  expect(screen.getByRole("alert")).toHaveTextContent(/contacta al negocio/);
  expect(screen.queryByText("PRIVATE_ADDRESS")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Revisar dirección de entrega" }));
  const address = screen.getByLabelText("Dirección");
  expect(address).toHaveFocus();
  expect(address).toHaveValue(draft.delivery.address);
  fireEvent.change(address, { target: { value: "Av. Corregida 789" } });
  await act(async () => jest.advanceTimersByTime(600));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape/ })).toBeEnabled();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("expires the accepted total locally and requires refresh plus a new confirmation", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-28T15:00:00.000Z"));
  (quoteLivePurchase as jest.Mock)
    .mockResolvedValueOnce(quote({ expiresAt: new Date(Date.now() + 1_000).toISOString() }))
    .mockImplementation(() => Promise.resolve(quote({ quoteId: "quote-two", total: 31 })));
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  act(() => jest.advanceTimersByTime(1_001));
  expect(screen.getByText(/El total venció/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar total" }));
  expect(
    await screen.findByRole("button", { name: /Ver instrucciones Yape · S\/\s*31/ }),
  ).toBeEnabled();
  expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("changing delivery invalidates the accepted total and only delivery and receipt enter the draft", async () => {
  const onDraftChange = jest.fn();
  renderCheckout({ initialDraft: draft, onDraftChange });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Otra dirección 456" } });
  expect(screen.getByRole("button", { name: "Ver total con envío" })).toBeEnabled();
  expect(screen.getByText(/Cambiaste los datos/)).toBeInTheDocument();
  const saved = onDraftChange.mock.calls.at(-1)?.[0];
  expect(saved).toEqual({
    delivery: { ...draft.delivery, address: "Otra dirección 456" },
    receipt: draft.receipt,
  });
  expect(Object.keys(saved).sort()).toEqual(["delivery", "receipt"]);
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});

test("reopening restores the delivery draft but never an accepted quote", async () => {
  let savedDraft: LiveCheckoutDraft = draft;
  const first = renderCheckout({
    initialDraft: draft,
    onDraftChange: (value) => {
      savedDraft = value;
    },
  });
  fireEvent.change(screen.getByLabelText("Dirección"), {
    target: { value: "Nueva dirección 456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  first.unmount();
  renderCheckout({ initialDraft: savedDraft });
  expect(screen.getByLabelText("Dirección")).toHaveValue("Nueva dirección 456");
  expect(screen.getByRole("button", { name: "Ver total con envío" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
});

test("refreshes a server conflict once and asks for a second confirmation instead of paying", async () => {
  (checkoutLivePurchase as jest.Mock).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 409, data: { code: "PRICE_CHANGED" } },
  });
  (quoteLivePurchase as jest.Mock)
    .mockResolvedValueOnce(quote())
    .mockResolvedValueOnce(quote({ quoteId: "quote-two", total: 32 }));
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  fireEvent.click(await screen.findByRole("button", { name: /Ver instrucciones Yape/ }));
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent(/Revisa el total actualizado y vuelve a confirmar/);
  expect(error).toHaveFocus();
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape · S\/\s*32/ })).toBeEnabled();
  expect(quoteLivePurchase).toHaveBeenCalledTimes(2);
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
});

test("reuses idempotency for identical retries and prevents double submission while pending", async () => {
  let rejectCheckout!: (cause: Error) => void;
  (checkoutLivePurchase as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCheckout = reject;
        }),
    )
    .mockRejectedValueOnce(new Error("Sin conexión"));
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  const action = await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  fireEvent.click(action);
  fireEvent.click(action);
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(1);
  await act(async () => rejectCheckout(new Error("Sin conexión")));
  fireEvent.click(screen.getByRole("button", { name: /Ver instrucciones Yape/ }));
  await screen.findByRole("alert");
  expect(checkoutLivePurchase).toHaveBeenCalledTimes(2);
  const calls = (checkoutLivePurchase as jest.Mock).mock.calls;
  expect(calls[0][2].idempotencyKey).toBe(calls[1][2].idempotencyKey);
});

test("ignores a quote resolving after the store scope changes", async () => {
  let resolveQuote!: (value: LiveQuote) => void;
  (quoteLivePurchase as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveQuote = resolve;
      }),
  );
  const view = renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  view.rerender(<view.Harness store="store-two" />);
  await act(async () => resolveQuote(quote()));
  expect(screen.getByRole("button", { name: "Ver total con envío" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
  expect(view.onUpdated).not.toHaveBeenCalled();
});

test("a distant expiry does not overflow the browser timer and expire immediately", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-28T15:00:00.000Z"));
  const maximumTimeout = 2_147_483_647;
  (quoteLivePurchase as jest.Mock).mockResolvedValueOnce(
    quote({ expiresAt: new Date(Date.now() + maximumTimeout + 1_000).toISOString() }),
  );
  renderCheckout({ initialDraft: draft });
  fireEvent.click(screen.getByRole("button", { name: "Ver total con envío" }));
  await screen.findByRole("button", { name: /Ver instrucciones Yape/ });
  act(() => jest.advanceTimersByTime(1_000));
  expect(screen.getByRole("button", { name: /Ver instrucciones Yape/ })).toBeEnabled();
  expect(checkoutLivePurchase).not.toHaveBeenCalled();
});
