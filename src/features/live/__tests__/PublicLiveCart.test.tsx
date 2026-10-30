import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getPublicLive, removePublicLiveReservation, reserveLiveProduct } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LiveProduct, LivePublicData, LiveReservation } from "../types";

configure({ asyncUtilTimeout: 10000 });
jest.setTimeout(20000);

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  removePublicLiveReservation: jest.fn(),
  liveVisitorToken: jest.fn(() => "visitor-private"),
}));
jest.mock("../LiveCheckoutDialog", () => ({
  __esModule: true,
  default: ({
    selection,
    onCheckoutCreated,
    onClose,
  }: {
    selection: unknown;
    onCheckoutCreated: () => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Compra seleccionada">
      <output data-testid="checkout-selection">{JSON.stringify(selection)}</output>
      <button type="button" onClick={onCheckoutCreated}>
        Generar instrucciones
      </button>
      <button type="button" onClick={onClose}>
        Cerrar compra
      </button>
    </div>
  ),
}));

const customer = { name: "María Torres", phone: "987654321" };
const serverNow = "2026-10-29T17:00:00Z";
const product = (variantId: string, productId: string, variantLabel: string): LiveProduct => ({
  variantId,
  productId,
  variantLabel,
  name: productId === "shoes" ? "Zapatillas" : "Polo",
  sku: variantId,
  livePrice: 20,
  regularPrice: 25,
  availableStock: 10,
  maxPerCustomer: 5,
  enabled: true,
});
const data: LivePublicData = {
  store: { id: "store", name: "Tienda" },
  config: {
    enabled: true,
    allowBuyNow: true,
    allowReservations: true,
    reservationMinutes: 15,
    maxReservedUnits: 5,
    allowAccumulation: false,
    combineShipping: false,
    homeShipping: 8,
    agencyShipping: null,
    reminderEnabled: false,
    showBackLink: false,
    allowSellerLive: false,
    closePolicy: "MANUAL",
    liveUrl: "",
  },
  session: { id: "session", status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
  products: [
    product("black-40", "shoes", "Negro / 40"),
    product("white-41", "shoes", "Blanco / 41"),
    product("polo-m", "shirt", "Talla M"),
  ],
  reservations: [],
  isTrusted: false,
  paymentMethods: ["yape"],
  serverNow,
};
function hold(variantId: string): LiveReservation {
  return {
    id: `hold-${variantId}`,
    variantId,
    productName: variantId === "polo-m" ? "Polo" : "Zapatillas",
    variantLabel: data.products.find((row) => row.variantId === variantId)?.variantLabel,
    quantity: 1,
    unitPrice: 20,
    customer,
    status: "ACTIVE",
    expiresAt: "2099-10-29T17:15:00Z",
    createdAt: serverNow,
    type: "TIMED",
  };
}
function card(name: string) {
  return within(screen.getByRole("article", { name }));
}
function addShoe(variantId: string) {
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: variantId } });
  fireEvent.click(card("Zapatillas").getByRole("button", { name: "Agregar a mi compra" }));
}
function fillCustomer(scope = screen) {
  fireEvent.change(scope.getByLabelText("Nombre"), { target: { value: customer.name } });
  fireEvent.change(scope.getByLabelText("WhatsApp"), { target: { value: customer.phone } });
}
beforeEach(() => {
  jest.clearAllMocks();
  (reserveLiveProduct as jest.Mock).mockReset();
  (removePublicLiveReservation as jest.Mock).mockReset();
  (getPublicLive as jest.Mock).mockResolvedValue(data);
  let sequence = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => `command-${++sequence}`),
  });
});

test("groups parent products and requires an explicit variant before any action", async () => {
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  expect(screen.getAllByRole("article")).toHaveLength(2);
  for (const name of ["Comprar ahora", "Apartar", "Agregar a mi compra"])
    expect(card("Zapatillas").getByRole("button", { name })).toBeDisabled();
  expect(card("Zapatillas").getByRole("combobox")).toHaveValue("");
  expect(reserveLiveProduct).not.toHaveBeenCalled();
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: "white-41" } });
  expect(card("Zapatillas").getByRole("button", { name: "Comprar ahora" })).toBeEnabled();
});

