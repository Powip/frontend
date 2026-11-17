import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SkuConflictsPanel from "@/components/catalog/SkuConflictsPanel";
import { fetchBusinessProducts, type BusinessProduct } from "@/services/businessProductsService";
import { updateCatalogProduct, updateCatalogVariant } from "@/services/catalogProductService";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/businessProductsService", () => ({ fetchBusinessProducts: jest.fn() }));
jest.mock("@/services/catalogProductService", () => ({ updateCatalogProduct: jest.fn(), updateCatalogVariant: jest.fn() }));

const product = (overrides: Partial<BusinessProduct>): BusinessProduct => ({
  id: "p", companyId: "c1", name: "P", sku: "INT", companySku: "P", status: true, priceVta: 10, variants: [], ...overrides,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SkuConflictsPanel companyId="c1" /></QueryClientProvider>);
}

describe("Unificación › SKU repetido (FEAT-24 H4-D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchBusinessProducts).mockResolvedValue([
      product({ id: "p1", name: "Polo", companySku: "POL", skuConflict: true, variants: [
        { id: "v1", companySku: "POL-M", skuConflict: true, isActive: true, attributeValues: { Talla: "M" } },
        { id: "v2", companySku: "POL-L", skuConflict: false, isActive: true, attributeValues: { Talla: "L" } },
      ] }),
      product({ id: "p2", name: "Gorra", variants: [{ id: "v3", companySku: "GOR", isActive: true }] }),
    ]);
    jest.mocked(updateCatalogVariant).mockResolvedValue({});
    jest.mocked(updateCatalogProduct).mockResolvedValue({});
  });

  it("lista el SKU base y las variantes en cuarentena con su SKU actual", async () => {
    renderPanel();
    expect(await screen.findByRole("heading", { name: "SKU repetido (2)" })).toBeInTheDocument();
    expect(screen.getByText("POL-M")).toBeInTheDocument();
    expect(screen.getByLabelText("SKU nuevo de Polo · SKU base")).toBeInTheDocument();
    expect(screen.getByLabelText("SKU nuevo de Polo · Talla: M")).toBeInTheDocument();
    expect(screen.queryByText("POL-L")).not.toBeInTheDocument();
    expect(screen.queryByText("Gorra")).not.toBeInTheDocument();
  });

  it("renombra la variante (PATCH del SKU) y pide un SKU distinto al actual", async () => {
    const user = userEvent.setup();
    renderPanel();
    const input = await screen.findByLabelText("SKU nuevo de Polo · Talla: M");
    await user.type(input, "pol-m ");
    await user.click(screen.getByRole("button", { name: "Guardar SKU de Polo · Talla: M" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un SKU distinto al actual.");
    expect(updateCatalogVariant).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "POL-M2");
    await user.click(screen.getByRole("button", { name: "Guardar SKU de Polo · Talla: M" }));
    await waitFor(() => expect(updateCatalogVariant).toHaveBeenCalledWith("v1", { companySku: "POL-M2" }));
    await waitFor(() => expect(fetchBusinessProducts).toHaveBeenCalledTimes(2));
  });

  it("muestra el 409 si el SKU nuevo también está tomado; el SKU base va por el producto", async () => {
    jest.mocked(updateCatalogProduct).mockRejectedValueOnce(new AxiosError("409", "ERR", undefined, undefined, {
      status: 409, statusText: "Conflict", headers: {}, config: { headers: new AxiosHeaders() }, data: { message: "El SKU POL2 ya existe en tu empresa (producto «Polera»)" },
    }));
    const user = userEvent.setup();
    renderPanel();
    await user.type(await screen.findByLabelText("SKU nuevo de Polo · SKU base"), "POL2");
    await user.click(screen.getByRole("button", { name: "Guardar SKU de Polo · SKU base" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El SKU POL2 ya existe en tu empresa (producto «Polera»)");
    expect(updateCatalogProduct).toHaveBeenCalledWith("p1", { companySku: "POL2" });
  });

  it("en la Unificación muestra solo el SKU base: las variantes van agrupadas en «Por unificar» (FEAT-24 H11)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><SkuConflictsPanel companyId="c1" kinds={["product"]} /></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "SKU base repetido (1)" })).toBeInTheDocument();
    expect(screen.getByLabelText("SKU nuevo de Polo · SKU base")).toBeInTheDocument();
    expect(screen.queryByLabelText("SKU nuevo de Polo · Talla: M")).not.toBeInTheDocument();
  });

  it("sin SKU repetidos no muestra nada", async () => {
    jest.mocked(fetchBusinessProducts).mockResolvedValue([product({ id: "p2", name: "Gorra" })]);
    const { container } = renderPanel();
    await waitFor(() => expect(fetchBusinessProducts).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
