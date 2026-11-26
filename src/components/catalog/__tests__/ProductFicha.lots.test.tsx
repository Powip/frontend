/**
 * Tests: «Maneja lotes» en la ficha del producto (FEAT-24 H5-L).
 *
 * 1. La casilla se prende y guarda `tracksLots: true` (y avisa al apagarla).
 * 2. Con IMEI/serie o en un pack queda deshabilitada, con el motivo.
 * 3. Con lotes aparece la pestaña «Lotes y vencimiento».
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductFicha from "@/components/catalog/ficha/ProductFicha";
import {
  getCatalogProduct,
  getProductVariants,
  updateCatalogProduct,
  type CatalogProductDetail,
  type CatalogVariantDetail,
} from "@/services/catalogProductService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { getVariantCosts } from "@/services/purchasesService";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), usePathname: () => "/productos/p1" }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }) }));
jest.mock("@/services/purchasesService", () => ({ getVariantCosts: jest.fn(), setVariantCosts: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scope: "business", storeIds: ["s1"], canFetch: true }) }));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: () => ({ inventories: [{ id: "inv-1", name: "Principal", storeId: "s1" }], isSuccess: true, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: () => ({ brands: [], isLoading: false, createBrand: jest.fn() }) }));
jest.mock("@/hooks/useCatalogCategories", () => ({ useCatalogCategories: () => ({ tree: [], isLoading: false, error: null }) }));
jest.mock("@/services/catalogProductService", () => ({
  getCatalogProduct: jest.fn(), getProductVariants: jest.fn(), updateCatalogProduct: jest.fn(), updateCatalogVariant: jest.fn(),
}));
jest.mock("@/services/businessInventoryItemsService", () => ({ fetchBusinessInventoryItems: jest.fn() }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({ PrintLabelsDialog: () => null }));
jest.mock("@/components/compras/supplier-prices/FichaSupplierPrices", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/packs/PackFichaTab", () => ({
  __esModule: true,
  default: () => <div>componentes del pack</div>,
  PackStockTab: () => null,
  usePack: () => ({ data: undefined, refetch: jest.fn() }),
}));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => null }));
// La pestaña Lotes tiene su propio test.
jest.mock("@/components/lots/FichaLotsTab", () => ({
  __esModule: true,
  default: ({ variants }: { variants: Array<{ id: string }> }) => <div data-testid="lots-tab">lotes de {variants.map((variant) => variant.id).join(",")}</div>,
}));

const CREMA: CatalogProductDetail = {
  id: "p1", companyId: "c1", name: "Crema Centella", sku: "CRE-1", companySku: "CRE", status: true, type: "simple",
  brandId: null, categoryId: null, imageUrl: null, purchaseUnit: null, purchaseFactor: 1, trackingMode: "NONE", tracksLots: false,
};
const VARIANTS: CatalogVariantDetail[] = [{ id: "v1", sku: "INT-1", companySku: "CRE-50", attributeValues: {}, isActive: true }];

function renderFicha() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProductFicha productId="p1" /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getVariantCosts).mockResolvedValue([]);
  jest.mocked(getCatalogProduct).mockResolvedValue(CREMA);
  jest.mocked(getProductVariants).mockResolvedValue(VARIANTS);
  jest.mocked(fetchBusinessInventoryItems).mockResolvedValue([]);
  jest.mocked(updateCatalogProduct).mockResolvedValue({});
});

describe("Maneja lotes (FEAT-24 H5-L)", () => {
  it("se prende y guarda tracksLots: true; sin lotes no hay pestaña Lotes", async () => {
    const user = userEvent.setup();
    renderFicha();
    await screen.findByRole("heading", { name: "Crema Centella" });
    expect(screen.queryByRole("tab", { name: "Lotes y vencimiento" })).not.toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: "Este producto maneja lotes" });
    expect(box).toBeEnabled();
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(screen.getByText(/Al recibir una compra se pide el lote y la fecha de vencimiento/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", { tracksLots: true }));
  });

  it("con lotes: pestaña «Lotes y vencimiento» y aviso al apagarla", async () => {
    const user = userEvent.setup();
    jest.mocked(getCatalogProduct).mockResolvedValue({ ...CREMA, tracksLots: true });
    renderFicha();
    await screen.findByRole("heading", { name: "Crema Centella" });
    await user.click(screen.getByRole("checkbox", { name: "Este producto maneja lotes" }));
    expect(screen.getByText("Apagarlo no borra los lotes que ya tiene el stock: solo deja de pedirlos al recibir.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Lotes y vencimiento" }));
    expect(await screen.findByTestId("lots-tab")).toHaveTextContent("lotes de v1");
  });

  it("con IMEI o serie queda deshabilitada, con el motivo", async () => {
    jest.mocked(getCatalogProduct).mockResolvedValue({ ...CREMA, trackingMode: "IMEI" });
    renderFicha();
    await screen.findByRole("heading", { name: "Crema Centella" });
    expect(screen.getByRole("checkbox", { name: "Este producto maneja lotes" })).toBeDisabled();
    expect(screen.getByText("Un producto con IMEI o serie no maneja lotes.")).toBeInTheDocument();
  });

  it("en un pack queda deshabilitada: los lotes van en sus componentes", async () => {
    jest.mocked(getCatalogProduct).mockResolvedValue({ ...CREMA, name: "Pack Verano", type: "pack" });
    renderFicha();
    await screen.findByRole("heading", { name: "Pack Verano" });
    expect(screen.getByRole("checkbox", { name: "Este producto maneja lotes" })).toBeDisabled();
    expect(screen.getByText("Un pack no maneja lotes: los lotes van en sus componentes.")).toBeInTheDocument();
  });

  it("el 400 del servidor se muestra al guardar", async () => {
    const user = userEvent.setup();
    jest.mocked(updateCatalogProduct).mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { message: "Un producto con IMEI o serie no maneja lotes." } } });
    renderFicha();
    await screen.findByRole("heading", { name: "Crema Centella" });
    await user.click(screen.getByRole("checkbox", { name: "Este producto maneja lotes" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Un producto con IMEI o serie no maneja lotes.");
  });
});