test("buys two explicit variants and another product in one selection", async () => {
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  addShoe("black-40");
  addShoe("white-41");
  fireEvent.click(card("Polo").getByRole("button", { name: "Agregar a mi compra" }));
  const selection = screen.getByRole("region", { name: "Tu selección (3)" });
  expect(within(selection).getByText("Negro / 40")).toBeInTheDocument();
  expect(within(selection).getByText("Blanco / 41")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Comprar selección" }));
  const dialog = await screen.findByRole("dialog", { name: "Compra seleccionada" });
  expect(JSON.parse(within(dialog).getByTestId("checkout-selection").textContent ?? "{}")).toEqual({
    items: [
      { variantId: "black-40", quantity: 1 },
      { variantId: "white-41", quantity: 1 },
      { variantId: "polo-m", quantity: 1 },
    ],
  });
  expect(reserveLiveProduct).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Generar instrucciones" }));
  expect(screen.getByRole("region", { name: "Tu selección (0)" })).toBeInTheDocument();
});

test("asks for reservation identity next to its action and retries only an unconfirmed batch item", async () => {
  (getPublicLive as jest.Mock).mockImplementation(() => Promise.resolve(data));
  (reserveLiveProduct as jest.Mock)
    .mockResolvedValueOnce({ reservation: hold("black-40"), serverNow })
    .mockRejectedValueOnce(new Error("Segundo apartado sin confirmar"))
    .mockResolvedValueOnce({ reservation: hold("white-41"), serverNow });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  addShoe("black-40");
  addShoe("white-41");
  fireEvent.click(screen.getByRole("button", { name: "Apartar selección" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Guardar tus apartados" }));
  fillCustomer(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar apartados" }));
  expect(await dialog.findByRole("alert")).toHaveTextContent("Segundo apartado sin confirmar");
  expect(reserveLiveProduct).toHaveBeenCalledTimes(2);
  const remainingSelection = within(screen.getByRole("region", { hidden: true }));
  expect(remainingSelection.getByText("Tu selección (1)")).toBeInTheDocument();
  expect(remainingSelection.queryByText("Negro / 40")).not.toBeInTheDocument();
  expect(remainingSelection.getByText("Blanco / 41")).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar apartados" }));
  await waitFor(() => expect(reserveLiveProduct).toHaveBeenCalledTimes(3));
  const calls = (reserveLiveProduct as jest.Mock).mock.calls;
  expect(calls.map((call) => call[2].variantId)).toEqual(["black-40", "white-41", "white-41"]);
  expect(calls[1][2].idempotencyKey).toBe(calls[2][2].idempotencyKey);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("region", { name: "Tu selección (0)" })).toBeInTheDocument();
});

test("an accepted hold is visible and unlocks before a stalled reconciliation read", async () => {
  let resolveRead!: (value: LivePublicData) => void;
  const pending = new Promise<LivePublicData>((resolve) => {
    resolveRead = resolve;
  });
  (getPublicLive as jest.Mock)
    .mockResolvedValueOnce({
      ...data,
      products: data.products.map((row) =>
        row.variantId === "black-40"
          ? { ...row, availableStock: 2, maxPerCustomer: 2, remainingLimit: 2 }
          : row,
      ),
    })
    .mockReturnValue(pending);
  (reserveLiveProduct as jest.Mock).mockResolvedValue({ reservation: hold("black-40"), serverNow });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  fillCustomer();
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: "black-40" } });
  fireEvent.click(card("Zapatillas").getByRole("button", { name: "Apartar" }));
  expect(await screen.findByText("Tus apartados (1)")).toBeInTheDocument();
  await waitFor(() =>
    expect(card("Zapatillas").getByRole("button", { name: "Apartar" })).toBeEnabled(),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    card("Zapatillas").getByRole("button", { name: "Agregar una unidad de Zapatillas" }),
  ).toBeDisabled();
  await act(async () => resolveRead({ ...data, reservations: [] }));
  await waitFor(() => expect(screen.getByText("Tus apartados (0)")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Pagar apartados" })).not.toBeInTheDocument();
});

test("a command timeout keeps the same reservation idempotency key for retry", async () => {
  (reserveLiveProduct as jest.Mock)
    .mockRejectedValueOnce(
      Object.assign(new Error("timeout"), { isAxiosError: true, code: "ECONNABORTED" }),
    )
    .mockResolvedValueOnce({ reservation: hold("black-40"), serverNow });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: "black-40" } });
  fireEvent.click(card("Zapatillas").getByRole("button", { name: "Apartar" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Guardar tus apartados" }));
  fillCustomer(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar apartados" }));
  expect(await dialog.findByRole("alert")).toHaveTextContent("No confirmamos el resultado");
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar apartados" }));
  await waitFor(() => expect(reserveLiveProduct).toHaveBeenCalledTimes(2));
  expect((reserveLiveProduct as jest.Mock).mock.calls[0][2].idempotencyKey).toBe(
    (reserveLiveProduct as jest.Mock).mock.calls[1][2].idempotencyKey,
  );
});

test("closing the catalog removes product and cart purchase actions", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    session: { ...data.session, status: "CLOSED" },
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByText("Nos vemos en el próximo live");
  for (const name of [
    "Comprar ahora",
    "Apartar",
    "Agregar a mi compra",
    "Comprar selección",
    "Apartar selección",
  ])
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(reserveLiveProduct).not.toHaveBeenCalled();
  expect(removePublicLiveReservation).not.toHaveBeenCalled();
});

test("a removed chosen variant never switches to the remaining variant on refresh", async () => {
  (getPublicLive as jest.Mock)
    .mockResolvedValueOnce(data)
    .mockResolvedValue({ ...data, products: [data.products[1]] });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: "black-40" } });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar catálogo" }));
  await waitFor(() => expect(card("Zapatillas").getByRole("combobox")).toHaveValue(""));
  expect(card("Zapatillas").getByRole("button", { name: "Comprar ahora" })).toBeDisabled();
  expect(card("Zapatillas").getByRole("button", { name: "Agregar a mi compra" })).toBeDisabled();
});

