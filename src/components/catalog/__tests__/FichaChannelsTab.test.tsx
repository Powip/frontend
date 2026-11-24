import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FichaChannelsTab from "@/components/catalog/ficha/FichaChannelsTab";
import { getProductChannels, saveProductChannel, type ProductChannelsView } from "@/services/productChannelsService";
import type { CatalogProductDetail, CatalogVariantDetail } from "@/services/catalogProductService";
import { getCampaignPrices, listPromotions, type Promotion } from "@/services/promotionsService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/productos/p1" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1", stores: [{ id: "s1", name: "KUNCA" }] } } }),
}));
jest.mock("@/services/productChannelsService", () => ({ getProductChannels: jest.fn(), saveProductChannel: jest.fn() }));
jest.mock("@/services/promotionsService", () => ({ listPromotions: jest.fn(), getCampaignPrices: jest.fn() }));

const promo = (over: Partial<Promotion>): Promotion => ({
  id: "c-1", name: "Cyber Wow", type: "CAMPAIGN", isActive: true, channels: ["CATALOGO_WEB"], storeIds: [],
  startsAt: "2020-11-24T05:00:00.000Z", endsAt: "2099-11-28T05:00:00.000Z", productId: null, minQty: null, maxQty: null,
  packPrice: null, giftCondition: null, minAmount: null, triggerVariantId: null, giftVariantId: null, giftQuantity: null,
  status: "ACTIVE", combinable: false, discountType: "PERCENT", discountValue: 20, allProducts: false,
  products: [{ productId: "p1", discountType: null, discountValue: null }], manualPrices: [],
  ...over,
}) as Promotion;

const PRODUCT = { id: "p1", name: "Pantalón Jimena", externalSource: "shopify", externalId: "99" } as unknown as CatalogProductDetail;
const VARIANTS = [
  { id: "v1", sku: "S", companySku: "JIM-S", attributeValues: { Talla: "S" }, priceVta: 149, isActive: true },
  { id: "v2", sku: "M", companySku: "JIM-M", attributeValues: { Talla: "M" }, priceVta: 149, isActive: true },
] as unknown as CatalogVariantDetail[];

const channel = (code: "POWIP_CRM" | "CATALOGO_WEB", over: Partial<ProductChannelsView["channels"][number]> = {}) => ({
  channel: code,
  name: code === "POWIP_CRM" ? "POWIP CRM" : "Catálogo web",
  active: true,
  saved: false,
  rule: { mode: "same" as const, unit: null, value: null },
  ruleLabel: "Igual al de tienda",
  listId: null,
  prices: [
    { variantId: "v1", price: 149, own: false, belowCost: false },
    { variantId: "v2", price: 149, own: false, belowCost: false },
  ],
  ownPriceCount: 0,
  updatedAt: null,
  updatedBy: null,
  ...over,
});

const VIEW: ProductChannelsView = {
  productId: "p1",
  storeId: "s1",
  canEdit: true,
  igvIncluded: true,
  variants: [
    { variantId: "v1", sku: "JIM-S", attributeValues: { Talla: "S" }, storePrice: 149, averageCost: 140 },
    { variantId: "v2", sku: "JIM-M", attributeValues: { Talla: "M" }, storePrice: 149, averageCost: null },
  ],
  channels: [channel("POWIP_CRM"), channel("CATALOGO_WEB")],
};

function renderTab(view: ProductChannelsView = VIEW) {
  jest.mocked(getProductChannels).mockResolvedValue(view);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FichaChannelsTab product={PRODUCT} variants={VARIANTS} />
    </QueryClientProvider>,
  );
}

