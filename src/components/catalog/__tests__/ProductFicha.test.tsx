import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductFicha from "@/components/catalog/ficha/ProductFicha";
import {
  getCatalogProduct,
  getProductVariants,
  updateCatalogProduct,
  updateCatalogVariant,
  type CatalogProductDetail,
  type CatalogVariantDetail,
} from "@/services/catalogProductService";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { getVariantCosts, setVariantCosts } from "@/services/purchasesService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), usePathname: () => "/productos/p1" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
let role = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role }, company: { id: "c1" } } }) }));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn(), setVariantCosts: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["s1"], canFetch: true }) }));
// FEAT-24 H6: mock manual (sin filtro por defecto); el filtro por almacén tiene su propio test.
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "inv-1", name: "Principal", storeId: "s1" }], isSuccess: true, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: () => ({ brands: [{ id: "nike", name: "Nike" }], isLoading: false, createBrand: jest.fn() }) }));
jest.mock("@/hooks/useCatalogCategories", () => ({
  useCatalogCategories: () => ({
    tree: [{ id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [{ id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [] }] }],
    isLoading: false, error: null,
  }),
}));
jest.mock("@/services/catalogProductService", () => ({
  getCatalogProduct: jest.fn(), getProductVariants: jest.fn(), updateCatalogProduct: jest.fn(), updateCatalogVariant: jest.fn(),
}));
jest.mock("@/services/businessInventoryItemsService", () => ({ fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
// FEAT-32 M1: la pestaña Contenido tiene su propio test; acá solo que se abre desde General.
jest.mock("@/components/catalog/ficha/FichaContentTab", () => ({ __esModule: true, default: ({ productId }: { productId: string }) => <div data-testid="content-tab">contenido de {productId}</div> }));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({
  PrintLabelsDialog: ({ source }: { source: { productIds: string[]; title?: string } }) => <div>etiquetas de {source.productIds.join(",")} · {source.title}</div>,
}));
// FEAT-24 H13-D4: la tarjeta de precio por proveedor tiene su propio test; acá solo qué variantes recibe.
jest.mock("@/components/compras/supplier-prices/FichaSupplierPrices", () => ({
  __esModule: true,
  default: ({ variants, linkOrders }: { variants: Array<{ id: string; label: string }>; linkOrders?: boolean }) => (
    <div data-testid="supplier-prices">{variants.map((variant) => `${variant.id}=${variant.label}`).join(", ")}{linkOrders ? " · con enlaces" : ""}</div>
  ),
}));
// FEAT-24 H9: la pestaña Pack tiene su propio test.
jest.mock("@/components/packs/PackFichaTab", () => ({ __esModule: true, default: () => <div data-testid="pack-tab">componentes del pack</div> }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({
  MovementHistoryTable: ({ variants, title }: { variants?: Array<{ id: string; label: string }>; title?: string }) => (
    <div data-testid="kardex">{title}: {variants?.map((variant) => `${variant.id}=${variant.label}`).join(", ")}</div>
  ),
}));

const conflict409 = (message: string) =>
  new AxiosError("409", "ERR", undefined, undefined, { status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

const POLO: CatalogProductDetail = {
  id: "p1", companyId: "c1", name: "Polo básico", sku: "ROPPOL-1", companySku: "POL0001", status: true, type: "variantes",
  brandId: "nike", categoryId: "pol", imageUrl: null, purchaseUnit: null, purchaseFactor: 1, externalSource: "shopify", externalId: "998",
};
const POLO_VARIANTS: CatalogVariantDetail[] = [
  { id: "v1", sku: "INT-1", companySku: "POL0001-S", attributeValues: { Talla: "S" }, isActive: true, barcode: null, powipEan: "2000000000017", linkedSources: ["shopify"], shopifySku: "SH-S" },
  { id: "v2", sku: "INT-2", companySku: "POL0001-M", attributeValues: { Talla: "M" }, isActive: true, skuConflict: true, linkedSources: [] },
];
const item = (variantId: string, physical: number, reserved: number): BusinessInventoryItem => ({
  inventoryItemId: `ii-${variantId}`, productId: "p1", variantId, productName: "Polo básico", sku: "x", price: 0,
  physicalStock: physical, reservedStock: reserved, availableStock: physical - reserved, inventoryId: "inv-1", inventoryName: "Principal", storeId: "s1",
});

function renderFicha() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProductFicha productId="p1" /></QueryClientProvider>);
}

describe("Ficha del producto en pestañas (FEAT-24 H4-D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    role = "ADMINISTRADOR";
    jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "v1", averageCost: 12.5 }, { variantId: "v2", averageCost: null }]);
    jest.mocked(getCatalogProduct).mockResolvedValue(POLO);
    jest.mocked(getProductVariants).mockResolvedValue(POLO_VARIANTS);
    jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([item("v1", 10, 2), item("v2", 5, 0)]);
    jest.mocked(updateCatalogProduct).mockResolvedValue({});
    jest.mocked(updateCatalogVariant).mockResolvedValue({});
  });

  it("muestra la cabecera y las cinco pestañas de un producto con variantes", async () => {
    renderFicha();
    expect(await screen.findByRole("heading", { name: "Polo básico" })).toBeInTheDocument();
    expect(screen.getByText("Ropa › Polos")).toBeInTheDocument();
    expect(screen.getAllByText("SKU repetido").length).toBeGreaterThan(0);
    for (const name of ["General", "Variantes (2)", "Stock por almacén", "Canales", "Historial"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Editar opciones y precios" })).toHaveAttribute("href", "/productos?edit=v1");
  });

  it("FEAT-32 M1: General ya no edita foto ni descripción y lleva a la pestaña Contenido (que queda montada)", async () => {
    const user = userEvent.setup();
    renderFicha();
    expect(await screen.findByText(/ahora están en la pestaña/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Descripción")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Foto principal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("content-tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ir a Contenido →" }));
    expect(screen.getByRole("tab", { name: /Contenido/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("content-tab")).toHaveTextContent("contenido de p1");
    await user.click(screen.getByRole("tab", { name: "General" }));
    // Sigue montada (no pierde el borrador), oculta por `data-[state=inactive]:hidden`.
    expect(screen.getByTestId("content-tab").closest('[role="tabpanel"]')).toHaveAttribute("data-state", "inactive");
  });

  it("precio de compra por proveedor: recibe las variantes del producto (FEAT-24 H13-D4)", async () => {
    renderFicha();
    expect(await screen.findByTestId("supplier-prices")).toHaveTextContent("v1=Talla: S (POL0001-S), v2=Talla: M (POL0001-M) · con enlaces");
  });

  it("un pack tiene su pestaña Pack y no muestra el precio de compra por proveedor (FEAT-24 H9 + H13)", async () => {
    jest.mocked(getCatalogProduct).mockResolvedValue({ ...POLO, name: "Pack Verano", type: "pack", externalSource: null });
    jest.mocked(getProductVariants).mockResolvedValue([{ id: "pk1", sku: "INT-PK", companySku: "PK-VER", barcode: "", attributeValues: { Title: "Default Title" }, isActive: true }]);
    renderFicha();
    expect(await screen.findByRole("heading", { name: "Pack Verano" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pack" })).toBeInTheDocument();
    expect(screen.queryByTestId("supplier-prices")).not.toBeInTheDocument();
  });

  it("General: guarda solo lo que cambió (categoría, unidad de compra y factor)", async () => {
    const user = userEvent.setup();
    renderFicha();
    await screen.findByRole("heading", { name: "Polo básico" });
    await user.selectOptions(screen.getByLabelText("Categoría"), "ropa");
    await user.type(screen.getByLabelText("Unidad de compra"), "Caja");
    await user.clear(screen.getByLabelText("Factor"));
    await user.type(screen.getByLabelText("Factor"), "12");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", { categoryId: "ropa", purchaseUnit: "Caja", purchaseFactor: 12 }));
    expect(updateCatalogVariant).not.toHaveBeenCalled();
  });

  it("General: el 409 del SKU base se muestra debajo del campo", async () => {
    jest.mocked(updateCatalogProduct).mockRejectedValue(conflict409("El SKU GOR0001 ya existe en tu empresa (producto «Gorra»)"));
    const user = userEvent.setup();
    renderFicha();
    await screen.findByRole("heading", { name: "Polo básico" });
    await user.clear(screen.getByLabelText("SKU base"));
    await user.type(screen.getByLabelText("SKU base"), "GOR0001");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El SKU GOR0001 ya existe en tu empresa (producto «Gorra»)");
  });

  it("Variantes: renombra el SKU, muestra el 409 en la fila y avisa del SKU repetido", async () => {
    jest.mocked(updateCatalogVariant).mockRejectedValueOnce(conflict409("El SKU POL0001-S ya existe en tu empresa (producto «Polo básico»)"));
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole("tab", { name: "Variantes (2)" }));
    const rowM = screen.getByText("Talla: M").closest("tr")!;
    expect(within(rowM).getByText("SKU repetido")).toBeInTheDocument();
    expect(screen.queryByText(/Default Title/)).not.toBeInTheDocument();

    const sku = within(rowM).getByLabelText("SKU de Talla: M");
    await user.clear(sku);
    await user.type(sku, "POL0001-S2");
    await user.click(within(rowM).getByRole("button", { name: "Guardar" }));
    expect(await within(rowM).findByRole("alert")).toHaveTextContent("ya existe en tu empresa");
    expect(updateCatalogVariant).toHaveBeenCalledWith("v2", { companySku: "POL0001-S2" });

    await user.type(within(rowM).getByLabelText("Código de barras de Talla: M"), "7750000000012");
    await user.click(within(rowM).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(updateCatalogVariant).toHaveBeenLastCalledWith("v2", { companySku: "POL0001-S2", barcode: "7750000000012" }));
  });

  it("Variantes: no manda dos variantes del producto con el mismo SKU", async () => {
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole("tab", { name: "Variantes (2)" }));
    const rowM = screen.getByText("Talla: M").closest("tr")!;
    const sku = within(rowM).getByLabelText("SKU de Talla: M");
    await user.clear(sku);
    await user.type(sku, "pol0001-s");
    await user.click(within(rowM).getByRole("button", { name: "Guardar" }));
    expect(await within(rowM).findByRole("alert")).toHaveTextContent("Otra variante de este producto tiene el mismo SKU.");
    expect(updateCatalogVariant).not.toHaveBeenCalled();
  });

  it("Stock por almacén: físico, reservado y disponible, sin tránsito si no llega", async () => {
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole("tab", { name: "Stock por almacén" }));
    const row = (await screen.findByText("Talla: S")).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Talla: S", "POL0001-S", "Principal", "10", "2", "8"]);
    expect(screen.queryByText("En tránsito")).not.toBeInTheDocument();
    expect(screen.getByText("Total").closest("tr")).toHaveTextContent("1521");
  });

  it("Canales: origen Shopify y canal unido por variante", async () => {
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole("tab", { name: "Canales" }));
    expect(await screen.findByText(/Importado desde Shopify \(ID 998\)/)).toBeInTheDocument();
    expect(screen.getByText("SH-S")).toBeInTheDocument();
    expect(screen.getByText("Sin canal (solo POWIP)")).toBeInTheDocument();
  });

  it("Historial: el kardex de la fachada se elige por variante del producto (FEAT-24 H10)", async () => {
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole("tab", { name: "Historial" }));
    expect(await screen.findByTestId("kardex")).toHaveTextContent("Historial (kardex): v1=Talla: S (POL0001-S), v2=Talla: M (POL0001-M)");
  });

  describe("costo manual en la ficha (FEAT-24 H10)", () => {
    it("el Administrador ve el costo promedio y carga el que falta con operationId", async () => {
      jest.mocked(setVariantCosts).mockResolvedValue({ items: [{ variantId: "v2", averageCost: 9.9 } as never], duplicate: false });
      const user = userEvent.setup();
      renderFicha();
      await user.click(await screen.findByRole("tab", { name: "Variantes (2)" }));
      expect(screen.getByRole("columnheader", { name: "Costo prom." })).toBeInTheDocument();
      expect(await screen.findByText("S/ 12.50")).toBeInTheDocument();
      const rowM = screen.getByText("Talla: M").closest("tr")!;
      expect(within(rowM).getByText("Sin costo")).toBeInTheDocument();
      await user.click(within(rowM).getByRole("button", { name: "Cargar costo promedio" }));
      await user.type(within(rowM).getByLabelText("Costo promedio sin IGV"), "9.9");
      await user.click(within(rowM).getByRole("button", { name: "Guardar costo" }));
      await waitFor(() => expect(setVariantCosts).toHaveBeenCalledWith({ items: [{ variantId: "v2", averageCost: 9.9 }], reason: "Carga manual desde la ficha", operationId: expect.any(String) }));
      expect(await within(rowM).findByText("S/ 9.90")).toBeInTheDocument();
      expect(getVariantCosts).toHaveBeenCalledWith(["v1", "v2"]);
    });

    it("Operaciones lo ve sin poder cambiarlo", async () => {
      role = "OPERACIONES";
      const user = userEvent.setup();
      renderFicha();
      await user.click(await screen.findByRole("tab", { name: "Variantes (2)" }));
      expect(await screen.findByText("S/ 12.50")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cargar costo promedio" })).not.toBeInTheDocument();
    });

    it("sin rol de costos no se pide ni se muestra", async () => {
      role = "VENTAS";
      const user = userEvent.setup();
      renderFicha();
      await user.click(await screen.findByRole("tab", { name: "Variantes (2)" }));
      expect(screen.queryByRole("columnheader", { name: "Costo prom." })).not.toBeInTheDocument();
      expect(getVariantCosts).not.toHaveBeenCalled();
    });

    it("producto simple: el costo va en General", async () => {
      jest.mocked(getCatalogProduct).mockResolvedValue({ ...POLO, name: "Taza", type: "simple", externalSource: null });
      jest.mocked(getProductVariants).mockResolvedValue([{ id: "t1", sku: "INT-T", companySku: "TAZ0001", barcode: "", attributeValues: { Title: "Default Title" }, isActive: true }]);
      jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "t1", averageCost: 3 }]);
      renderFicha();
      await screen.findByRole("heading", { name: "Taza" });
      expect(await screen.findByTestId("variant-cost-t1")).toHaveTextContent("Costo promedio:S/ 3.00");
    });
  });

  it("producto simple: sin pestaña Variantes; su SKU y su código de barras están en General", async () => {
    jest.mocked(getCatalogProduct).mockResolvedValue({ ...POLO, name: "Taza", type: "simple", externalSource: null });
    jest.mocked(getProductVariants).mockResolvedValue([{ id: "t1", sku: "INT-T", companySku: "TAZ0001", barcode: "", attributeValues: { Title: "Default Title" }, isActive: true }]);
    const user = userEvent.setup();
    renderFicha();
    await screen.findByRole("heading", { name: "Taza" });
    expect(screen.queryByRole("tab", { name: /Variantes/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toHaveValue("TAZ0001");
    await user.type(screen.getByLabelText("Código de barras"), "7751234567890");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updateCatalogVariant).toHaveBeenCalledWith("t1", { barcode: "7751234567890" }));
    expect(updateCatalogProduct).not.toHaveBeenCalled();
  });

  it("Imprimir etiquetas: las variantes del producto (FEAT-24 H7)", async () => {
    const user = userEvent.setup();
    renderFicha();
    await screen.findByRole("heading", { name: "Polo básico" });
    expect(screen.queryByText(/etiquetas de/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Imprimir etiquetas" }));
    expect(screen.getByText("etiquetas de p1 · Polo básico")).toBeInTheDocument();
  });
});
