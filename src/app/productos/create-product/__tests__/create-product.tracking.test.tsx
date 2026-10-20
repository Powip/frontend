import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "company-a" }, user: { id: "user-a" }, accessToken: "token" },
  }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(axiosAuth.get)
    .mockImplementation(async (url) => ({
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
it.each(["NONE", "IMEI"])("creates %s with compatible stock and tracking payload", async (mode) => {
  render(<ProductCreateForm />);
  expect(screen.getByLabelText("Control de unidades")).toHaveValue("NONE");
  const category = await screen.findByRole("option", { name: "Categoría A" });
  fireEvent.change(category.closest("select")!, { target: { value: "category" } });
  const subcategory = await screen.findByRole("option", { name: "Subcategoría A" });
  fireEvent.change(subcategory.closest("select")!, { target: { value: "subcategory" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Celular" } });
  fireEvent.click(screen.getByRole("button", { name: "Agregar atributo" }));
  fireEvent.change(screen.getByText("Nombre del atributo").parentElement!.querySelector("input")!, {
    target: { value: "Color" },
  });
  fireEvent.change(screen.getByPlaceholderText("Ej: S, M, L, XL"), { target: { value: "Negro" } });
  fireEvent.click(screen.getByRole("button", { name: "Generar variantes" }));
  fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });
  if (mode === "IMEI") {
    fireEvent.change(screen.getByLabelText("Control de unidades"), { target: { value: mode } });
    expect(screen.getByLabelText("Stock")).toHaveValue(0);
    expect(screen.getByLabelText("Stock")).toBeDisabled();
  }
  fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
  await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledTimes(1));
  const [url, payload] = jest.mocked(axiosAuth.post).mock.calls[0];
  expect(String(url)).toMatch(/\/products\/with-variants$/);
  expect(payload).toHaveProperty("variants.0.stock", mode === "IMEI" ? 0 : 5);
  if (mode === "IMEI") expect(payload).toHaveProperty("trackingMode", "IMEI");
  else expect(payload).not.toHaveProperty("trackingMode");
});
