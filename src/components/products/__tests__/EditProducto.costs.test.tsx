/**
 * C1 · "Precio Compra" (el costo) en la edición del producto lo ven solo Administrador y Operaciones.
 * Antes solo se ocultaba al rol 'VENTAS' (comparación de texto), y CALLER y los roles personalizados lo veían.
 */
import { render, screen } from "@testing-library/react";
import EditProducto from "../EditProducto";
import { getProductById, updateProduct } from "@/services/productService";
import axiosAuth from "@/lib/axiosAuth";

let mockRole = "ADMINISTRADOR";
jest.mock("next/navigation", () => ({ useParams: () => ({ id: "product-a" }), useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "actual-company" }, user: { id: "user-a", role: mockRole, permissions: [] } } }),
}));
jest.mock("@/services/productService", () => ({ getProductById: jest.fn(), updateProduct: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/components/products/BrandSelect", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));

const product = {
  id: "product-a", companyId: "actual-company", name: "Producto propio", sku: "SKU", status: true, description: "",
  priceBase: 40, priceVta: 90,
  subcategory: { id: "subcategory-a", category: { id: "category-a" } }, brandId: "brand-a",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getProductById).mockResolvedValue(product);
  jest.mocked(updateProduct).mockResolvedValue({});
  jest.mocked(axiosAuth.get).mockImplementation(async (url) =>
    String(url).endsWith("/categories")
      ? { data: [{ id: "category-a", name: "Categoría", status: true }] }
      : String(url).includes("/subcategories/category/")
        ? { data: [{ id: "subcategory-a", name: "Subcategoría", status: true }] }
        : { data: { attributes: [] } },
  );
});

describe("EditProducto · costo según el rol", () => {
  it.each([["ADMINISTRADOR"], ["OPERACIONES"]])("%s ve Precio Compra con su valor", async (role) => {
    mockRole = role;
    render(<EditProducto />);
    await screen.findByDisplayValue("Producto propio");
    expect(screen.getByText("Precio Compra*")).toBeInTheDocument();
    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
  });

  it.each([
    ["Ventas", "VENTAS"],
    ["CALLER", "CALLER"],
    ["Agentes", "AGENTES"],
    ["rol personalizado Ventas + Operaciones", "CUSTOM_ventas-operaciones"],
  ])("%s NO ve Precio Compra ni su valor, pero sí Precio Venta", async (_nombre, role) => {
    mockRole = role;
    render(<EditProducto />);
    await screen.findByDisplayValue("Producto propio");
    expect(screen.queryByText("Precio Compra*")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("40")).not.toBeInTheDocument();
    expect(screen.getByText("Precio Venta*")).toBeInTheDocument();
    expect(screen.getByDisplayValue("90")).toBeInTheDocument();
  });
});
