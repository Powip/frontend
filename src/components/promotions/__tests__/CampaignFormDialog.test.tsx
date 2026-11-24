import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CampaignFormDialog } from "@/components/promotions/CampaignFormDialog";
import { createPromotion, deletePromotion, getCampaignPrices, updatePromotion, type Promotion } from "@/services/promotionsService";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/promotionsService", () => ({
  createPromotion: jest.fn(),
  updatePromotion: jest.fn(),
  deletePromotion: jest.fn(),
  getCampaignPrices: jest.fn(),
}));

const PRODUCTS = [
  { id: "jim", name: "Pantalón Jimena", companySku: "JIM" },
  { id: "sofia", name: "Blusa Sofía", companySku: "SOF" },
];

const variant = (price: number, cost: number | null) => ({ variantId: `v-${price}`, storePrice: price, averageCost: cost, channels: { CATALOGO_WEB: price, WEB: price } });

function mockPrices() {
  jest.mocked(getCampaignPrices).mockImplementation(async (body) => ({
    storeId: body.storeId ?? null,
    igvIncluded: true,
    canSeeCosts: true,
    fallback: false,
    products: body.productIds.map((id) => ({
      productId: id,
      name: id === "jim" ? "Pantalón Jimena" : "Blusa Sofía",
      sku: null,
      imageUrl: null,
      variants: id === "jim" ? [variant(149, 120)] : [variant(89, 38)],
      inactiveChannels: [],
    })),
  }));
}

const CAMPAIGN: Promotion = {
  id: "c-1", name: "Cyber Wow", type: "CAMPAIGN", isActive: true, channels: ["CATALOGO_WEB"], storeIds: [],
  startsAt: "2026-11-24T05:00:00.000Z", endsAt: "2099-11-28T05:00:00.000Z", productId: null, minQty: null, maxQty: null,
  packPrice: null, giftCondition: null, minAmount: null, triggerVariantId: null, giftVariantId: null, giftQuantity: null,
  status: "ACTIVE", combinable: false, discountType: "PERCENT", discountValue: 20, allProducts: false,
  products: [{ productId: "jim", discountType: null, discountValue: null }], manualPrices: [],
} as Promotion;

function renderDialog(props: Partial<Parameters<typeof CampaignFormDialog>[0]> = {}) {
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CampaignFormDialog promo={null} stores={[{ id: "s1", name: "KUNCA" }]} products={PRODUCTS} onClose={onClose} {...props} />
    </QueryClientProvider>,
  );
  return { onClose };
}

async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Cyber Wow" }));
  await user.type(screen.getByLabelText("Porcentaje"), "20");
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-24T00:00" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-27T23:59" } });
  await user.click(screen.getByRole("checkbox", { name: "Catálogo web" }));
}

