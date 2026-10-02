import { fireEvent, render, screen, within } from "@testing-library/react";

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
jest.mock("@/components/modals/UserModal", () => ({ __esModule: true, default: () => null }));

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
