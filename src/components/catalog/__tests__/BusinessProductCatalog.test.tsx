import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BusinessProductCatalog from "@/components/products/BusinessProductCatalog";
import { fetchBusinessProducts, type BusinessProduct } from "@/services/businessProductsService";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), usePathname: () => "/productos" }));
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

    await user.selectOptions(screen.getByLabelText("Canal"), "shopify");
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

  it("enlaza a Catálogo › Categorías", async () => {
    renderCatalog();
    await screen.findByText("Polo básico");
    expect(screen.getByRole("link", { name: "Categorías" })).toHaveAttribute("href", "/productos/categorias");
  });
});