describe("Ventana de precio de campaña (FEAT-32 M3, spec §7.12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrices();
  });

  it("sin datos no guarda y dice qué falta", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Crear promoción" }));
    expect(screen.getByText("Escribe el nombre de la promoción.")).toBeInTheDocument();
    expect(screen.getByText("Escribe un descuento mayor a 0.")).toBeInTheDocument();
    expect(screen.getByText("Elige la fecha y hora de inicio y de fin.")).toBeInTheDocument();
    expect(screen.getByText("Elige al menos un canal.")).toBeInTheDocument();
    expect(screen.getByText("Elige al menos un producto o «Todos los productos».")).toBeInTheDocument();
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("calcula el precio por canal, deja un descuento propio y un precio a mano, y guarda todo", async () => {
    const user = userEvent.setup();
    jest.mocked(createPromotion).mockResolvedValue(CAMPAIGN);
    const { onClose } = renderDialog({ initialProductIds: ["jim"] });
    await fillBasics(user);

    const jim = await screen.findByTestId("campaign-cell-jim-CATALOGO_WEB");
    await waitFor(() => expect(within(jim).getByRole("textbox")).toHaveValue("119.20"));
    expect(jim).toHaveTextContent("antes S/ 149.00 · −20%");
    expect(screen.getByTestId("campaign-row-sofia")).toHaveTextContent("No entra en la promoción");

    // Blusa con −10% propio: S/ 89 → S/ 80.10.
    await user.click(screen.getByRole("checkbox", { name: "Incluir Blusa Sofía" }));
    await user.selectOptions(screen.getByLabelText("Descuento de Blusa Sofía"), "PERCENT");
    await user.type(screen.getByLabelText("Valor del descuento de Blusa Sofía"), "10");
    const sofia = await screen.findByTestId("campaign-cell-sofia-CATALOGO_WEB");
    await waitFor(() => expect(within(sofia).getByRole("textbox")).toHaveValue("80.10"));
    expect(sofia).not.toHaveTextContent("Bajo el costo"); // 80.10 ÷ 1.18 = 67.88 ≥ 38

    // Precio a mano para Jimena: queda morado con «Volver al calculado».
    const input = within(jim).getByRole("textbox");
    await user.clear(input);
    await user.type(input, "99");
    expect(within(jim).getByRole("button", { name: "↺ Volver al calculado" })).toBeInTheDocument();
    expect(jim).toHaveTextContent("Bajo el costo"); // 99 ÷ 1.18 = 83.90 < 120

    await user.click(screen.getByRole("button", { name: "Crear promoción" }));
    await waitFor(() => expect(createPromotion).toHaveBeenCalledTimes(1));
    expect(createPromotion).toHaveBeenCalledWith({
      name: "Cyber Wow",
      type: "CAMPAIGN",
      channels: ["CATALOGO_WEB"],
      storeIds: [],
      startsAt: "2026-11-24T00:00:00-05:00",
      endsAt: "2026-11-27T23:59:00-05:00",
      discountType: "PERCENT",
      discountValue: 20,
      allProducts: false,
      products: [{ productId: "jim" }, { productId: "sofia", discountType: "PERCENT", discountValue: 10 }],
      manualPrices: [{ productId: "jim", channel: "CATALOGO_WEB", price: 99 }],
      combinable: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("un descuento en S/ que deja el precio en 0 o menos no se puede guardar", async () => {
    const user = userEvent.setup();
    renderDialog({ initialProductIds: ["sofia"] });
    await user.click(screen.getByRole("button", { name: "Liquidación" }));
    await user.selectOptions(screen.getByLabelText("Tipo de descuento"), "AMOUNT");
    await user.type(screen.getByLabelText("Monto a descontar (S/)"), "100");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-24T00:00" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-27T23:59" } });
    await user.click(screen.getByRole("checkbox", { name: "Catálogo web" }));
    const cell = await screen.findByTestId("campaign-cell-sofia-CATALOGO_WEB");
    await waitFor(() => expect(cell).toHaveTextContent("Queda en S/ 0 o menos"));
    await user.click(screen.getByRole("button", { name: "Crear promoción" }));
    expect(screen.getByText(/Revisa: Blusa Sofía en Catálogo web: queda en S\/ 0 o menos\./)).toBeInTheDocument();
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it("el cruce (409) sale en un aviso ámbar y la ventana sigue abierta", async () => {
    const user = userEvent.setup();
    const crossing = new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      statusText: "Conflict",
      data: { message: "Se cruza con Precio especial del chat (Pantalón Jimena en Catálogo web)." },
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    jest.mocked(createPromotion).mockRejectedValue(crossing);
    const { onClose } = renderDialog({ initialProductIds: ["jim"] });
    await fillBasics(user);
    await screen.findByTestId("campaign-cell-jim-CATALOGO_WEB");
    await user.click(screen.getByRole("button", { name: "Crear promoción" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Se cruza con Precio especial del chat (Pantalón Jimena en Catálogo web).");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("al editar guarda sin la clase y al eliminar una activa avisa que los precios vuelven al normal", async () => {
    const user = userEvent.setup();
    jest.mocked(updatePromotion).mockResolvedValue(undefined);
    jest.mocked(deletePromotion).mockResolvedValue(undefined);
    renderDialog({ promo: CAMPAIGN });
    expect(screen.getByRole("heading", { name: "Editar promoción" })).toBeInTheDocument();
    await screen.findByTestId("campaign-cell-jim-CATALOGO_WEB");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updatePromotion).toHaveBeenCalledTimes(1));
    const [id, body] = jest.mocked(updatePromotion).mock.calls[0];
    expect(id).toBe("c-1");
    expect(body).not.toHaveProperty("type");
    expect(body).toMatchObject({ name: "Cyber Wow", discountType: "PERCENT", discountValue: 20, channels: ["CATALOGO_WEB"] });
  });

  it("eliminar una promoción activa pide confirmación con el aviso de la spec", async () => {
    const user = userEvent.setup();
    jest.mocked(deletePromotion).mockResolvedValue(undefined);
    const { onClose } = renderDialog({ promo: CAMPAIGN });
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("La promoción está activa: los precios vuelven al normal en todos sus canales al eliminarla.");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deletePromotion).toHaveBeenCalledWith("c-1"));
    expect(onClose).toHaveBeenCalled();
  });
});
