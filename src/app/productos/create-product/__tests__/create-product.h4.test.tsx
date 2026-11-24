import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import ProductCreateForm from "../create-product";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import { uploadImage } from "@/services/uploadService";
import { saveProductContent } from "@/services/productContentService";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a" }, user: { id: "user-a", role: "ADMINISTRADOR" }, accessToken: "token" } }),
}));
jest.mock("@/hooks/useCatalogCategories", () => ({
  useCatalogCategories: () => ({
    tree: [{ id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [{ id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [] }] }],
    isLoading: false, error: null,
  }),
}));
jest.mock("@/hooks/useBusinessInventories", () => {
  const inventories = [{ id: "warehouse", name: "Central", storeId: "store" }];
  return { useBusinessInventories: () => ({ inventories }) };
});
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("@/services/uploadService", () => ({ uploadImage: jest.fn() }));
jest.mock("@/services/productContentService", () => ({ saveProductContent: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/components/products/BrandSelect", () => ({ __esModule: true, default: () => null }));
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

function mockCatalog() {
  get.mockImplementation(async (url) => ({
    data: String(url).endsWith("/categories")
      ? [{ id: "category", name: "Categoría A" }]
      : String(url).includes("/subcategories/category/")
        ? [{ id: "subcategory", name: "Subcategoría A" }]
        : String(url).match(/\/subcategories\/[^/]+$/)
          ? { defaultAttributes: [] }
          : [],
  }));
}

async function fillBase() {
  render(<ProductCreateForm />);
  const category = await screen.findByRole("option", { name: "Categoría A" });
  fireEvent.change(category.closest("select")!, { target: { value: "category" } });
  const subcategory = await screen.findByRole("option", { name: "Subcategoría A" });
  fireEvent.change(subcategory.closest("select")!, { target: { value: "subcategory" } });
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Polo" } });
  fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "pol" } });
}

function generateColors(values: string) {
  fireEvent.click(screen.getByRole("button", { name: "Agregar atributo" }));
  fireEvent.change(screen.getByText("Nombre del atributo").parentElement!.querySelector("input")!, { target: { value: "Color" } });
  fireEvent.change(screen.getByPlaceholderText("Ej: S, M, L, XL"), { target: { value: values } });
  fireEvent.click(screen.getByRole("button", { name: "Generar variantes" }));
  screen.getAllByLabelText("Precio base").forEach((input) => fireEvent.change(input, { target: { value: "10" } }));
  screen.getAllByLabelText("Precio venta").forEach((input) => fireEvent.change(input, { target: { value: "15" } }));
}

