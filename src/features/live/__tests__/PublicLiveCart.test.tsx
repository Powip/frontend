import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  getPublicLive,
  removePublicLiveReservation,
  reserveLiveProduct,
  resizeLiveReservation,
} from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LiveProduct, LivePublicData, LiveReservation } from "../types";

configure({ asyncUtilTimeout: 1500 });
jest.setTimeout(20000);

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  removePublicLiveReservation: jest.fn(),
  resizeLiveReservation: jest.fn(),
  liveVisitorToken: jest.fn(() => "visitor-private"),
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
beforeEach(() => {
  jest.clearAllMocks();
  (reserveLiveProduct as jest.Mock).mockReset();
  (removePublicLiveReservation as jest.Mock).mockReset();
  (getPublicLive as jest.Mock).mockResolvedValue({ ...data, customer });
  let sequence = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => `command-${++sequence}`),
  });
});

test("groups parents and requires color/size buttons before separating", async () => {
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(card("Zapatillas").getByRole("button", { name: "Elige tu talla o color" })).toBeDisabled();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Comprar ahora" })).not.toBeInTheDocument();
  fireEvent.click(card("Zapatillas").getByRole("button", { name: "Blanco / 41" }));
  fireEvent.click(card("Zapatillas").getByRole("button", { name: /Separar/ }));
  await waitFor(() => expect(reserveLiveProduct).toHaveBeenCalledTimes(1));
  expect((reserveLiveProduct as jest.Mock).mock.calls[0][2]).toEqual(
    expect.objectContaining({ variantId: "white-41", quantity: 1, customer }),
  );
});

test("one cart displays both reserved variants and resizes the existing reservation", async () => {
  let current = { ...data, customer, reservations: [hold("black-40"), hold("white-41")] };
  (getPublicLive as jest.Mock).mockImplementation(async () => current);
  (resizeLiveReservation as jest.Mock).mockImplementation(async () => {
    current = {
      ...current,
      reservations: [{ ...hold("black-40"), quantity: 2 }, hold("white-41")],
    };
    return {};
  });
  render(<PublicLivePage storeId="store" />);
  fireEvent.click(await screen.findByRole("button", { name: /Ver mi pedido/ }));
  const cart = within(screen.getByRole("dialog"));
  expect(cart.getByText(/Negro \/ 40/)).toBeInTheDocument();
  expect(cart.getByText(/Blanco \/ 41/)).toBeInTheDocument();
  fireEvent.click(cart.getAllByRole("button", { name: "Sumar Zapatillas" })[0]);
  await waitFor(() => expect(resizeLiveReservation).toHaveBeenCalledTimes(1));
  expect((resizeLiveReservation as jest.Mock).mock.calls[0].slice(0, 4)).toEqual([
    "store",
    "visitor-private",
    "hold-black-40",
    2,
  ]);
  await waitFor(() => expect(screen.getByText("3 prendas separadas")).toBeInTheDocument());
  expect(reserveLiveProduct).not.toHaveBeenCalled();
});

test("removing a reserved variant refreshes the cart from server state", async () => {
  let current = { ...data, customer, reservations: [hold("black-40"), hold("white-41")] };
  (getPublicLive as jest.Mock).mockImplementation(async () => current);
  (removePublicLiveReservation as jest.Mock).mockImplementation(async () => {
    current = { ...current, reservations: [hold("white-41")] };
  });
  render(<PublicLivePage storeId="store" />);
  fireEvent.click(await screen.findByRole("button", { name: /Ver mi pedido/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Quitar" })[0]);
  await waitFor(() =>
    expect(removePublicLiveReservation).toHaveBeenCalledWith(
      "store",
      "visitor-private",
      "hold-black-40",
    ),
  );
  await waitFor(() => expect(screen.getByText("1 prendas separadas")).toBeInTheDocument());
});

test("the five-unit cap disables further reservations, trusted customers are exempt", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    customer,
    reservations: [{ ...hold("polo-m"), quantity: 5 }],
  });
  const view = render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Polo" });
  expect(
    card("Polo").getByRole("button", { name: "Máximo de prendas separadas alcanzado" }),
  ).toBeDisabled();
  view.unmount();
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    customer,
    isTrusted: true,
    reservations: [{ ...hold("polo-m"), quantity: 5 }],
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Polo" });
  expect(card("Polo").getByRole("button", { name: /Separar/ })).toBeEnabled();
});
