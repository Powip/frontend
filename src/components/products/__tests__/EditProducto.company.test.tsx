import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditProducto from "../EditProducto";
import { getProductById, updateProduct } from "@/services/productService";
import axiosAuth from "@/lib/axiosAuth";
jest.mock("next/navigation", () => ({ useParams: () => ({ id: "product-a" }), useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "actual-company" }, user: { id: "user-a" } } }) }));
jest.mock("@/services/productService", () => ({ getProductById: jest.fn(), updateProduct: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/services/brandService", () => ({ getBrandsBySupplier: () => Promise.resolve([]) }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
const get = jest.mocked(getProductById);
const update = jest.mocked(updateProduct);
const apiGet = jest.mocked(axiosAuth.get);
const product = { id: "product-a", companyId: "actual-company", name: "Producto propio", sku: "SKU", status: true, description: "", subcategory: { id: "subcategory-a", category: { id: "category-a" } }, supplierId: "supplier-a", brandId: "brand-a" };
beforeEach(() => {
  jest.clearAllMocks(); get.mockResolvedValue(product); update.mockResolvedValue({});
  apiGet.mockImplementation(async (url) => String(url).endsWith("/categories") ? { data: [{ id: "category-a", name: "Categoría", status: true }] } : String(url).includes("/subcategories/category/") ? { data: [{ id: "subcategory-a", name: "Subcategoría", status: true }] } : String(url).includes("/suppliers/company/") ? { data: [] } : { data: { attributes: [] } });
});
it("loads current relations and saves the authenticated company rather than the old fixed tenant", async () => {
  render(<EditProducto />); await screen.findByDisplayValue("Producto propio");
  await screen.findByRole("option", { name: "Subcategoría" });
  expect(apiGet).toHaveBeenCalledWith(expect.stringContaining("/suppliers/company/actual-company"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("product-a", expect.objectContaining({ companyId: "actual-company", categoryId: "category-a", subcategoryId: "subcategory-a" })));
});
it("blocks the form and mutation for a product from another company", async () => {
  get.mockResolvedValue({ ...product, companyId: "foreign-company" }); render(<EditProducto />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no pertenece al negocio activo"));
  expect(screen.queryByRole("button", { name: "Guardar Cambios" })).not.toBeInTheDocument();
  expect(update).not.toHaveBeenCalled(); expect(apiGet).not.toHaveBeenCalled();
});