describe("Alta de producto (FEAT-24 H4-D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog();
    post.mockResolvedValue({ data: { productId: "product" } });
  });

  it("el SKU base es opcional y avisa que se genera solo", async () => {
    await fillBase();
    expect(screen.getByLabelText(/SKU base/)).toHaveAttribute("placeholder", "Se genera solo si lo dejas vacío");
    expect(screen.getByText(/POWIP lo genera solo/)).toBeInTheDocument();
  });

  it("producto simple: una sola variante sin opciones, con su SKU, su código y la categoría propia", async () => {
    await fillBase();
    fireEvent.click(screen.getByRole("radio", { name: "Simple" }));
    expect(screen.queryByRole("button", { name: "Generar variantes" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Stock"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/^SKU/, { selector: "#simple-sku" }), { target: { value: " TAZ-01 " } });
    fireEvent.change(screen.getByLabelText(/^Código de barras/), { target: { value: "775 0001" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const payload = post.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ categoryId: "pol", subcategoryId: "subcategory", attributes: [] });
    expect(payload.companySku).toBeUndefined();
    expect(payload.variants).toEqual([
      expect.objectContaining({ attributeValues: {}, priceBase: 8, priceVta: 20, stock: 5, companySku: "TAZ-01", barcode: "7750001" }),
    ]);
  });

  it("FEAT-32 M1: alta con varias fotos: la primera es la principal y la galería completa va al contenido", async () => {
    URL.createObjectURL = jest.fn(() => "blob:preview");
    jest.mocked(uploadImage).mockImplementation(async (file: File) => `https://s.co/${file.name}`);
    jest.mocked(saveProductContent).mockResolvedValue({} as never);
    await fillBase();
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Polo de algodón\nTalla única" } });
    fireEvent.click(screen.getByRole("radio", { name: "Simple" }));
    fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "20" } });
    const file = (name: string, type: string) => new File(["x"], name, { type });
    fireEvent.change(screen.getByLabelText("Fotos del producto"), { target: { files: [file("a.jpg", "image/jpeg"), file("b.png", "image/png"), file("c.gif", "image/gif")] } });
    expect(toast.error).toHaveBeenCalledWith("«c.gif» no es JPG, PNG ni WebP.");
    fireEvent.change(screen.getByLabelText("Más fotos del producto"), { target: { files: [file("d.webp", "image/webp")] } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar b.png" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(saveProductContent).toHaveBeenCalledTimes(1));
    expect((post.mock.calls[0][1] as Record<string, unknown>).imageUrl).toBe("https://s.co/a.jpg");
    const [productId, body] = jest.mocked(saveProductContent).mock.calls[0];
    expect(productId).toBe("product");
    expect(body).toMatchObject({ title: "Polo", descriptionHtml: "<p>Polo de algodón<br>Talla única</p>", overrides: [] });
    expect(body.media.map((m) => [m.kind, m.url, m.origin, m.fileName])).toEqual([
      ["photo", "https://s.co/a.jpg", "uploaded", "a.jpg"],
      ["photo", "https://s.co/d.webp", "uploaded", "d.webp"],
    ]);
  });

  it("FEAT-32 M1: con una sola foto no toca el contenido (el producto queda como siempre)", async () => {
    URL.createObjectURL = jest.fn(() => "blob:preview");
    jest.mocked(uploadImage).mockResolvedValue("https://s.co/a.jpg");
    await fillBase();
    fireEvent.click(screen.getByRole("radio", { name: "Simple" }));
    fireEvent.change(screen.getByLabelText("Precio base"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Precio venta"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Fotos del producto"), { target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect((post.mock.calls[0][1] as Record<string, unknown>).imageUrl).toBe("https://s.co/a.jpg");
    expect(saveProductContent).not.toHaveBeenCalled();
  });

  it("con variantes: cada una manda su SKU (vacío = se genera) y ya no copia el del producto", async () => {
    await fillBase();
    fireEvent.change(screen.getByLabelText(/SKU base/), { target: { value: "POL-BASE" } });
    generateColors("Rojo, Azul");
    fireEvent.change(screen.getAllByLabelText("SKU")[0], { target: { value: "POL-ROJ" } });
    fireEvent.change(screen.getAllByLabelText("Código de barras")[1], { target: { value: "7751234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const payload = post.mock.calls[0][1] as { companySku: string; variants: Array<Record<string, unknown>> };
    expect(payload.companySku).toBe("POL-BASE");
    expect(payload.variants[0]).toMatchObject({ attributeValues: { Color: "Rojo" }, companySku: "POL-ROJ" });
    expect(payload.variants[0]).not.toHaveProperty("barcode");
    expect(payload.variants[1]).toMatchObject({ attributeValues: { Color: "Azul" }, barcode: "7751234567890" });
    expect(payload.variants[1]).not.toHaveProperty("companySku");
  });

  it("no manda dos variantes con el mismo SKU", async () => {
    await fillBase();
    generateColors("Rojo, Azul");
    fireEvent.change(screen.getAllByLabelText("SKU")[0], { target: { value: "POL-1" } });
    fireEvent.change(screen.getAllByLabelText("SKU")[1], { target: { value: "pol-1 " } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    expect(toast.error).toHaveBeenCalledWith("Hay variantes con el mismo SKU: POL-1.");
    expect(post).not.toHaveBeenCalled();
  });

  it("el 409 del servidor (SKU repetido en la empresa) se muestra tal cual", async () => {
    post.mockRejectedValue(new AxiosError("409", "ERR", undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() }, data: { message: "El SKU POL-ROJ ya existe en tu empresa (producto «Polo viejo»)" },
    }));
    await fillBase();
    generateColors("Rojo");
    fireEvent.click(screen.getByRole("button", { name: "Crear Producto" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El SKU POL-ROJ ya existe en tu empresa (producto «Polo viejo»)"));
  });
});
