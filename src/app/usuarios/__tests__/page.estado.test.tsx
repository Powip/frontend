import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * /usuarios — sin activar/desactivar falso.
 *
 * Antes, el botón de la fila cambiaba el estado solo en pantalla y mostraba
 * "Usuario desactivado correctamente" sin llamar a ninguna API. El contrato
 * actual de ms-auth (UpdateUserRequest) no incluye `status`, así que la acción se retiró:
 * 1. Cada fila solo ofrece "Editar"; no hay acción de activar/desactivar.
 * 2. El estado se muestra tal como lo devuelve la API.
 * 3. Interactuar con la tabla nunca muestra un éxito ni llama a la API de edición.
 */

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/usuarios" }));
jest.mock("@/services/userService", () => ({ getUsersByCompany: jest.fn(), updateUser: jest.fn() }));
// El modal real se prueba en UserForm.roles.test.tsx; aquí solo se expone el
// contrato onUserSaved / onClose que usa la página.
jest.mock("@/components/modals/UserModal", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react");
  return {
    __esModule: true,
    default: ({ open, onClose, onUserSaved }: { open: boolean; onClose: () => void; onUserSaved: () => void }) =>
      open
        ? R.createElement(
            "div",
            { "data-testid": "user-modal" },
            R.createElement("button", { onClick: onUserSaved }, "mock-guardado"),
            R.createElement("button", { onClick: onClose }, "mock-cerrar"),
          )
        : null,
  };
});

import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getUsersByCompany, updateUser } from "@/services/userService";
import UsuariosPage from "../page";

const USERS = [
  {
    id: "u-1",
    identityDocument: "11111111",
    name: "Ana",
    surname: "Torres",
    email: "ana@empresa.com",
    district: "Miraflores",
    province: "Lima",
    status: true,
    role: { id: "r-1", name: "ADMINISTRADOR" },
  },
  {
    id: "u-2",
    identityDocument: "22222222",
    name: "Luis",
    surname: "Paz",
    email: "luis@empresa.com",
    district: "Breña",
    province: "Lima",
    status: false,
    role: { id: "r-2", name: "VENTAS" },
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getUsersByCompany).mockResolvedValue(USERS);
});

const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

describe("UsuariosPage — estado de usuario", () => {
  it("cada fila solo ofrece Editar: no hay acción de activar/desactivar", async () => {
    render(<UsuariosPage />);

    for (const name of ["Ana Torres", "Luis Paz"]) {
      const buttons = within(await rowOf(name)).getAllByRole("button");
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName(`Editar ${name}`);
    }
    expect(screen.queryByRole("button", { name: /desactivar|activar|eliminar/i })).not.toBeInTheDocument();
  });

  it("muestra el estado que devuelve la API", async () => {
    render(<UsuariosPage />);

    expect(within(await rowOf("Ana Torres")).getByText("Activo")).toBeInTheDocument();
    expect(within(await rowOf("Luis Paz")).getByText("Inactivo")).toBeInTheDocument();
  });

  it("ninguna interacción con la fila muestra éxito ni cambia el estado sin persistirlo", async () => {
    render(<UsuariosPage />);
    const row = await rowOf("Luis Paz");

    for (const button of within(row).getAllByRole("button")) fireEvent.click(button);

    expect(toast.success).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(within(row).getByText("Inactivo")).toBeInTheDocument();
  });

  it("el badge de rol usa el mismo criterio de admin que el acceso a la ruta", async () => {
    render(<UsuariosPage />);

    expect(within(await rowOf("Ana Torres")).getByText("ADMINISTRADOR")).toBeInTheDocument();
    expect(within(await rowOf("Luis Paz")).getByText("VENTAS")).toBeInTheDocument();
  });
});

