import { fireEvent, render, screen, within } from "@testing-library/react";
import { getPublicLive } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LivePublicData } from "../types";

/**
 * FEAT-33 B5 + estructura del mockup: el catálogo del comprador toma el tema, el color, el logo y el
 * nombre que eligió el negocio, y la bienvenida es una pantalla (no un cuadro encima del catálogo).
 */
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  identifyLiveCustomer: jest.fn(),
  lookupLiveCustomer: jest.fn().mockResolvedValue({ known: false, name: null }),
  liveVisitorToken: jest.fn(() => "1042cd44-14dd-47e3-9503-ce24f6090853"),
}));
const storeId = "1042cd44-14dd-47e3-9503-ce24f6090853";
const base: LivePublicData = {
  store: { id: storeId, name: "Kunca" },
  config: {
    enabled: true,
    allowBuyNow: true,
    allowReservations: true,
    reservationMinutes: 15,
    maxReservedUnits: 5,
    allowAccumulation: true,
    combineShipping: true,
    homeShipping: null,
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
} as unknown as LivePublicData;
const page = () => screen.getByTestId("live-buyer");
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, "", `/live/${storeId}`);
});

test("uses the saved theme, color, logo and name", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({
    ...base,
    config: {
      ...base.config,
      appearance: {
        theme: "light",
        color: "#f37ea3",
        displayName: "Kunca Store",
        logoUrl: "https://storage.test/logo.png",
      },
    },
  });
  render(<PublicLivePage storeId={storeId} />);
  const top = await screen.findByRole("banner");
  expect(within(top).getByText("Kunca Store")).toBeInTheDocument();
  expect(within(top).getByRole("img", { name: "Logo de Kunca Store" })).toHaveAttribute(
    "src",
    "https://storage.test/logo.png",
  );
  expect(page()).toHaveAttribute("data-theme", "light");
  expect(page().style.getPropertyValue("--acc")).toBe("#f37ea3");
  // Los cuadros (Mi pedido, pagar) se abren fuera de la página: toman los mismos colores.
  expect(document.body.style.getPropertyValue("--acc")).toBe("#f37ea3");
});

test("without appearance it is dark and turquoise with the store name and initials", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue(base);
  const { unmount } = render(<PublicLivePage storeId={storeId} />);
  const top = await screen.findByRole("banner");
  await within(top).findByText("Kunca");
  expect(within(top).getByText("KU")).toBeInTheDocument();
  expect(within(top).getByText(/En vivo en TikTok/)).toBeInTheDocument();
  expect(page()).toHaveAttribute("data-theme", "dark");
  expect(page().style.getPropertyValue("--acc")).toBe("#72efe8");
  unmount();
  expect(document.body.style.getPropertyValue("--acc")).toBe("");
});

test("the live welcome is a full screen that asks for WhatsApp once", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue(base);
  render(<PublicLivePage storeId={storeId} />);
  expect(
    await screen.findByRole("heading", { name: "Compra lo que ves en el live" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText("Precios del live")).toBeInTheDocument();
  expect(screen.queryByText("Crema Centella")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Solo quiero mirar primero" }));
  expect(await screen.findByText("Crema Centella")).toBeInTheDocument();
  expect(screen.getByText(/Para separar te pediremos tu WhatsApp/)).toBeInTheDocument();
});

test("the WhatsApp link welcome speaks of the catalog, not of the live", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue({ ...base, channel: "WHATSAPP" });
  render(<PublicLivePage storeId={storeId} />);
  expect(
    await screen.findByRole("heading", { name: "Elige, separa y paga desde tu celular" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Precios del live")).not.toBeInTheDocument();
  expect(within(screen.getByRole("banner")).getByText(/Catálogo por WhatsApp/)).toBeInTheDocument();
});

test("the product card shows the live discount and the price in the brand color", async () => {
  (getPublicLive as jest.Mock).mockResolvedValue(base);
  render(<PublicLivePage storeId={storeId} />);
  fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
  const card = within(await screen.findByRole("article", { name: "Crema Centella" }));
  expect(card.getByText("−20% en el live")).toBeInTheDocument();
  expect(card.getByText("S/ 20.00")).toHaveClass("text-[var(--acc-tx)]");
  expect(card.getByText("S/ 25.00").tagName).toBe("S");
});
