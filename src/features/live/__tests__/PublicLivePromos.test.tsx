import { configure, fireEvent, render, screen, within } from "@testing-library/react";
import { getPublicLive, liveMoney as formatMoney } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import { LivePayTotal } from "../LivePayFrame";
import { livePromoSummary } from "../LivePromos";
import type { LiveProduct, LivePublicData, LiveReservation } from "../types";

// FEAT-33 L7b (C7): volumen y regalo de POWIP Live en la vitrina, el carrito y el resumen del pago.
configure({ asyncUtilTimeout: 1500 });
jest.setTimeout(20000);
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  liveVisitorToken: jest.fn(() => "visitor-private"),
}));
// Testing Library normaliza el espacio duro de Intl en el DOM, no en el texto buscado.
const liveMoney = (amount: number) => formatMoney(amount).replace(/\u00a0/g, " ");
const customer = { name: "María Torres", phone: "987654321" };
const serverNow = "2026-11-24T17:00:00Z";
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
  customer,
  promos: {
    volumes: [
      {
        id: "vol",
        name: "Lleva 2 por S/ 30",
        minQty: 2,
        maxQty: null,
        packPrice: 30,
        variantIds: ["black-40", "white-41"],
      },
    ],
    gifts: [{ id: "gift", name: "Regalo desde S/ 60", minAmount: 60, giftName: "Medias" }],
  },
  cartPromos: { discount: 0, lines: [], gift: null, suggestions: [] },
};
const hold = (variantId: string, quantity = 1): LiveReservation => ({
  id: `hold-${variantId}`,
  variantId,
  productName: "Zapatillas",
  variantLabel: data.products.find((row) => row.variantId === variantId)?.variantLabel,
  quantity,
  unitPrice: 20,
  customer,
  status: "ACTIVE",
  expiresAt: "2099-11-24T17:15:00Z",
  createdAt: serverNow,
  type: "TIMED",
});
const card = (name: string) => within(screen.getByRole("article", { name }));

beforeEach(() => jest.clearAllMocks());

test("the product shows the Live volume and how many are missing; the banner says how much is missing for the gift", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    reservations: [hold("black-40")],
    cartPromos: {
      discount: 0,
      lines: [],
      gift: null,
      suggestions: [
        { kind: "VOLUME", promoId: "vol", missing: 1, text: "Agrega 1 más…" },
        { kind: "GIFT", promoId: "gift", missingAmount: 40, text: "Faltan S/ 40.00…" },
      ],
    },
  });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  expect(card("Zapatillas").getByText(`📦 Desde 2 unidades: ${liveMoney(15)} c/u · llevas 1, te falta 1`)).toBeInTheDocument();
  expect(card("Polo").queryByText(/📦 Desde/)).not.toBeInTheDocument();
  expect(screen.getByRole("note", { name: "Regalo" })).toHaveTextContent(
    `🎁 Por compras desde ${liveMoney(60)} te llevas gratis Medias. Te faltan ${liveMoney(40)}.`,
  );
});

test("the cart shows the pack price on the discounted line, the promo discount and the gift reached", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...data,
    reservations: [hold("black-40", 2)],
    cartPromos: {
      discount: 10,
      lines: [
        { reservationId: "hold-black-40", promoDiscount: 10, lineTotal: 30, promoId: "vol", promoLabel: "Lleva 2 por S/ 30" },
      ],
      gift: { promoId: "gift", name: "Regalo desde S/ 30", giftName: "Medias" },
      suggestions: [],
    },
  });
  render(<PublicLivePage storeId="store" />);
  expect(await screen.findByText(`📦 Desde 2 unidades: ${liveMoney(15)} c/u · ✓ ya tienes el precio pack`)).toBeInTheDocument();
  expect(screen.getByRole("note", { name: "Regalo" })).toHaveTextContent("🎁 ¡Ganaste tu regalo! Medias va gratis en tu pedido.");
  // El nombre accesible conserva el espacio duro de Intl.
  fireEvent.click(screen.getByRole("button", { name: /Ver mi pedido · S\/\s30\.00/ }));
  const cart = within(screen.getByRole("dialog"));
  expect(cart.getByText("📦 Precio pack: Lleva 2 por S/ 30")).toBeInTheDocument();
  expect(cart.getByText(`Promo −${liveMoney(10)}`)).toBeInTheDocument();
  const gift = within(cart.getByRole("article", { name: "Regalo: Medias" }));
  expect(gift.getByText("🎁 Regalo")).toBeInTheDocument();
  expect(gift.queryByRole("button")).not.toBeInTheDocument();
  expect(cart.getByText(`Productos · ${liveMoney(30)}`)).toBeInTheDocument();
});

test("/catalogo and POWIP Link have no Live promos", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({ ...data, channel: "WHATSAPP", promos: null, cartPromos: null });
  render(<PublicLivePage storeId="store" />);
  await screen.findByRole("article", { name: "Zapatillas" });
  expect(screen.queryByText(/📦 Desde/)).not.toBeInTheDocument();
  expect(screen.queryByRole("note", { name: "Regalo" })).not.toBeInTheDocument();
});

test("the payment summary counts bought units only and shows the promo and the gift", () => {
  const summary = livePromoSummary([
    { variantId: "black-40", name: "Zapatillas", sku: "Z", quantity: 2, unitPrice: 20, lineTotal: 30, promoDiscount: 10, promoId: "vol" },
    { variantId: "medias", name: "Medias", sku: "M", quantity: 1, unitPrice: 0, isGift: true, promoId: "gift" },
  ]);
  expect(summary).toEqual({ units: 2, discount: 10, gift: "Medias" });
  render(<LivePayTotal units={2} products={30} shipping="Envío" total={formatMoney(38)} discount={10} gift="Medias" />);
  // Se lee como un recibo: productos a precio live, menos la promo, más el envío = total.
  expect(screen.getByText(/2 prendas · productos/)).toHaveTextContent(`2 prendas · productos ${liveMoney(40)}`);
  expect(screen.getByText(`Promo −${liveMoney(10)}`)).toBeInTheDocument();
  expect(screen.getByText("🎁 Regalo: Medias")).toBeInTheDocument();
});