describe("Ficha › Canales (FEAT-32 M2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listPromotions).mockResolvedValue([]);
  });

  it("muestra Live, CRM y Catálogo web con estado y precio, Shopify «Lo administra Shopify» y las variantes unidas", async () => {
    renderTab();
    expect(await screen.findByText("POWIP CRM")).toBeInTheDocument();
    expect(getProductChannels).toHaveBeenCalledWith("p1", "s1", expect.anything());
    expect(screen.getByText("POWIP Live")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir POWIP Live ↗" })).toHaveAttribute("href", "/live");
    expect(screen.getAllByText("Al día")).toHaveLength(2);
    expect(screen.getByTestId("channel-price-POWIP_CRM")).toHaveTextContent("S/ 149.00");
    expect(screen.getAllByText("Igual al de tienda").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Lo administra Shopify")).toBeInTheDocument();
    expect(screen.getByText("JIM-S")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Activar en POWIP Live" })).not.toBeInTheDocument();
  });

  it("Cambiar precio: más caro en S/, vista previa, aviso bajo el costo y guarda la regla", async () => {
    const user = userEvent.setup();
    jest.mocked(saveProductChannel).mockResolvedValue({
      ...VIEW,
      channels: [channel("POWIP_CRM", { rule: { mode: "more", unit: "amount", value: 10 }, ruleLabel: "Tienda + S/ 10.00", saved: true }), channel("CATALOGO_WEB")],
    });
    renderTab();
    const crmRow = (await screen.findByText("POWIP CRM")).closest("tr")!;
    await user.click(within(crmRow).getByRole("button", { name: "Cambiar precio" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Precio en POWIP CRM" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Se aplica a las 2 variantes/)).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText(/Más barato/));
    await user.type(within(dialog).getByLabelText("Valor"), "100");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("El descuento debe ser menor a 100%.");
    expect(within(dialog).getByRole("button", { name: "Guardar precio" })).toBeDisabled();
    await user.clear(within(dialog).getByLabelText("Valor"));
    await user.type(within(dialog).getByLabelText("Valor"), "10");
    expect(within(dialog).getByTestId("channel-price-preview")).toHaveTextContent("S/ 134.10");
    expect(within(dialog).getByText(/Por debajo del costo \(S\/ 140.00 sin IGV\)/)).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText(/Más caro/));
    await user.clear(within(dialog).getByLabelText("Valor"));
    await user.type(within(dialog).getByLabelText("Valor"), "10");
    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "amount");
    expect(within(dialog).getByTestId("channel-price-preview")).toHaveTextContent("S/ 159.00");
    await user.click(within(dialog).getByRole("button", { name: "Guardar precio" }));
    await waitFor(() =>
      expect(saveProductChannel).toHaveBeenCalledWith("p1", { storeId: "s1", channel: "POWIP_CRM", active: true, rule: { mode: "more", unit: "amount", value: 10 } }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Tienda + S/ 10.00")).toBeInTheDocument();
  });

  it("desactivar pide confirmación; activar abre la ventana de precio con «Activar canal»", async () => {
    const user = userEvent.setup();
    jest.mocked(saveProductChannel).mockResolvedValueOnce({ ...VIEW, channels: [channel("POWIP_CRM"), channel("CATALOGO_WEB", { active: false, saved: true })] });
    renderTab();
    await user.click(await screen.findByRole("switch", { name: "Activar en Catálogo web" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("Desactivar en Catálogo web")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Desactivar" }));
    await waitFor(() =>
      expect(saveProductChannel).toHaveBeenCalledWith("p1", { storeId: "s1", channel: "CATALOGO_WEB", active: false, rule: { mode: "same", unit: null, value: null } }),
    );
    expect(await screen.findByText("No activado")).toBeInTheDocument();

    jest.mocked(saveProductChannel).mockResolvedValueOnce(VIEW);
    await user.click(screen.getByRole("switch", { name: "Activar en Catálogo web" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Activar en Catálogo web" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Activar canal" }));
    await waitFor(() =>
      expect(saveProductChannel).toHaveBeenLastCalledWith("p1", { storeId: "s1", channel: "CATALOGO_WEB", active: true, rule: { mode: "same", unit: null, value: null } }),
    );
  });

  it("sin permiso: sin interruptores ni «Cambiar precio»; muestra las variantes con precio propio", async () => {
    renderTab({
      ...VIEW,
      canEdit: false,
      channels: [
        channel("POWIP_CRM", {
          ruleLabel: "Tienda − 8%",
          ownPriceCount: 1,
          prices: [{ variantId: "v1", price: 137.08, own: false, belowCost: false }, { variantId: "v2", price: 99, own: true, belowCost: false }],
        }),
        channel("CATALOGO_WEB"),
      ],
    });
    expect(await screen.findByText(/Tienda − 8% · 1 variante con precio propio/)).toBeInTheDocument();
    expect(screen.getByTestId("channel-price-POWIP_CRM")).toHaveTextContent("S/ 99.00 – S/ 137.08");
    expect(screen.getByRole("switch", { name: "Activar en POWIP CRM" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cambiar precio" })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo el Administrador u Operaciones activan canales/)).toBeInTheDocument();
  });

  it("FEAT-32 M3: precio con la campaña activa (y el de antes tachado), la próxima programada y «Promociones de este producto»", async () => {
    jest.mocked(listPromotions).mockResolvedValue([
      promo({}),
      promo({ id: "c-2", name: "Navidad", channels: ["POWIP_CRM"], startsAt: "2099-12-20T05:00:00.000Z", endsAt: "2099-12-26T05:00:00.000Z", status: "SCHEDULED" }),
      promo({ id: "c-3", name: "De otra tienda", storeIds: ["s9"] }),
      promo({ id: "v-1", name: "Lleva 3", type: "VOLUME", productId: "p1", channels: [], startsAt: null, endsAt: null, products: [] }),
    ]);
    jest.mocked(getCampaignPrices).mockResolvedValue({
      storeId: "s1", igvIncluded: true, canSeeCosts: true, fallback: false,
      products: [{ productId: "p1", name: "Pantalón Jimena", sku: null, imageUrl: null, inactiveChannels: [], variants: [
        { variantId: "v1", storePrice: 149, averageCost: 140, channels: { CATALOGO_WEB: 149, POWIP_CRM: 159 } },
        { variantId: "v2", storePrice: 149, averageCost: null, channels: { CATALOGO_WEB: 149, POWIP_CRM: 159 } },
      ] }],
    });
    renderTab();

    await waitFor(() => expect(screen.getByTestId("channel-price-CATALOGO_WEB")).toHaveTextContent("S/ 119.20"));
    const webRow = screen.getByTestId("channel-price-CATALOGO_WEB").closest("tr")!;
    expect(within(webRow).getByText("S/ 149.00")).toBeInTheDocument();
    expect(within(webRow).getByText("Cyber Wow −20%")).toBeInTheDocument();
    const crmRow = screen.getByTestId("channel-price-POWIP_CRM").closest("tr")!;
    expect(screen.getByTestId("channel-price-POWIP_CRM")).toHaveTextContent("S/ 149.00");
    expect(crmRow).toHaveTextContent("Programada Navidad desde 20/12");

    const section = screen.getByRole("region", { name: "Promociones de este producto" });
    expect(within(section).getByText(/También aplica/)).toHaveTextContent("También aplica: Lleva 3 (volumen).");
    const cyber = within(section).getByTestId("product-promo-c-1");
    await waitFor(() => expect(cyber).toHaveTextContent("S/ 119.20antes S/ 149.00"));
    expect(cyber).toHaveTextContent("Activa");
    expect(within(cyber).getByRole("link", { name: "Editar" })).toHaveAttribute("href", "/packs-promos?editar=c-1");
    expect(within(section).getByTestId("product-promo-c-2")).toHaveTextContent("S/ 127.20antes S/ 159.00");
    expect(within(section).queryByTestId("product-promo-c-3")).not.toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "＋ Nueva promoción" })).toHaveAttribute("href", "/packs-promos?nueva=campana&productos=p1");
    expect(within(section).getByRole("link", { name: "Ver todas" })).toHaveAttribute("href", "/packs-promos");
    expect(getCampaignPrices).toHaveBeenCalledWith({ storeId: "s1", channels: ["CATALOGO_WEB", "POWIP_CRM"], productIds: ["p1"] }, expect.anything());
  });
});
