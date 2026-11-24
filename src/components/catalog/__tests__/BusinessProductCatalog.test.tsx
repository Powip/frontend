import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BusinessProductCatalog from "@/components/products/BusinessProductCatalog";
import { fetchBusinessProducts, type BusinessProduct } from "@/services/businessProductsService";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { getChannelSummary } from "@/services/productChannelsService";
import { listPromotions, type Promotion } from "@/services/promotionsService";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), usePathname: () => "/productos" }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }) }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["s1"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "inv-1", name: "Principal", storeId: "s1" }], isSuccess: true, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: () => ({ brands: [{ id: "nike", name: "Nike" }], isLoading: false, createBrand: jest.fn() }) }));
jest.mock("@/hooks/useCatalogCategories", () => ({
  useCatalogCategories: () => ({
    tree: [{ id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [{ id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [] }] }],
    isLoading: false, error: null,
  }),
}));
jest.mock("@/services/businessProductsService", () => ({ ...jest.requireActual("@/services/businessProductsService"), fetchBusinessProducts: jest.fn() }));
jest.mock("@/services/businessInventoryItemsService", () => ({ ...jest.requireActual("@/services/businessInventoryItemsService"), fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/productChannelsService", () => ({ getChannelSummary: jest.fn() }));
jest.mock("@/services/promotionsService", () => ({ listPromotions: jest.fn() }));

const PRODUCTS: BusinessProduct[] = [
  {
    id: "p1", companyId: "c1", name: "Polo básico", sku: "ROPPOL-1", companySku: "POL0001", status: true, priceVta: 35, brandId: "nike", categoryId: "pol", type: "variantes",
    variants: [{ id: "v1", attributeValues: { Talla: "S" }, skuConflict: true }, { id: "v2", attributeValues: { Talla: "M" } }, { id: "v3", attributeValues: { Talla: "L" }, isActive: false }],
  },
  {
    id: "p2", companyId: "c1", name: "Gorra Shopify", sku: "ACC-2", companySku: "GOR0001", status: true, priceVta: 20, externalSource: "shopify", type: "simple",
    variants: [{ id: "v4", attributeValues: { Title: "Default Title" } }],
  },
];
const stockRow = (productId: string, variantId: string, available: number): BusinessInventoryItem => ({
  inventoryItemId: `ii-${variantId}`, productId, variantId, productName: "x", sku: "x", price: 0, availableStock: available, physicalStock: available, inventoryId: "inv-1", inventoryName: "Principal", storeId: "s1",
});

function renderCatalog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><BusinessProductCatalog onCreate={jest.fn()} /></QueryClientProvider>);
}

describe("Catálogo › Productos (FEAT-24 H4-D)", () => {
  beforeEach(() => {
    jest.mocked(fetchBusinessProducts).mockResolvedValue(PRODUCTS);
    jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([stockRow("p1", "v1", 4), stockRow("p1", "v2", 3)]);
    jest.mocked(getChannelSummary).mockResolvedValue({ channels: [], ownPrices: [] });
    jest.mocked(listPromotions).mockResolvedValue([]);
  });

  it("muestra SKU base, marca, categoría con su ruta, tipo, canal, variantes vivas, disponible y precio en soles", async () => {
    renderCatalog();
    const polo = (await screen.findByText("Polo básico")).closest("tr")!;
    expect(within(polo).getByText("POL0001")).toBeInTheDocument();
    expect(within(polo).getByText("SKU repetido")).toBeInTheDocument();
    expect(within(polo).getByText("Nike")).toBeInTheDocument();
    expect(within(polo).getByText("Ropa › Polos")).toBeInTheDocument();
    expect(within(polo).getByText("Con variantes")).toBeInTheDocument();
    expect(within(polo).getByText("Manual")).toBeInTheDocument();
    expect(within(polo).getByText("2")).toBeInTheDocument();
    expect(within(polo).getByText("7")).toBeInTheDocument();
    expect(within(polo).getByText(/S\/\s*35\.00/)).toBeInTheDocument();
    expect(within(polo).getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", "/productos/p1");

    const gorra = screen.getByText("Gorra Shopify").closest("tr")!;
    expect(within(gorra).getByText("Shopify")).toBeInTheDocument();
    expect(within(gorra).getByText("Simple")).toBeInTheDocument();
    expect(within(gorra).getByText("Sin categoría")).toBeInTheDocument();
    expect(within(gorra).getByText("Sin marca")).toBeInTheDocument();

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Almacén/i)).not.toBeInTheDocument();
  });

  it("filtra por canal, categoría (con su rama), tipo y stock", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByText("Polo básico");

    await user.selectOptions(screen.getByLabelText("Origen"), "shopify");
    expect(screen.queryByText("Polo básico")).not.toBeInTheDocument();
    expect(screen.getByText("Gorra Shopify")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await user.selectOptions(screen.getByLabelText("Categoría"), "ropa");
    expect(screen.getByText("Polo básico")).toBeInTheDocument();
    expect(screen.queryByText("Gorra Shopify")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await user.selectOptions(screen.getByLabelText("Tipo"), "simple");
    expect(screen.queryByText("Polo básico")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await user.selectOptions(screen.getByLabelText("Stock"), "sin");
    expect(screen.getByText("Gorra Shopify")).toBeInTheDocument();
    expect(screen.queryByText("Polo básico")).not.toBeInTheDocument();
  });

  it("FEAT-32 M2: columna Origen y Canales (con su estado), «Varía por canal», leyenda y filtro por canal y estado", async () => {
    jest.mocked(getChannelSummary).mockResolvedValue({
      channels: [
        { productId: "p2", storeId: "s1", channel: "CATALOGO_WEB", active: false, ruleMode: "same" },
        { productId: "p1", storeId: "s1", channel: "POWIP_CRM", active: true, ruleMode: "more" },
      ],
      ownPrices: [],
    });
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByText("Polo básico");
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Origen", "Canales"]));
    expect(headers).not.toContain("Canal");
    const gorra = screen.getByText("Gorra Shopify").closest("tr")!;
    expect(await within(gorra).findByRole("img", { name: "Catálogo web: No activado" })).toBeInTheDocument();
    expect(within(gorra).getByRole("img", { name: "POWIP CRM: Al día" })).toBeInTheDocument();
    expect(within(gorra).getByRole("img", { name: "Shopify: Lo administra Shopify" })).toBeInTheDocument();
    const polo = screen.getByText("Polo básico").closest("tr")!;
    expect(within(polo).getByText("Varía por canal")).toBeInTheDocument();
    expect(within(gorra).queryByText("Varía por canal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Leyenda de canales")).toHaveTextContent("No activado");

    expect(screen.queryByLabelText("Estado en el canal")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Canal"), "CATALOGO_WEB");
    await user.selectOptions(screen.getByLabelText("Estado en el canal"), "no_activado");
    expect(screen.queryByText("Polo básico")).not.toBeInTheDocument();
    expect(screen.getByText("Gorra Shopify")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Estado en el canal"), "al_dia");
    expect(screen.getByText("Polo básico")).toBeInTheDocument();
    expect(screen.queryByText("Gorra Shopify")).not.toBeInTheDocument();
  });

  it("enlaza a Catálogo › Categorías", async () => {
    renderCatalog();
    await screen.findByText("Polo básico");
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute("href", "/productos/categorias");
  });
});

describe("Lista de productos — FEAT-32 M3 (§7.1)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(fetchBusinessProducts).mockResolvedValue(PRODUCTS);
    jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([]);
    jest.mocked(getChannelSummary).mockResolvedValue({ channels: [], ownPrices: [] });
  });

  it("la campaña activa se ve bajo el precio; una programada o terminada, no", async () => {
    const base = {
      type: "CAMPAIGN", isActive: true, channels: ["POWIP_CRM"], storeIds: [], allProducts: false, combinable: false,
      discountType: "FINAL", discountValue: 29, manualPrices: [], products: [{ productId: "p1", discountType: null, discountValue: null }],
    };
    jest.mocked(listPromotions).mockResolvedValue([
      { ...base, id: "c-1", name: "Precio especial del chat", startsAt: "2020-01-01T05:00:00Z", endsAt: "2099-01-01T05:00:00Z" },
      { ...base, id: "c-2", name: "Navidad", startsAt: "2099-12-20T05:00:00Z", endsAt: "2099-12-26T05:00:00Z" },
      { ...base, id: "c-3", name: "Vieja", startsAt: "2020-01-01T05:00:00Z", endsAt: "2020-02-01T05:00:00Z" },
    ] as unknown as Promotion[]);
    renderCatalog();
    const polo = (await screen.findByText("Polo básico")).closest("tr")!;
    expect(await within(polo).findByText("Precio especial del chat Precio final S/ 29.00")).toBeInTheDocument();
    expect(within(polo).queryByText(/Navidad/)).not.toBeInTheDocument();
    expect(within(polo).queryByText(/Vieja/)).not.toBeInTheDocument();
    expect(within(screen.getByText("Gorra Shopify").closest("tr")!).queryByText(/Precio especial/)).not.toBeInTheDocument();
  });

  it("con productos marcados aparece la barra con «Quitar selección» y «％ Crear promoción»", async () => {
    const user = userEvent.setup();
    jest.mocked(listPromotions).mockResolvedValue([]);
    renderCatalog();
    await user.click(await screen.findByRole("checkbox", { name: "Seleccionar Polo básico" }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar Gorra Shopify" }));
    const bar = screen.getByRole("region", { name: "Productos seleccionados" });
    expect(bar).toHaveTextContent("2 productos seleccionados");
    await user.click(within(bar).getByRole("button", { name: "％ Crear promoción" }));
    expect(mockPush).toHaveBeenCalledWith("/packs-promos?nueva=campana&productos=p1,p2");
    await user.click(within(bar).getByRole("button", { name: "Quitar selección" }));
    expect(screen.queryByRole("region", { name: "Productos seleccionados" })).not.toBeInTheDocument();
  });
});
