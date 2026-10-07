import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/userService", () => ({
  getRoles: jest.fn(),
  createCompanyUser: jest.fn(),
  updateUser: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import { createCompanyUser, getRoles, updateUser } from "@/services/userService";
import UserForm from "../UserForm";
import type { User } from "@/interfaces/IUser";

const mockCreate = jest.mocked(createCompanyUser);
const mockUpdate = jest.mocked(updateUser);

const EXISTING_USER: User = {
  id: "u-9",
  identityDocument: "87654321",
  name: "Luis",
  surname: "Paz",
  email: "luis@empresa.com",
  status: false,
  role: { id: "r-ventas", name: "VENTAS" },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getRoles).mockResolvedValue([
    { id: "r-ventas", name: "VENTAS", description: "Pedidos y clientes" },
    { id: "r-ops", name: "OPERACIONES" },
    { id: "r-admin", name: "ADMINISTRADOR" },
  ]);
});

const roleGroup = () =>
  (screen.queryByRole("combobox", { name: "Rol" }) as HTMLSelectElement | null) ?? screen.getByRole("group", { name: "Rol" });
const ready = () => waitFor(() => expect(roleGroup()).toBeEnabled());

describe("UserForm — alta con el diseño completo", () => {
  it("login y género se muestran pero quedan deshabilitados y no se envían", async () => {
    mockCreate.mockResolvedValue({});
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    expect(screen.getByLabelText("Usuario / login")).toBeDisabled();
    expect(screen.getByLabelText("Género")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Torres" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@empresa.com" } });
    fireEvent.change(screen.getByLabelText("DNI / Documento"), { target: { value: "12345678" } });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "clave123" } });
    fireEvent.click(within(roleGroup()).getByRole("radio", { name: "VENTAS" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][1];
    expect(payload).not.toHaveProperty("username");
    expect(payload).not.toHaveProperty("gender");
    expect(Object.keys(payload).sort()).toEqual(
      [
        "address",
        "department",
        "district",
        "email",
        "identityDocument",
        "name",
        "password",
        "phoneNumber",
        "province",
        "roleName",
        "surname",
      ].sort(),
    );
  });

  it("solo ofrece roles asignables reales y muestra Personalizado como pendiente", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    expect(within(roleGroup()).getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "VENTAS",
      "OPERACIONES",
    ]);
    expect(screen.getByRole("button", { name: /Personalizado/ })).toBeDisabled();
    expect(screen.queryByText(/acceso total/i)).not.toBeInTheDocument();
  });

  it("muestra la descripción del rol elegido solo si la API la trae", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    fireEvent.click(within(roleGroup()).getByRole("radio", { name: "OPERACIONES" }));
    expect(screen.getAllByText("Pedidos y clientes")).toHaveLength(1);

    fireEvent.click(within(roleGroup()).getByRole("radio", { name: "VENTAS" }));
    expect(screen.getAllByText("Pedidos y clientes")).toHaveLength(2);
  });

  it("la matriz de permisos se abre como vista previa sin casillas activas", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();
    const toggle = screen.getByRole("button", { name: "Personalizar permisos por módulo y ruta" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Tabla de permisos del usuario" })).toBeInTheDocument();
    expect(screen.getByText(/Vista previa con rutas de ejemplo/)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.every((box) => (box as HTMLInputElement).disabled && !(box as HTMLInputElement).checked)).toBe(true);
  });

  it("no promete contraseña temporal ni email de bienvenida", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    expect(screen.queryByText(/podrá cambiar su contraseña al primer ingreso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/email enviado/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAccessibleDescription(
      expect.stringContaining("el cambio obligatorio al primer ingreso todavía no está disponible"),
    );
  });
});

describe("UserForm — estructura de cuerpo y pie", () => {
  it.each([
    ["alta", null, "Crear usuario"],
    ["edición", EXISTING_USER, "Guardar cambios"],
  ])("en %s los botones quedan fuera del área con scroll y los campos dentro", async (_, user, submit) => {
    render(<UserForm user={user} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    const body = document.querySelector('[data-slot="users-dialog-body"]') as HTMLElement;
    const footer = document.querySelector('[data-slot="dialog-footer"]') as HTMLElement;
    expect(body).toContainElement(screen.getByLabelText("Nombre"));
    expect(body).toContainElement(screen.getByLabelText(/^Contraseña/));
    expect(body).not.toContainElement(screen.getByRole("button", { name: submit }));
    expect(footer).toContainElement(screen.getByRole("button", { name: submit }));
    expect(footer).toContainElement(screen.getByRole("button", { name: "Cancelar" }));
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("UserForm — mostrar contraseña", () => {
  it("alterna la visibilidad sin alterar la contraseña enviada", async () => {
    mockCreate.mockResolvedValue({});
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();
    const password = screen.getByLabelText(/^Contraseña/);
    fireEvent.change(password, { target: { value: "clave123" } });
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));

    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("clave123");
    const toggle = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Torres" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@empresa.com" } });
    fireEvent.change(screen.getByLabelText("DNI / Documento"), { target: { value: "12345678" } });
    fireEvent.click(within(roleGroup()).getByRole("radio", { name: "VENTAS" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ password: "clave123" });
  });
});

describe("UserForm — ubicación con el Select real", () => {
  it("al abrir la edición conserva departamento, provincia y distrito y los envía sin cambios", async () => {
    mockUpdate.mockResolvedValue({});
    render(
      <UserForm
        user={{ ...EXISTING_USER, department: "Lima", province: "Lima", district: "Ate" }}
        onUserSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await ready();

    expect(screen.getByRole("combobox", { name: "Departamento" })).toHaveTextContent("Lima");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ city: "Lima", province: "Lima", district: "Ate" });
  });
});

describe("UserForm — select de rol en edición", () => {
  it("usa un select con los roles asignables y conserva el rol actual no asignable", async () => {
    mockUpdate.mockResolvedValue({});
    render(
      <UserForm
        user={{ ...EXISTING_USER, role: { id: "r-admin", name: "ADMINISTRADOR" } }}
        onUserSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await ready();

    const select = screen.getByRole("combobox", { name: "Rol" }) as HTMLSelectElement;
    expect(screen.queryByRole("group", { name: "Rol" })).not.toBeInTheDocument();
    expect(Array.from(select.options).map((o) => [o.value, o.disabled])).toEqual([
      ["", false],
      ["ADMINISTRADOR", true],
      ["VENTAS", false],
      ["OPERACIONES", false],
    ]);
    expect(select.value).toBe("ADMINISTRADOR");

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "ADMINISTRADOR" });
  });

  it("bloquea el select cuando el usuario se edita a sí mismo", async () => {
    render(
      <UserForm user={{ ...EXISTING_USER, id: "admin-1" }} onUserSaved={jest.fn()} onCancel={jest.fn()} />,
    );
    await screen.findByText("No podés cambiar tu propio rol.");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Rol" })).toHaveDisplayValue("VENTAS"));

    expect(screen.getByRole("combobox", { name: "Rol" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Rol" })).toHaveAccessibleDescription(
      expect.stringContaining("No podés cambiar tu propio rol."),
    );
  });
});

describe("UserForm — edición compacta", () => {
  it("muestra el estado real sin permitir cambiarlo y conserva los demás datos en Más datos", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await ready();

    const status = screen.getByLabelText("Estado") as HTMLSelectElement;
    expect(status).toBeDisabled();
    expect(status.value).toBe("inactive");
    expect(screen.getByRole("tab", { name: "Más datos" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contraseña/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Usuario / login")).not.toBeInTheDocument();
    expect(screen.queryByText(/de forma inmediata/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty("status");
  });
});
