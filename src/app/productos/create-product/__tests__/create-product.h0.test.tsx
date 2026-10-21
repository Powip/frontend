import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a" }, accessToken: "token" } }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/products/BrandSelect", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <input aria-label="Marca" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
jest.mock("@/components/products/VariantStatusControl", () => ({
  __esModule: true,
  default: ({ variant }: { variant: { id: string; mergedInto?: string | null; mergedIntoSku?: string | null } }) =>
    variant.mergedInto ? <span>Unificada con {variant.mergedIntoSku}</span> : <button type="button">Desactivar</button>,
}));
jest.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean }) => (
    <select value={value ?? ""} onChange={(event) => onValueChange(event.target.value)} disabled={disabled}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);
const patch = jest.mocked(axiosAuth.patch);

function mockCatalog(byProduct: unknown[] = []) {
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith("/categories")
      ? [{ id: "category", name: "Categoría A" }]
      : String(url).includes("/subcategories/category/")
        ? [{ id: "subcategory", name: "Subcategoría A" }]
        : String(url).match(/\/subcategories\/[^/]+$/)
          ? { defaultAttributes: [] }
          : String(url).includes("/product-variant/by-product/")
            ? byProduct
            : [],
  }));
}

async function fillNewProduct(stock: string) {
  render(<ProductCreateForm />);
  const category = await screen.findByRole("option", { name: "Categoría A" });
  fireEvent.change(category.closest("select")!, { target: { value: "category" } });
  const subcategory = await screen.findByRole("option", { name: "Subcategoría A" });
  fireEvent.change(subcategory.closest("select")!, { target: { value: "subcategory" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Polo" } });
  fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "brand-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar atributo" }));
  fireEvent.change(screen.getByText("Nombre del atributo").parentElement!.querySelector("input")!, { target: { value: "Color" } });
  fireEvent.change(screen.getByPlaceholderText("Ej: S, M, L, XL"), { target: { value: "Rojo" } });
  fireEvent.click(screen.getByRole("button", { name: "Generar variantes" }));
  fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText("Stock"), { target: { value: stock } });
}

describe("Ficha del producto (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog();
    post.mockResolvedValue({ data: { productId: "product" } });
    patch.mockResolvedValue({ data: {} });
  });

  it("no tiene proveedor y manda la marca sin supplierId", async () => {
    await fillNewProduct("5");
    expect(screen.queryByText(/Proveedor/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [, payload] = post.mock.calls[0];
    expect(payload).not.toHaveProperty("supplierId");
    expect(payload).toHaveProperty("brandId", "brand-1");
    expect(get.mock.calls.some(([url]) => String(url).includes("/suppliers"))).toBe(false);
  });

  it("stock inicial mayor que 10.000 no se envía", async () => {
    await fillNewProduct("10001");
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La cantidad máxima por variante y almacén es 10,000 unidades."));
    expect(post).not.toHaveBeenCalled();
  });

  it("stock inicial mayor que 1.000 pide confirmar", async () => {
    await fillNewProduct("1500");
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    expect(await screen.findByText("Estás cargando 1,500 unidades. ¿Confirmas la cantidad?")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, confirmar" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  });

  it("en edición: variantes guardadas sin Eliminar, unificada de solo lectura y marca en el PATCH", async () => {
    mockCatalog([
      { id: "v-1", attributeValues: { Color: "Rojo" }, priceBase: 10, priceVta: 20, isActive: true, mergedInto: null, linkedSources: [] },
      { id: "v-2", attributeValues: { Color: "Azul" }, priceBase: 10, priceVta: 20, isActive: false, mergedInto: "v-1", mergedIntoSku: "SKU-1", linkedSources: [] },
    ]);
    post.mockImplementation(async (url) => ({
      data: String(url).includes("multiple/by-ids")
        ? [{ id: "v-1", product: { id: "p-1", companyId: "company-a", trackingMode: "NONE", name: "Polo", inventory_id: "warehouse" } }]
        : [{ subcategory: { id: "subcategory", category: { id: "category" } }, brand: { id: "brand-1" } }],
    }));
    render(<ProductCreateForm editVariantId="v-1" />);
    await screen.findByText("Unificada con SKU-1");
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
    const prices = screen.getAllByLabelText("Precio venta");
    expect(prices[1]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Actualizar|Guardar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const productPatch = patch.mock.calls.find(([url]) => String(url).includes("/products/p-1"));
    expect(productPatch?.[1]).toMatchObject({ brandId: "brand-1" });
    expect(patch.mock.calls.some(([url]) => String(url).includes("/product-variant/v-2"))).toBe(false);
  });
});