describe("UsuariosPage — guardar y cancelar el modal", () => {
  const openEdit = async (name: string) => {
    fireEvent.click(within(await rowOf(name)).getByRole("button", { name: `Editar ${name}` }));
    return screen.getByTestId("user-modal");
  };

  it("tras guardar, refresca la lista sin sumar un segundo aviso de éxito", async () => {
    render(<UsuariosPage />);
    const modal = await openEdit("Luis Paz");
    expect(getUsersByCompany).toHaveBeenCalledTimes(1);

    fireEvent.click(within(modal).getByRole("button", { name: "mock-guardado" }));

    await waitFor(() => expect(getUsersByCompany).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("user-modal")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("cerrar sin guardar no refresca ni muestra éxito", async () => {
    render(<UsuariosPage />);
    const modal = await openEdit("Luis Paz");

    fireEvent.click(within(modal).getByRole("button", { name: "mock-cerrar" }));

    expect(screen.queryByTestId("user-modal")).not.toBeInTheDocument();
    expect(getUsersByCompany).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("UsuariosPage — lista vacía", () => {
  it("el mensaje sin resultados ocupa todas las columnas", async () => {
    jest.mocked(getUsersByCompany).mockResolvedValue([]);
    render(<UsuariosPage />);

    const cell = await screen.findByText("No se encontraron usuarios.");
    const columns = screen.getAllByRole("columnheader").length;
    expect(cell).toHaveAttribute("colspan", String(columns));
  });
});

/**
 * Carga de usuarios: error ≠ lista vacía.
 *
 * Antes, si GET /company/{id}/users fallaba, la tabla mostraba "No se
 * encontraron usuarios", como si la empresa no tuviera ninguno. Ahora:
 * 1. Error → alerta con "Reintentar" y sin mensaje de lista vacía.
 * 2. "Reintentar" vuelve a pedir los usuarios, muestra la carga y conserva la búsqueda.
 * 3. "No se encontraron usuarios" solo aparece si la API responde bien con 0 filas.
 */
describe("UsuariosPage — error de carga y reintento", () => {
  const EMPTY = "No se encontraron usuarios.";
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("si la carga falla, muestra el error con Reintentar y no el estado vacío", async () => {
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudieron cargar los usuarios.");
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
    expect(screen.queryByText(/usuarios en total|mostrando/i)).not.toBeInTheDocument();
    // La alerta es el único aviso: sin toast que repita el mismo error.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("Reintentar vuelve a pedir los usuarios, muestra la carga y conserva la búsqueda", async () => {
    let resolveRetry!: (users: typeof USERS) => void;
    jest
      .mocked(getUsersByCompany)
      .mockRejectedValueOnce(new Error("500"))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveRetry = resolve)));
    render(<UsuariosPage />);
    const alert = await screen.findByRole("alert");

    const search = screen.getByPlaceholderText("Buscar por nombre, email o documento...");
    fireEvent.change(search, { target: { value: "Luis" } });
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    // Durante la nueva carga: ni error ni lista vacía.
    expect(getUsersByCompany).toHaveBeenCalledTimes(2);
    expect(getUsersByCompany).toHaveBeenLastCalledWith("company-1", "token");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();

    resolveRetry(USERS);

    expect(await screen.findByText("Luis Paz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Torres")).not.toBeInTheDocument();
    expect(search).toHaveValue("Luis");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si el reintento también falla, vuelve a mostrar el error", async () => {
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);

    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(getUsersByCompany).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los usuarios.");
    expect(screen.queryByText(EMPTY)).not.toBeInTheDocument();
  });

  it("una respuesta exitosa sin usuarios muestra el estado vacío, sin error", async () => {
    jest.mocked(getUsersByCompany).mockResolvedValue([]);
    render(<UsuariosPage />);

    expect(await screen.findByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

/**
 * Sesión sin empresa asociada.
 *
 * Antes, sin `auth.company.id` la página no pedía nada y mostraba "No se
 * encontraron usuarios", como si la empresa existiera y estuviera vacía. Ahora:
 * 1. Sesión cargando → no se renderiza nada ni se hace la petición (AuthGuard muestra el loader).
 * 2. Sesión sin empresa → aviso específico, sin petición, sin "Reintentar" ni "Nuevo usuario".
 * 3. Cuando la empresa está disponible → una sola petición con su id.
 */
describe("UsuariosPage — sesión sin empresa", () => {
  const NO_COMPANY = "No tienes una empresa asociada.";
  const authWith = (auth: unknown, loading = false) =>
    jest.mocked(useAuth).mockReturnValue({ auth, loading } as unknown as ReturnType<typeof useAuth>);

  it("sin empresa muestra el aviso y no pide usuarios ni ofrece reintentar", async () => {
    authWith({ accessToken: "token", company: null, user: { id: "admin-1", role: "ADMINISTRADOR", companyId: null } });
    render(<UsuariosPage />);

    expect(await screen.findByText(NO_COMPANY)).toBeInTheDocument();
    expect(getUsersByCompany).not.toHaveBeenCalled();
    expect(screen.queryByText("No se encontraron usuarios.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuevo usuario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("no usa el companyId del JWT si ms-company no devolvió la empresa", async () => {
    authWith({ accessToken: "token", company: null, user: { id: "admin-1", role: "ADMINISTRADOR", companyId: "jwt-company" } });
    render(<UsuariosPage />);

    expect(await screen.findByText(NO_COMPANY)).toBeInTheDocument();
    expect(getUsersByCompany).not.toHaveBeenCalled();
  });

  it("de sesión cargando a empresa disponible: pide los usuarios una vez, con el id de la empresa", async () => {
    authWith(null, true);
    const { container, rerender } = render(<UsuariosPage />);

    expect(container).toBeEmptyDOMElement();
    expect(getUsersByCompany).not.toHaveBeenCalled();

    authWith({ accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } });
    rerender(<UsuariosPage />);

    expect(await screen.findByText("Ana Torres")).toBeInTheDocument();
    expect(getUsersByCompany).toHaveBeenCalledTimes(1);
    expect(getUsersByCompany).toHaveBeenCalledWith("company-1", "token");
    expect(screen.queryByText(NO_COMPANY)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo usuario/i })).toBeInTheDocument();
  });

  it("mientras la sesión carga no muestra el aviso de empresa ausente", () => {
    authWith({ accessToken: "token", company: null, user: { id: "admin-1", role: "ADMINISTRADOR" } }, true);
    render(<UsuariosPage />);

    expect(screen.queryByText(NO_COMPANY)).not.toBeInTheDocument();
    expect(getUsersByCompany).not.toHaveBeenCalled();
  });
});

describe("UsuariosPage — paginación tras recargar", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    ...USERS[1],
    id: `u-${i}`,
    name: `Usuario${String(i).padStart(2, "0")}`,
    surname: "Prueba",
  }));

  it("si la recarga trae menos páginas, muestra la última en vez de la lista vacía", async () => {
    jest.mocked(getUsersByCompany).mockResolvedValueOnce(many).mockResolvedValueOnce(many.slice(0, 3));
    render(<UsuariosPage />);

    await screen.findByText("Usuario00 Prueba");
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    const row = await rowOf("Usuario10 Prueba");

    // Guardar desde el modal recarga la lista, que ahora tiene una sola página.
    fireEvent.click(within(row).getByRole("button", { name: "Editar Usuario10 Prueba" }));
    fireEvent.click(within(screen.getByTestId("user-modal")).getByRole("button", { name: "mock-guardado" }));

    expect(await screen.findByText("Usuario00 Prueba")).toBeInTheDocument();
    expect(screen.queryByText("No se encontraron usuarios.")).not.toBeInTheDocument();
  });
});
