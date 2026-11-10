/**
 * C1 · el costo (Precio base) lo ven y lo escriben solo Administrador y Operaciones. Quien no lo ve
 * crea el producto con el precio de venta y las variantes quedan con costo 0 (el servidor lo acepta).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";

let mockRole = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "company-a" }, user: { id: "user-a", role: mockRole, permissions: [] }, accessToken: "token" },
  }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/components/products/BrandSelect", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void; disabled?: boolean }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange(e.target.value)} disabled={disabled}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(axiosAuth.get).mockImplementation(async (url) => ({
    data: String(url).endsWith("/categories")
      ? [{ id: "category", name: "Categoría A" }]
      : String(url).includes("/subcategories/category/")
        ? [{ id: "subcategory", name: "Subcategoría A" }]
        : String(url).endsWith("/subcategories/subcategory")
          ? { defaultAttributes: [] }
          : [],
  }));
  jest.mocked(axiosAuth.post).mockResolvedValue({ data: { productId: "product" } });
});

async function buildVariant() {
  render(<ProductCreateForm />);
  const category = await screen.findByRole("option", { name: "Categoría A" });
  fireEvent.change(category.closest("select")!, { target: { value: "category" } });
  const subcategory = await screen.findByRole("option", { name: "Subcategoría A" });
  fireEvent.change(subcategory.closest("select")!, { target: { value: "subcategory" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Celular" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar atributo" }));
  fireEvent.change(screen.getByText("Nombre del atributo").parentElement!.querySelector("input")!, { target: { value: "Color" } });
  fireEvent.change(screen.getByPlaceholderText("Ej: S, M, L, XL"), { target: { value: "Negro" } });
  fireEvent.click(screen.getByRole("button", { name: "Generar variantes" }));
}

describe.each([["ADMINISTRADOR"], ["OPERACIONES"]])("%s ve y escribe el costo", (role) => {
  beforeEach(() => {
    mockRole = role;
  });

  it("muestra Precio base y lo exige", async () => {
    await buildVariant();
    expect(screen.getByLabelText("Precio base")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    expect(toast.error).toHaveBeenCalledWith("Todas las variantes deben tener precio base y precio venta mayor a 0.");
    expect(axiosAuth.post).not.toHaveBeenCalled();
  });

  it("envía el costo escrito", async () => {
    await buildVariant();
    fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledTimes(1));
    expect(jest.mocked(axiosAuth.post).mock.calls[0][1]).toHaveProperty("variants.0.priceBase", 10);
  });
});

describe.each([
  ["Ventas", "VENTAS"],
  ["CALLER", "CALLER"],
  ["rol personalizado", "CUSTOM_ventas-operaciones"],
])("%s no ve el costo", (_nombre, role) => {
  beforeEach(() => {
    mockRole = role;
  });

  it("no muestra Precio base ni lo pide", async () => {
    await buildVariant();
    expect(screen.queryByLabelText("Precio base")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Precio venta")).toBeInTheDocument();
  });

  it("crea el producto solo con el precio de venta y costo 0", async () => {
    await buildVariant();
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledTimes(1));
    const payload = jest.mocked(axiosAuth.post).mock.calls[0][1];
    expect(payload).toHaveProperty("variants.0.priceBase", 0);
    expect(payload).toHaveProperty("variants.0.priceVta", 15);
  });

  it("sigue exigiendo el precio de venta", async () => {
    await buildVariant();
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    expect(toast.error).toHaveBeenCalledWith("Todas las variantes deben tener precio de venta mayor a 0.");
    expect(axiosAuth.post).not.toHaveBeenCalled();
  });
});
