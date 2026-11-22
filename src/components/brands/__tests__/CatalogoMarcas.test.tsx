import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CatalogoMarcas from "@/components/brands/CatalogoMarcas";
import axiosAuth from "@/lib/axiosAuth";

// Correcciones 11-20 (B1): Configuración › Tiendas › Marcas pasa a ser la lista de marcas de la empresa
// (`/brands` de ms-products, empresa del token). La pantalla anterior pedía un proveedor y llamaba a `/brand`,
// una ruta que ya no existe.

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: "ADMINISTRADOR" }, company: { id: "c1" } } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));

const httpError = (status: number, message: string) =>
  new AxiosError(String(status), "ERR", undefined, undefined, { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: { message } });

let brands = [{ id: "b1", name: "Nike" }, { id: "b2", name: "Puma" }];

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CatalogoMarcas /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  brands = [{ id: "b1", name: "Nike" }, { id: "b2", name: "Puma" }];
  jest.mocked(axiosAuth.get).mockImplementation(async () => ({ data: brands }));
});

describe("Configuración › Marcas", () => {
  it("lista las marcas de la empresa, sin pedir proveedor", async () => {
    renderTab();
    expect(await screen.findByText("Nike")).toBeInTheDocument();
    expect(screen.getByText("Puma")).toBeInTheDocument();
    expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringMatching(/\/brands$/));
    expect(screen.queryByText(/proveedor/i)).not.toBeInTheDocument();
  });

  it("crea una marca y la muestra; el 409 del servidor se ve tal cual", async () => {
    const user = userEvent.setup();
    jest.mocked(axiosAuth.post).mockImplementationOnce(async () => {
      brands = [...brands, { id: "b3", name: "Adidas" }];
      return { data: { id: "b3", name: "Adidas" } };
    });
    renderTab();
    await screen.findByText("Nike");
    await user.type(screen.getByLabelText("Nueva marca"), "  Adidas {Enter}");
    await waitFor(() => expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringMatching(/\/brands$/), { name: "Adidas" }));
    expect(await screen.findByText("Adidas")).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva marca")).toHaveValue("");

    jest.mocked(axiosAuth.post).mockRejectedValueOnce(httpError(409, "Ya existe la marca «Reebok» en tu empresa."));
    await user.type(screen.getByLabelText("Nueva marca"), "Reebok");
    await user.click(screen.getByRole("button", { name: "Crear marca" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe la marca «Reebok» en tu empresa.");
  });

  it("renombra una marca", async () => {
    const user = userEvent.setup();
    jest.mocked(axiosAuth.patch).mockImplementationOnce(async () => {
      brands = [{ id: "b1", name: "Nike Perú" }, brands[1]];
      return { data: { id: "b1", name: "Nike Perú" } };
    });
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Renombrar Nike" }));
    const input = screen.getByLabelText("Nuevo nombre de Nike");
    await user.clear(input);
    await user.type(input, "Nike Perú");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(axiosAuth.patch).toHaveBeenCalledWith(expect.stringMatching(/\/brands\/b1$/), { name: "Nike Perú" }));
    expect(await screen.findByText("Nike Perú")).toBeInTheDocument();
  });

  it("desactiva con confirmación y explica qué pasa con los productos", async () => {
    const user = userEvent.setup();
    jest.mocked(axiosAuth.delete).mockImplementationOnce(async () => {
      brands = [brands[1]];
      return { data: undefined };
    });
    renderTab();
    await user.click(await screen.findByRole("button", { name: "Desactivar Nike" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Desactivar la marca «Nike»?" });
    expect(dialog).toHaveTextContent("Deja de ofrecerse al elegir la marca de un producto");
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(axiosAuth.delete).toHaveBeenCalledWith(expect.stringMatching(/\/brands\/b1$/)));
    await waitFor(() => expect(screen.queryByText("Nike")).not.toBeInTheDocument());
  });

  it("filtra por nombre", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText("Nike");
    await user.type(screen.getByLabelText("Buscar marca"), "pu");
    expect(screen.queryByText("Nike")).not.toBeInTheDocument();
    expect(screen.getByText("Puma")).toBeInTheDocument();
  });
});
