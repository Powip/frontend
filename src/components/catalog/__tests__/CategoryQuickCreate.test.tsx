import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CategoryQuickCreate from "@/components/catalog/CategoryQuickCreate";
import { createCatalogCategory } from "@/services/catalogCategoriesService";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";

// Correcciones 11-20 (B1): crear la categoría propia sin salir del formulario del producto.

let mockRole = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: mockRole }, company: { id: "c1" } } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/catalogCategoriesService", () => ({ listCatalogCategories: jest.fn().mockResolvedValue([]), createCatalogCategory: jest.fn(), updateCatalogCategory: jest.fn() }));

const httpError = (status: number, message: string) =>
  new AxiosError(String(status), "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

const TREE: CatalogCategoryNode[] = [
  {
    id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [
      { id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [{ id: "mc", name: "Manga corta", parentId: "pol", active: true, level: 3, children: [] }] },
    ],
  },
  { id: "old", name: "Vieja", parentId: null, active: false, level: 1, children: [] },
];

function renderQuickCreate(onCreated = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CategoryQuickCreate tree={TREE} onCreated={onCreated} /></QueryClientProvider>);
  return { onCreated };
}

describe("Nueva categoría desde el producto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "ADMINISTRADOR";
    jest.mocked(createCatalogCategory).mockResolvedValue({ id: "new", name: "Casacas", parentId: "ropa", active: true });
  });

  it("crea la categoría (dentro de otra si se elige) y queda elegida en el producto", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderQuickCreate();
    await user.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    const parent = within(dialog).getByLabelText("Dentro de");
    // Solo activas y con lugar para un nivel más (máximo 3).
    expect(within(parent).getAllByRole("option").map((option) => option.textContent?.trim())).toEqual(["Ninguna (categoría principal)", "Ropa", "Polos"]);
    await user.type(within(dialog).getByLabelText("Nombre"), "  Casacas ");
    await user.selectOptions(parent, "ropa");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));
    await waitFor(() => expect(createCatalogCategory).toHaveBeenCalledWith({ name: "Casacas", parentId: "ropa" }));
    expect(onCreated).toHaveBeenCalledWith("new");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("no deja repetir el nombre en el mismo nivel y muestra el error del servidor", async () => {
    const user = userEvent.setup();
    renderQuickCreate();
    await user.click(screen.getByRole("button", { name: "Nueva categoría" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva categoría" });
    await user.type(within(dialog).getByLabelText("Nombre"), "ropa");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Ya existe/);
    expect(createCatalogCategory).not.toHaveBeenCalled();

    jest.mocked(createCatalogCategory).mockRejectedValueOnce(httpError(400, "Las categorías tienen hasta 3 niveles."));
    await user.clear(within(dialog).getByLabelText("Nombre"));
    await user.type(within(dialog).getByLabelText("Nombre"), "Calzado");
    await user.click(within(dialog).getByRole("button", { name: "Crear categoría" }));
    expect(await within(dialog).findByText("Las categorías tienen hasta 3 niveles.")).toBeInTheDocument();
  });

  it("solo el Administrador crea categorías (igual que en Catálogo › Categorías)", () => {
    mockRole = "VENTAS";
    renderQuickCreate();
    expect(screen.queryByRole("button", { name: "Nueva categoría" })).not.toBeInTheDocument();
  });
});
