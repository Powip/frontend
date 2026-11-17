import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CatalogCategoriesManager from "@/components/catalog/CatalogCategoriesManager";
import { createCatalogCategory, listCatalogCategories, updateCatalogCategory } from "@/services/catalogCategoriesService";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";

let mockRole = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: mockRole }, company: { id: "c1" } } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/catalogCategoriesService", () => ({ listCatalogCategories: jest.fn(), createCatalogCategory: jest.fn(), updateCatalogCategory: jest.fn() }));

const httpError = (status: number, message: string) =>
  new AxiosError(String(status), "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

const TREE: CatalogCategoryNode[] = [
  { id: "acc", name: "Accesorios", parentId: null, active: true, level: 1, children: [] },
  {
    id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [
      { id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [{ id: "mc", name: "Manga corta", parentId: "pol", active: true, level: 3, children: [] }] },
    ],
  },
];

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CatalogCategoriesManager /></QueryClientProvider>);
}

describe("Catálogo › Categorías (FEAT-24 H4-D)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "ADMINISTRADOR";
    jest.mocked(listCatalogCategories).mockResolvedValue(TREE);
    jest.mocked(createCatalogCategory).mockResolvedValue({ id: "n", name: "Gorras", parentId: "acc", active: true });
    jest.mocked(updateCatalogCategory).mockResolvedValue({ id: "pol", name: "Polos", parentId: null, active: true });
  });

  it("muestra el árbol y no ofrece subcategorías en el nivel 3", async () => {
    renderManager();
    expect(await screen.findByText("Manga corta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva subcategoría en Polos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva subcategoría en Manga corta" })).not.toBeInTheDocument();
  });

  it("crea una subcategoría y valida el nombre repetido antes de mandar", async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(await screen.findByRole("button", { name: "Nueva subcategoría en Ropa" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), " polos ");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Ya existe la categoría «polos» en ese nivel.");
    expect(createCatalogCategory).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText("Nombre"));
    await user.type(within(dialog).getByLabelText("Nombre"), "Camisas");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(createCatalogCategory).toHaveBeenCalledWith({ name: "Camisas", parentId: "ropa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("muestra el 409 y el 400 del servidor dentro del diálogo", async () => {
    jest.mocked(createCatalogCategory).mockRejectedValueOnce(httpError(409, "Ya existe la categoría «Gorras» en ese nivel."));
    jest.mocked(updateCatalogCategory).mockRejectedValueOnce(httpError(400, "Las categorías tienen hasta 3 niveles."));
    const user = userEvent.setup();
    renderManager();
    await user.click(await screen.findByRole("button", { name: "Nueva categoría" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Gorras");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya existe la categoría «Gorras» en ese nivel.");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getByRole("button", { name: "Mover Manga corta" }));
    dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Nueva ubicación"), "acc");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Las categorías tienen hasta 3 niveles.");
    expect(updateCatalogCategory).toHaveBeenCalledWith("mc", { parentId: "acc" });
  });

  it("mover solo ofrece destinos que no pasan de 3 niveles; renombrar y desactivar", async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(await screen.findByRole("button", { name: "Mover Polos" }));
    const dialog = await screen.findByRole("dialog");
    const options = within(within(dialog).getByLabelText("Nueva ubicación")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Nivel 1 (sin categoría padre)", "Accesorios"]);
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(updateCatalogCategory).toHaveBeenCalledWith("pol", { parentId: null }));

    await user.click(screen.getByRole("button", { name: "Renombrar Accesorios" }));
    const rename = await screen.findByRole("dialog");
    await user.clear(within(rename).getByLabelText("Nombre"));
    await user.type(within(rename).getByLabelText("Nombre"), "Complementos");
    await user.click(within(rename).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(updateCatalogCategory).toHaveBeenCalledWith("acc", { name: "Complementos" }));

    await user.click(screen.getByRole("button", { name: "Desactivar Accesorios" }));
    await waitFor(() => expect(updateCatalogCategory).toHaveBeenCalledWith("acc", { active: false }));
  });

  it("quien no es administrador solo ve el árbol", async () => {
    mockRole = "VENTAS";
    renderManager();
    expect(await screen.findByText("Manga corta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva categoría" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Renombrar/ })).not.toBeInTheDocument();
    expect(screen.getByText("Solo el administrador puede crear o cambiar categorías.")).toBeInTheDocument();
  });
});
