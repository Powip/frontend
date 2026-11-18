import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";

// FEAT-24 H7 — «Imprimir etiquetas» desde la ficha del producto (solo en edición).

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a", role: "ADMINISTRADOR" }, accessToken: "token" } }),
}));
// FEAT-24 H4: la categoría propia sale de react-query; acá no hace falta.
jest.mock("@/hooks/useCatalogCategories", () => ({ useCatalogCategories: () => ({ tree: [], isLoading: false, error: null }) }));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({
  HeaderConfig: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/products/BrandSelect", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <input aria-label="Marca" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
jest.mock("@/components/products/VariantStatusControl", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({
  PrintLabelsDialog: ({ source }: { source: { productIds: string[]; title?: string } }) => (
    <div>
      etiquetas de {source.productIds.join(",")} · {source.title}
    </div>
  ),
}));

const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);

beforeEach(() => {
  jest.clearAllMocks();
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith("/categories")
      ? [{ id: "category", name: "Categoría A" }]
      : String(url).includes("/subcategories/category/")
        ? [{ id: "subcategory", name: "Subcategoría A" }]
        : String(url).match(/\/subcategories\/[^/]+$/)
          ? { defaultAttributes: [] }
          : String(url).includes("/product-variant/by-product/")
            ? [{ id: "v-1", attributeValues: { Color: "Rojo" }, priceBase: 10, priceVta: 20, isActive: true, mergedInto: null, linkedSources: [] }]
            : [],
  }));
  post.mockImplementation(async (url) => ({
    data: String(url).includes("multiple/by-ids")
      ? [{ id: "v-1", product: { id: "p-1", companyId: "company-a", trackingMode: "NONE", name: "Polo", inventory_id: "warehouse" } }]
      : [{ subcategory: { id: "subcategory", category: { id: "category" } }, brand: { id: "brand-1" } }],
  }));
});

describe("Ficha del producto › Imprimir etiquetas (FEAT-24 H7)", () => {
  it("prints the labels of the product being edited", async () => {
    render(<ProductCreateForm editVariantId="v-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiquetas" }));
    expect(await screen.findByText("etiquetas de p-1 · Polo")).toBeInTheDocument();
  });

  it("is not offered while creating a product", async () => {
    render(<ProductCreateForm />);
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/categories$/)));
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imprimir etiquetas" })).not.toBeInTheDocument();
  });
});