test("the store's total hold cap applies to a direct multi-product checkout too", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    config: { ...data.config, maxReservedUnits: 2 },
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  addShoe("black-40");
  addShoe("white-41");
  fireEvent.click(card("Polo").getByRole("button", { name: "Agregar a mi compra" }));
  expect(screen.getByRole("button", { name: "Comprar selección" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Apartar selección" })).toBeDisabled();
  expect(
    screen.getByText(/Puedes mantener hasta 2 unidades apartadas en total/),
  ).toBeInTheDocument();
});

test("an expired timed hold stops being payable before the next catalog read", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(serverNow));
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    reservations: [{ ...hold("black-40"), expiresAt: "2026-10-29T17:00:02Z" }],
  });
  try {
    render(<PublicLivePage storeId="store" />);
    await act(async () => {
      for (let count = 0; count < 5; count += 1) await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Pagar apartados" })).toBeEnabled();
    await act(async () => jest.advanceTimersByTime(3000));
    expect(screen.queryByRole("button", { name: "Pagar apartados" })).not.toBeInTheDocument();
    expect(screen.getByText("Tus apartados (0)")).toBeInTheDocument();
    expect(getPublicLive).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test("a single card reservation never silently subtracts a separately prepared cart", async () => {
  (reserveLiveProduct as jest.Mock).mockResolvedValue({ reservation: hold("black-40"), serverNow });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  addShoe("black-40");
  fireEvent.click(card("Zapatillas").getByRole("button", { name: "Apartar" }));
  const dialog = within(await screen.findByRole("dialog", { name: "Guardar tus apartados" }));
  fillCustomer(dialog);
  fireEvent.click(dialog.getByRole("button", { name: "Confirmar apartados" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("region", { name: "Tu selección (1)" })).toBeInTheDocument();
});

test("explains additional selected units and keeps their purchase separate from existing holds", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    reservations: [hold("black-40")],
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  addShoe("black-40");
  const selection = within(screen.getByRole("region", { name: "Tu selección (1)" }));
  expect(selection.getByText(/Ya tienes 1 unidad apartada/)).toHaveTextContent(
    "Esta selección agrega 1 unidad más.",
  );
  const buy = selection.getByRole("button", { name: "Comprar selección" });
  expect(buy).toHaveAccessibleDescription(/Para pagar lo que ya reservaste, usa Pagar apartados/);
  expect(screen.getByRole("button", { name: "Pagar apartados" })).toHaveAccessibleDescription(
    /Paga los productos ya apartados de esta lista/,
  );

  fireEvent.click(buy);
  const direct = within(await screen.findByRole("dialog", { name: "Compra seleccionada" }));
  expect(JSON.parse(direct.getByTestId("checkout-selection").textContent ?? "{}")).toEqual({
    items: [{ variantId: "black-40", quantity: 1 }],
  });
  fireEvent.click(direct.getByRole("button", { name: "Cerrar compra" }));
  fireEvent.click(screen.getByRole("button", { name: "Pagar apartados" }));
  const reserved = within(await screen.findByRole("dialog", { name: "Compra seleccionada" }));
  expect(JSON.parse(reserved.getByTestId("checkout-selection").textContent ?? "{}")).toEqual({
    items: [],
    reservationIds: ["hold-black-40"],
  });
  fireEvent.click(reserved.getByRole("button", { name: "Generar instrucciones" }));
  expect(screen.getByRole("region", { name: "Tu selección (1)" })).toBeInTheDocument();
  expect(reserveLiveProduct).not.toHaveBeenCalled();
});

test("paid units from an older live do not consume the new session's per-customer limit", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    products: data.products.map((row) =>
      row.variantId === "black-40" ? { ...row, maxPerCustomer: 2, remainingLimit: 2 } : row,
    ),
    reservations: [
      { ...hold("black-40"), status: "PAID", quantity: 2, sessionId: "previous-session" },
    ],
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  fireEvent.change(card("Zapatillas").getByRole("combobox"), { target: { value: "black-40" } });
  expect(card("Zapatillas").getByRole("button", { name: "Comprar ahora" })).toBeEnabled();
  expect(
    card("Zapatillas").getByRole("button", { name: "Agregar una unidad de Zapatillas" }),
  ).toBeEnabled();
});
