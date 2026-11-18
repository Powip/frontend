/**
 * FEAT-24 H3 — la ficha del producto:
 * 1. Unidad de compra («Caja» × 12) en el alta y en la edición; solo se manda si cambió.
 * 2. Costo promedio por variante (H3-D17): lo ven Administrador y Operaciones; solo el Administrador lo carga
 *    a mano, con PUT /variant-costs y un operationId.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";
import { getVariantCosts, setVariantCosts } from "@/services/purchasesService";

let mockRole = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      company: { id: "company-a" },
      user: { id: "user-a", role: mockRole, permissions: [] },
      accessToken: "token",
    },
  }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({
  HeaderConfig: () => null,
}));
jest.mock("@/components/products/BrandSelect", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/products/VariantStatusControl", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({
  ...jest.requireActual("@/services/purchasesService"),
  getVariantCosts: jest.fn(),
  setVariantCosts: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    >
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);
const patch = jest.mocked(axiosAuth.patch);

// Como la red de verdad: cada respuesta tarda unos milisegundos. La ficha en edición depende de
// que React corra sus efectos entre una carga y la siguiente (si no, al terminar de cargar vacía
// las variantes como si el usuario hubiera cambiado la categoría).
const network = () => new Promise((resolve) => setTimeout(resolve, 20));

function mockCatalog() {
  get.mockImplementation(async (url) => {
    await network();
    return {
      data: String(url).endsWith("/categories")
        ? [{ id: "category", name: "Categoría A" }]
        : String(url).includes("/subcategories/category/")
          ? [{ id: "subcategory", name: "Subcategoría A" }]
          : String(url).match(/\/subcategories\/[^/]+$/)
            ? { defaultAttributes: [] }
            : String(url).includes("/product-variant/by-product/")
              ? [
                  {
                    id: "v-1",
                    sku: "POLO-ROJO",
                    attributeValues: { Color: "Rojo" },
                    priceBase: 10,
                    priceVta: 20,
                    isActive: true,
                    mergedInto: null,
                  },
                  {
                    id: "v-2",
                    sku: "POLO-AZUL",
                    attributeValues: { Color: "Azul" },
                    priceBase: 10,
                    priceVta: 20,
                    isActive: true,
                    mergedInto: null,
                  },
                ]
              : [],
    };
  });
}

function mockEditProduct(purchase: {
  purchaseUnit: string | null;
  purchaseFactor: number;
}) {
  post.mockImplementation(async (url) => {
    await network();
    return {
      data: String(url).includes("multiple/by-ids")
        ? [
            {
              id: "v-1",
              product: {
                id: "p-1",
                companyId: "company-a",
                trackingMode: "NONE",
                name: "Polo",
                inventory_id: "warehouse",
              },
            },
          ]
        : [
            {
              subcategory: { id: "subcategory", category: { id: "category" } },
              brand: null,
              ...purchase,
            },
          ],
    };
  });
}

async function fillNewProduct() {
  render(<ProductCreateForm />);
  const category = await screen.findByRole("option", { name: "Categoría A" });
  fireEvent.change(category.closest("select")!, {
    target: { value: "category" },
  });
  const subcategory = await screen.findByRole("option", {
    name: "Subcategoría A",
  });
  fireEvent.change(subcategory.closest("select")!, {
    target: { value: "subcategory" },
  });
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: "Polo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Agregar atributo" }));
  fireEvent.change(
    screen
      .getByText("Nombre del atributo")
      .parentElement!.querySelector("input")!,
    { target: { value: "Color" } },
  );
  fireEvent.change(screen.getByPlaceholderText("Ej: S, M, L, XL"), {
    target: { value: "Rojo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generar variantes" }));
  fireEvent.change(screen.getByLabelText("Precio base"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Precio venta"), {
    target: { value: "15" },
  });
  fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMINISTRADOR";
  mockCatalog();
  post.mockResolvedValue({ data: { productId: "product" } });
  patch.mockResolvedValue({ data: {} });
  jest.mocked(getVariantCosts).mockResolvedValue([
    { variantId: "v-1", averageCost: 12.5 },
    { variantId: "v-2", averageCost: null },
  ]);
});

describe("Unidad de compra en la ficha", () => {
  it("al crear, «por unidad» no manda la unidad de compra", async () => {
    await fillNewProduct();
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).not.toHaveProperty("purchaseUnit");
    expect(post.mock.calls[0][1]).not.toHaveProperty("purchaseFactor");
  });

  it("al crear manda la unidad de compra (Caja × 12)", async () => {
    await fillNewProduct();
    fireEvent.change(screen.getByLabelText("Unidad de compra (opcional)"), {
      target: { value: " Caja " },
    });
    fireEvent.change(screen.getByLabelText("Unidades por unidad de compra"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({
      purchaseUnit: "Caja",
      purchaseFactor: 12,
    });
  });

  it("factor mayor que 1 sin unidad, o fuera de rango, no se envía", async () => {
    await fillNewProduct();
    fireEvent.change(screen.getByLabelText("Unidades por unidad de compra"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Escribe la unidad de compra (ej. Caja) o deja 1 unidad por unidad de compra.",
      ),
    );
    fireEvent.change(screen.getByLabelText("Unidades por unidad de compra"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Las unidades por unidad de compra van de 1 a 10,000.",
      ),
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("en edición la trae del producto y la manda en el PATCH solo si cambió", async () => {
    mockEditProduct({ purchaseUnit: "Caja", purchaseFactor: 12 });
    render(<ProductCreateForm editVariantId="v-1" />);
    await screen.findByText("Variante 2");
    expect(screen.getByLabelText("Unidad de compra (opcional)")).toHaveValue(
      "Caja",
    );
    expect(screen.getByLabelText("Unidades por unidad de compra")).toHaveValue(
      "12",
    );
    fireEvent.click(screen.getByRole("button", { name: /Actualizar|Guardar/ }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "¡Producto actualizado exitosamente!",
      ),
    );
    const unchanged = patch.mock.calls.find(([url]) =>
      String(url).includes("/products/p-1"),
    )?.[1];
    expect(unchanged).not.toHaveProperty("purchaseUnit");

    patch.mockClear();
    fireEvent.change(screen.getByLabelText("Unidad de compra (opcional)"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Unidades por unidad de compra"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Actualizar|Guardar/ }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const changed = patch.mock.calls.find(([url]) =>
      String(url).includes("/products/p-1"),
    )?.[1];
    expect(changed).toMatchObject({ purchaseUnit: null, purchaseFactor: 1 });
  });
});

describe("Costo promedio por variante (H3-D17)", () => {
  it("el Administrador ve el costo y carga uno a mano con un operationId", async () => {
    mockEditProduct({ purchaseUnit: null, purchaseFactor: 1 });
    jest
      .mocked(setVariantCosts)
      .mockResolvedValue({
        items: [{ variantId: "v-2", previous: null, averageCost: 8.25 }],
        duplicate: false,
      });
    render(<ProductCreateForm editVariantId="v-1" />);
    const saved = await screen.findByTestId("variant-cost-v-1");
    await waitFor(() => expect(saved).toHaveTextContent("S/ 12.50"));
    expect(getVariantCosts).toHaveBeenCalledWith(["v-1", "v-2"]);
    const empty = screen.getByTestId("variant-cost-v-2");
    expect(empty).toHaveTextContent("Sin costo");
    fireEvent.click(
      within(empty).getByRole("button", { name: "Cargar costo promedio" }),
    );
    const input = screen.getByLabelText("Costo promedio sin IGV");
    fireEvent.change(input, { target: { value: "-1" } });
    expect(
      screen.getByRole("button", { name: "Guardar costo" }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "8,25" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar costo" }));
    await waitFor(() => expect(setVariantCosts).toHaveBeenCalledTimes(1));
    const [request] = jest.mocked(setVariantCosts).mock.calls[0];
    expect(request.items).toEqual([{ variantId: "v-2", averageCost: 8.25 }]);
    expect(request.operationId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() =>
      expect(screen.getByTestId("variant-cost-v-2")).toHaveTextContent(
        "S/ 8.25",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Costo promedio guardado");
  });

  it("si el servidor rechaza, muestra su mensaje y reintentar el mismo valor reusa el operationId", async () => {
    mockEditProduct({ purchaseUnit: null, purchaseFactor: 1 });
    jest
      .mocked(setVariantCosts)
      .mockRejectedValueOnce({
        isAxiosError: true,
        code: "ERR_NETWORK",
        message: "Network Error",
      })
      .mockResolvedValueOnce({
        items: [{ variantId: "v-2", previous: null, averageCost: 8 }],
        duplicate: true,
      });
    render(<ProductCreateForm editVariantId="v-1" />);
    const empty = await screen.findByTestId("variant-cost-v-2");
    await waitFor(() => expect(empty).toHaveTextContent("Sin costo"));
    fireEvent.click(
      within(empty).getByRole("button", { name: "Cargar costo promedio" }),
    );
    fireEvent.change(screen.getByLabelText("Costo promedio sin IGV"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar costo" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar costo" }));
    await waitFor(() => expect(setVariantCosts).toHaveBeenCalledTimes(2));
    const calls = jest.mocked(setVariantCosts).mock.calls;
    expect(calls[1][0].operationId).toBe(calls[0][0].operationId);
  });

  it("Operaciones ve el costo pero no lo carga", async () => {
    mockRole = "OPERACIONES";
    mockEditProduct({ purchaseUnit: null, purchaseFactor: 1 });
    render(<ProductCreateForm editVariantId="v-1" />);
    const saved = await screen.findByTestId("variant-cost-v-1");
    await waitFor(() => expect(saved).toHaveTextContent("S/ 12.50"));
    expect(
      screen.queryByRole("button", { name: "Cargar costo promedio" }),
    ).not.toBeInTheDocument();
  });

  it("Ventas no ve el costo ni lo pide", async () => {
    mockRole = "VENTAS";
    mockEditProduct({ purchaseUnit: null, purchaseFactor: 1 });
    render(<ProductCreateForm editVariantId="v-1" />);
    await screen.findByText("Variante 2");
    expect(screen.queryByTestId("variant-cost-v-1")).not.toBeInTheDocument();
    expect(getVariantCosts).not.toHaveBeenCalled();
  });
});
