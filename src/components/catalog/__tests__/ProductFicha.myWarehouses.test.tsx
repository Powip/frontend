/**
 * Tests: la ficha del producto muestra solo los almacenes del usuario (FEAT-24 H6, `useMyWarehouses`).
 *
 * 1. Stock por almacén: se lee y se muestra solo lo de los almacenes que ve.
 * 2. Historial (kardex): el selector recibe solo esos almacenes.
 * 3. Pack (Componentes y Stock por almacén): el disponible por almacén y su total, solo con esos almacenes.
 * 4. Sin asignaciones (o si /me/warehouses falla) no se filtra nada.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductFicha from "@/components/catalog/ficha/ProductFicha";
import PackFichaTab, { PackStockTab, visiblePackAvailability } from "@/components/packs/PackFichaTab";
import { getCatalogProduct, getProductVariants, type CatalogProductDetail, type CatalogVariantDetail } from "@/services/catalogProductService";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { getPack, type PackView } from "@/services/packsService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), usePathname: () => "/productos/p1" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ALMACEN" }, company: { id: "c1" } } }) }));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["s1"], canFetch: true }) }));
jest.mock("@/hooks/useBusinessInventories", () => ({
  useBusinessInventories: () => ({
    inventories: [
      { id: "inv-1", name: "Principal", storeId: "s1" },
      { id: "inv-2", name: "Surco", storeId: "s1" },
    ],
    isSuccess: true, isPending: false, error: null, refetch: jest.fn(),
  }),
}));
jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: () => ({ brands: [], isLoading: false, createBrand: jest.fn() }) }));
jest.mock("@/hooks/useCatalogCategories", () => ({ useCatalogCategories: () => ({ tree: [], isLoading: false, error: null }) }));
jest.mock("@/services/catalogProductService", () => ({
  getCatalogProduct: jest.fn(), getProductVariants: jest.fn(), updateCatalogProduct: jest.fn(), updateCatalogVariant: jest.fn(),
}));
jest.mock("@/services/businessInventoryItemsService", () => ({ fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn().mockResolvedValue([]), setVariantCosts: jest.fn() }));
jest.mock("@/services/packsService", () => ({ ...jest.requireActual("@/services/packsService"), getPack: jest.fn() }));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({ PrintLabelsDialog: () => null }));
jest.mock("@/components/compras/supplier-prices/FichaSupplierPrices", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({
  MovementHistoryTable: ({ inventories, scopeReady }: { inventories?: Array<{ id: string; name: string }>; scopeReady?: boolean }) => (
    <div data-testid="kardex">{scopeReady ? "listo" : "esperando"}: {inventories?.map((inventory) => inventory.name).join(", ")}</div>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const POLO: CatalogProductDetail = {
  id: "p1", companyId: "c1", name: "Polo básico", sku: "ROPPOL-1", companySku: "POL0001", status: true, type: "simple",
  brandId: null, categoryId: null, imageUrl: null, purchaseUnit: null, purchaseFactor: 1, externalSource: null, externalId: null,
};
const VARIANTS: CatalogVariantDetail[] = [{ id: "v1", sku: "INT-1", companySku: "POL0001", attributeValues: {}, isActive: true, linkedSources: [] }];
const item = (inventoryId: string, inventoryName: string, physical: number): BusinessInventoryItem => ({
  inventoryItemId: `ii-${inventoryId}`, productId: "p1", variantId: "v1", productName: "Polo básico", sku: "x", price: 0,
  physicalStock: physical, reservedStock: 0, availableStock: physical, inventoryId, inventoryName, storeId: "s1",
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMyWarehouses({ all: false, inventoryIds: ["inv-1"], operableIds: ["inv-1"] });
  jest.mocked(getCatalogProduct).mockResolvedValue(POLO);
  jest.mocked(getProductVariants).mockResolvedValue(VARIANTS);
  // Aunque llegara stock de otro almacén (p. ej. por caché), la ficha no lo muestra.
  jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([item("inv-1", "Principal", 7), item("inv-2", "Surco", 4)]);
});

describe("Ficha del producto por almacenes del usuario (FEAT-24 H6)", () => {
  it("el stock por almacén se lee y se muestra solo de los almacenes que ve", async () => {
    const user = userEvent.setup();
    wrap(<ProductFicha productId="p1" />);
    await user.click(await screen.findByRole("tab", { name: "Stock por almacén" }));
    await waitFor(() => expect(fetchBusinessInventoryItems).toHaveBeenCalled());
    expect(jest.mocked(fetchBusinessInventoryItems).mock.calls[0][0].inventories.map((inventory) => inventory.id)).toEqual(["inv-1"]);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Principal")).toBeInTheDocument();
    expect(within(table).queryByText("Surco")).not.toBeInTheDocument();
  });

  it("el historial (kardex) ofrece solo esos almacenes", async () => {
    const user = userEvent.setup();
    wrap(<ProductFicha productId="p1" />);
    await user.click(await screen.findByRole("tab", { name: "Historial" }));
    expect(await screen.findByTestId("kardex")).toHaveTextContent("listo: Principal");
    expect(screen.getByTestId("kardex")).not.toHaveTextContent("Surco");
  });

  it("sin asignaciones no se filtra nada", async () => {
    __setMyWarehouses({ all: true, inventoryIds: [], operableIds: [] });
    const user = userEvent.setup();
    wrap(<ProductFicha productId="p1" />);
    await user.click(await screen.findByRole("tab", { name: "Historial" }));
    expect(await screen.findByTestId("kardex")).toHaveTextContent("listo: Principal, Surco");
  });
});

describe("Pack por almacenes del usuario (FEAT-24 H6, FEAT-32 M5)", () => {
  const PACK: PackView = {
    id: "pk", variantId: "vpk", name: "Kit", description: null, sku: "KIT", productSku: "KIT", powipEan: null, barcode: null, imageUrl: null,
    price: 50, active: true, categoryId: null, brandId: null, components: [],
    available: {
      total: 9,
      byWarehouse: [
        { inventoryId: "inv-1", inventoryName: "Principal", storeId: "s1", available: 2, limiting: { productId: "p-gorra", variantId: "v-gorra", label: "Gorra" } },
        { inventoryId: "inv-2", inventoryName: "Surco", storeId: "s1", available: 7 },
      ],
    },
  };

  it("Componentes: el disponible total sale solo de los almacenes que ve", async () => {
    jest.mocked(getPack).mockResolvedValue(PACK);
    wrap(<PackFichaTab productId="pk" />);
    expect(await screen.findByText(/^Disponible:/)).toHaveTextContent(/^Disponible: 2$/);
  });

  it("Stock por almacén: el disponible calculado de cada almacén que ve, con el componente que limita", async () => {
    jest.mocked(getPack).mockResolvedValue(PACK);
    wrap(<PackStockTab productId="pk" />);
    const table = await screen.findByRole("table", { name: "Disponible por almacén" });
    const rows = within(table).getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual(["AlmacénDisponible (calculado)Limita", "Principal2Gorra", "Total2"]);
    expect(table).not.toHaveTextContent("Surco");
    expect(screen.getByTestId("pack-stock-total")).toHaveTextContent("2");
  });

  it("visiblePackAvailability deja igual el disponible si ve todo, y respeta el «sin dato»", () => {
    expect(visiblePackAvailability(PACK.available, () => true)).toBe(PACK.available);
    expect(visiblePackAvailability(null, () => false)).toBeNull();
    expect(visiblePackAvailability(PACK.available, (id) => id === "inv-2")).toEqual({ total: 7, byWarehouse: [PACK.available!.byWarehouse[1]] });
  });
});
