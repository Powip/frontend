/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * UserForm — roles solo desde GET /api/v1/roles.
 *
 * 1. Si la carga de roles falla: error visible, ninguna opción (antes aparecían
 *    5 roles inventados con ids "1"–"5") y no se crea ni edita nada.
 * 2. Si la API no trae roles asignables: mismo bloqueo.
 * 3. Si carga bien: solo los roles reales asignables, y se puede crear.
 *
 * Work-around jsdom: el Select de Radix se reemplaza por un <select> nativo
 * (mismo rol "combobox") que expone las opciones reales que recibe.
 */

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/userService", () => ({
  getRoles: jest.fn(),
  createCompanyUser: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("@/components/ui/select", () => {
  const R = require("react");
  const SelectTrigger = ({ id }: { id?: string }) => R.createElement("span", { "data-trigger-id": id });
  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    R.createElement(R.Fragment, null, children);
  const SelectItem = (
    { value, children, disabled }: { value: string; children?: React.ReactNode; disabled?: boolean },
  ) => R.createElement("option", { value, disabled }, children);
  const Select = ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    const kids = R.Children.toArray(children) as React.ReactElement<{ id?: string; children?: React.ReactNode }>[];
    const trigger = kids.find((c) => c.type === SelectTrigger);
    const content = kids.find((c) => c.type === SelectContent);
    return R.createElement(
      "select",
      {
        "aria-label": trigger?.props.id ?? "select",
        value: value ?? "",
        disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
      },
      R.createElement("option", { value: "" }, "—"),
      content?.props.children,
    );
  };
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue: () => null };
});

import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createCompanyUser, getRoles, updateUser } from "@/services/userService";
import UserForm from "../UserForm";
import type { User } from "@/interfaces/IUser";

const mockGetRoles = jest.mocked(getRoles);
const mockCreate = jest.mocked(createCompanyUser);
const mockUpdate = jest.mocked(updateUser);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
  } as unknown as ReturnType<typeof useAuth>);
});

const roleSelect = () => screen.getByRole("combobox", { name: "role" }) as HTMLSelectElement;
const roleOptions = () => Array.from(roleSelect().options).filter((o) => o.value !== "");

function fillNewUser() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Torres" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@empresa.com" } });
  fireEvent.change(screen.getByLabelText("Documento de Identidad"), { target: { value: "12345678" } });
  fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: "clave123" } });
}

const EXISTING_USER: User = {
  id: "u-9",
  identityDocument: "87654321",
  name: "Luis",
  surname: "Paz",
  email: "luis@empresa.com",
  status: true,
  role: { id: "r-ventas", name: "VENTAS" },
};

describe("UserForm — fallo al cargar roles", () => {
  beforeEach(() => mockGetRoles.mockRejectedValue(new Error("500")));

  it("muestra el error y no ofrece roles falsos", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los roles");
    expect(toast.error).toHaveBeenCalledWith("No se pudieron cargar los roles");
    expect(roleOptions()).toHaveLength(0);
    expect(roleSelect()).toBeDisabled();
    expect(screen.queryByText("AGENTES")).not.toBeInTheDocument();
  });

  it("no crea un usuario", async () => {
    const onSaved = jest.fn();
    render(<UserForm user={null} onUserSaved={onSaved} />);
    await screen.findByRole("alert");
    fillNewUser();

    const submit = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("no edita un usuario existente", async () => {
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} />);
    await screen.findByRole("alert");

    fireEvent.submit(screen.getByRole("button", { name: "Actualizar Usuario" }).closest("form")!);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("'Reintentar' vuelve a pedir los roles y, si cargan, habilita el formulario", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} />);
    await screen.findByRole("alert");
    mockGetRoles.mockResolvedValueOnce([{ id: "r-ventas", name: "VENTAS" }]);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear Usuario" })).toBeEnabled();
  });
});

describe("UserForm — API sin roles asignables", () => {
  it("bloquea el guardado sin inventar opciones", async () => {
    mockGetRoles.mockResolvedValue([
      { id: "r-admin", name: "ADMINISTRADOR" },
      { id: "r-user", name: "USUARIO" },
    ]);
    render(<UserForm user={null} onUserSaved={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay roles disponibles para asignar");
    expect(roleOptions()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Crear Usuario" })).toBeDisabled();
  });
});

describe("UserForm — roles cargados", () => {
  beforeEach(() =>
    mockGetRoles.mockResolvedValue([
      { id: "r-ventas", name: "VENTAS" },
      { id: "r-ops", name: "OPERACIONES" },
      { id: "r-admin", name: "ADMINISTRADOR" },
    ]),
  );

  it("ofrece solo los roles asignables que devolvió la API", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} />);

    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS", "OPERACIONES"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("crea el usuario con el rol elegido", async () => {
    mockCreate.mockResolvedValue({});
    const onSaved = jest.fn();
    render(<UserForm user={null} onUserSaved={onSaved} />);
    await waitFor(() => expect(roleSelect()).toBeEnabled());
    fillNewUser();
    fireEvent.change(roleSelect(), { target: { value: "OPERACIONES" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear Usuario" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ roleName: "OPERACIONES", email: "ana@empresa.com" });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("al editar un usuario con un rol no asignable, lo muestra explícito y no permite elegirlo para otro valor", async () => {
    const userWithUnassignableRole: User = {
      ...EXISTING_USER,
      role: { id: "r-admin", name: "ADMINISTRADOR" },
    };
    render(<UserForm user={userWithUnassignableRole} onUserSaved={jest.fn()} />);

    await waitFor(() => expect(roleSelect()).toBeEnabled());

    // El selector muestra el rol actual en vez de quedar vacío/ambiguo.
    expect(roleSelect().value).toBe("ADMINISTRADOR");

    const options = Array.from(roleSelect().options);
    const adminOption = options.find((o) => o.value === "ADMINISTRADOR");
    expect(adminOption).toBeDisabled();

    // Las únicas opciones elegibles siguen siendo las que trae la API como asignables.
    expect(roleOptions().filter((o) => !o.disabled).map((o) => o.value)).toEqual([
      "VENTAS",
      "OPERACIONES",
    ]);
  });

  it("permite guardar sin cambios al usuario cuyo rol actual no es asignable", async () => {
    mockUpdate.mockResolvedValue({});
    const userWithUnassignableRole: User = {
      ...EXISTING_USER,
      role: { id: "r-admin", name: "ADMINISTRADOR" },
    };
    render(<UserForm user={userWithUnassignableRole} onUserSaved={jest.fn()} />);
    await waitFor(() => expect(roleSelect()).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Actualizar Usuario" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "ADMINISTRADOR" });
  });
});
