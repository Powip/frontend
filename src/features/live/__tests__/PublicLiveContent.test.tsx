import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getPublicLive, getPublicLiveProductContent } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LiveProduct, LivePublicData } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  getPublicLiveProductContent: jest.fn(),
  lookupLiveCustomer: jest.fn().mockResolvedValue({ known: false, name: null }),
  liveVisitorToken: jest.fn(() => "1042cd44-14dd-47e3-9503-ce24f6090853"),
}));

const storeId = "1042cd44-14dd-47e3-9503-ce24f6090853";
const variant = (over: Partial<LiveProduct>): LiveProduct => ({
  variantId: "v-s",
  productId: "p-sofia",
  name: "BLUSA SOFIA | interno",
  sku: "SOF-S",
  imageUrl: "https://cdn.test/variante.jpg",
  attributes: { Talla: "S" },
  regularPrice: 89,
  livePrice: 69,
  availableStock: 3,
  maxPerCustomer: null,
  enabled: true,
  ...over,
});
const CONTENT = {
  title: "Blusa Sofía de lino",
  shortDescription: "Fresca y suelta, ideal para el verano.",
  photos: ["https://cdn.test/live-1.jpg", "https://cdn.test/live-2.jpg"],
};
const data = (products: LiveProduct[]): LivePublicData => ({
  store: { id: storeId, name: "KUNCA" },
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
  session: { id: "s", status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
  products,
  reservations: [],
  isTrusted: false,
  paymentMethods: [],
  serverNow: "2026-11-24T17:00:00.000Z",
});
const unavailable = () =>
  new AxiosError("503", "ERR", undefined, undefined, {
    status: 503,
    statusText: "Service Unavailable",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message: "No disponible" },
  });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublicLivePage storeId={storeId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, "", `/live/${storeId}`);
});

describe("Vitrina con el contenido del producto (FEAT-32 M7)", () => {
  it("la tarjeta usa la primera foto y el título del contenido, una vez por producto", async () => {
    (getPublicLive as jest.Mock).mockResolvedValue(
      data([
        variant({ content: CONTENT }),
        variant({ variantId: "v-m", sku: "SOF-M", attributes: { Talla: "M" }, content: CONTENT }),
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
    const card = await screen.findByRole("article", { name: "Blusa Sofía de lino" });
    expect(within(card).getByRole("heading", { name: "Blusa Sofía de lino" })).toBeInTheDocument();
    expect(within(card).getByText("Fresca y suelta, ideal para el verano.")).toBeInTheDocument();
    expect(within(card).getByRole("img")).toHaveAttribute("src", "https://cdn.test/live-1.jpg");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(getPublicLiveProductContent).not.toHaveBeenCalled();
  });

  it("al elegir el color se ve su foto propia; un color sin foto propia deja la principal del contenido", async () => {
    (getPublicLive as jest.Mock).mockResolvedValue(
      data([
        variant({ attributes: { Color: "Crema", Talla: "S" }, variantImageUrl: "https://cdn.test/crema.jpg", content: CONTENT }),
        variant({ variantId: "v-m", sku: "SOF-M", attributes: { Color: "Negro", Talla: "S" }, variantImageUrl: null, content: CONTENT }),
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
    const card = await screen.findByRole("article", { name: "Blusa Sofía de lino" });
    const photo = () => within(card).getAllByRole("img")[0];
    expect(photo()).toHaveAttribute("src", "https://cdn.test/live-1.jpg");
    fireEvent.click(within(card).getByRole("button", { name: "Crema" }));
    expect(photo()).toHaveAttribute("src", "https://cdn.test/crema.jpg");
    fireEvent.click(within(card).getByRole("button", { name: "Negro" }));
    expect(photo()).toHaveAttribute("src", "https://cdn.test/live-1.jpg");
  });

  it("sin contenido (ms-products caído) se ve como antes y sin «Ver detalle»", async () => {
    (getPublicLive as jest.Mock).mockResolvedValue(data([variant({})]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
    const card = await screen.findByRole("article", { name: "BLUSA SOFIA | interno" });
    expect(within(card).getByRole("img")).toHaveAttribute("src", "https://cdn.test/variante.jpg");
    expect(within(card).queryByRole("button", { name: /Ver detalle/ })).not.toBeInTheDocument();
  });

  it("«Ver detalle» pide el detalle al abrir y muestra fotos, descripción saneada y características", async () => {
    (getPublicLive as jest.Mock).mockResolvedValue(data([variant({ content: CONTENT })]));
    (getPublicLiveProductContent as jest.Mock).mockResolvedValue({
      productId: "p-sofia",
      ...CONTENT,
      descriptionHtml: '<p>Lino <b>100%</b></p><script>alert(1)</script><img src="x" onerror="alert(2)">',
      features: ["Manga corta", "Lino"],
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Blusa Sofía de lino" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByTestId("live-product-description")).toBeInTheDocument());
    expect(getPublicLiveProductContent).toHaveBeenCalledWith(storeId, storeId, "p-sofia", expect.anything());
    const description = within(dialog).getByTestId("live-product-description");
    expect(description.innerHTML).toBe("<p>Lino <b>100%</b></p><img>");
    expect(within(dialog).getByRole("list", { name: "Características" })).toHaveTextContent("Manga cortaLino");
    expect(within(dialog).getByRole("img", { name: "Blusa Sofía de lino, foto 1" })).toHaveAttribute("src", "https://cdn.test/live-1.jpg");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ver foto 2" }));
    expect(within(dialog).getByRole("img", { name: "Blusa Sofía de lino, foto 2" })).toHaveAttribute("src", "https://cdn.test/live-2.jpg");
    // No cambia el flujo de separar: la tarjeta sigue igual detrás.
    fireEvent.click(within(dialog).getByRole("button", { name: "Seguir viendo productos" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Elige talla/ })).toBeInTheDocument();
  });

  it("si el detalle no responde, muestra lo que ya trae la tarjeta", async () => {
    (getPublicLive as jest.Mock).mockResolvedValue(data([variant({ content: CONTENT })]));
    (getPublicLiveProductContent as jest.Mock).mockRejectedValue(unavailable());
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Solo quiero mirar primero" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalle de Blusa Sofía de lino" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).queryByText("Cargando detalle…")).not.toBeInTheDocument());
    expect(within(dialog).getByText("Fresca y suelta, ideal para el verano.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ver foto 2" })).toBeInTheDocument();
    expect(within(dialog).queryByTestId("live-product-description")).not.toBeInTheDocument();
  });
});
