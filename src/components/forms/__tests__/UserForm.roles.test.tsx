/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

const roleSelect = () => screen.queryByRole("combobox", { name: "Rol" }) as HTMLSelectElement | null;
const roleGroup = () => roleSelect() ?? screen.getByRole("group", { name: "Rol" });
const roleOptions = (): Array<HTMLInputElement | HTMLOptionElement> => {
  const select = roleSelect();
  if (select) return Array.from(select.options).filter((o) => o.value !== "");
  return within(roleGroup()).queryAllByRole("radio") as HTMLInputElement[];
};
const selectedRole = () => {
  const select = roleSelect();
  if (select) return select.value;
  return (roleOptions() as HTMLInputElement[]).find((o) => o.checked)?.value ?? "";
};
const chooseRole = (value: string) => {
  const select = roleSelect();
  if (select) fireEvent.change(select, { target: { value } });
  else fireEvent.click(roleOptions().find((o) => o.value === value) as HTMLInputElement);
};

function fillNewUser() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
  fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Torres" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@empresa.com" } });
  fireEvent.change(screen.getByLabelText("DNI / Documento"), { target: { value: "12345678" } });
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
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los roles");
    expect(toast.error).toHaveBeenCalledWith("No se pudieron cargar los roles");
    expect(roleOptions()).toHaveLength(0);
    expect(roleGroup()).toBeDisabled();
    expect(screen.queryByText("AGENTES")).not.toBeInTheDocument();
  });

  it("no crea un usuario", async () => {
    const onSaved = jest.fn();
    render(<UserForm user={null} onUserSaved={onSaved} onCancel={jest.fn()} />);
    await screen.findByRole("alert");
    fillNewUser();

    const submit = screen.getByRole("button", { name: "Crear usuario" });
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest("form")!);

    expect(mockCreate).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("no edita un usuario existente", async () => {
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await screen.findByRole("alert");

    fireEvent.submit(screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("'Reintentar' vuelve a pedir los roles y, si cargan, habilita el formulario", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await screen.findByRole("alert");
    mockGetRoles.mockResolvedValueOnce([{ id: "r-ventas", name: "VENTAS" }]);

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeEnabled();
  });
});

describe("UserForm — API sin roles asignables", () => {
  it("bloquea el guardado sin inventar opciones", async () => {
    mockGetRoles.mockResolvedValue([
      { id: "r-admin", name: "ADMINISTRADOR" },
      { id: "r-user", name: "USUARIO" },
    ]);
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No hay roles disponibles para asignar");
    expect(roleOptions()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeDisabled();
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
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS", "OPERACIONES"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("crea el usuario con el rol elegido", async () => {
    mockCreate.mockResolvedValue({});
    const onSaved = jest.fn();
    render(<UserForm user={null} onUserSaved={onSaved} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser();
    chooseRole("OPERACIONES");

    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ roleName: "OPERACIONES", email: "ana@empresa.com" });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("al editar un usuario con un rol no asignable, lo muestra explícito y no permite elegirlo para otro valor", async () => {
    const userWithUnassignableRole: User = {
      ...EXISTING_USER,
      role: { id: "r-admin", name: "ADMINISTRADOR" },
    };
    render(<UserForm user={userWithUnassignableRole} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    await waitFor(() => expect(roleGroup()).toBeEnabled());

    // El selector muestra el rol actual en vez de quedar vacío/ambiguo.
    expect(selectedRole()).toBe("ADMINISTRADOR");

    const options = roleOptions();
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
    render(<UserForm user={userWithUnassignableRole} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "ADMINISTRADOR" });
  });
});

/**
 * UserForm — solo reporta lo que persiste.
 *
 * 1. "Cancelar" cierra sin avisar éxito (antes llamaba a onUserSaved y la
 *    página mostraba "Usuario guardado correctamente").
 * 2. Al editar, email y documento son de solo lectura: UpdateUserRequest no
 *    los incluye, así que un cambio se descartaba y se mostraba "actualizado".
 */
describe("UserForm — sin éxitos simulados", () => {
  beforeEach(() => mockGetRoles.mockResolvedValue([{ id: "r-ventas", name: "VENTAS" }]));

  it("'Cancelar' llama a onCancel, no a onUserSaved, y no muestra éxito", async () => {
    const onSaved = jest.fn();
    const onCancel = jest.fn();
    render(<UserForm user={EXISTING_USER} onUserSaved={onSaved} onCancel={onCancel} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("al editar, email y documento son de solo lectura y no se envían", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    const email = screen.getByLabelText("Email");
    const document = screen.getByLabelText("DNI / Documento");
    expect(email).toBeDisabled();
    expect(email).toHaveValue("luis@empresa.com");
    expect(document).toBeDisabled();
    expect(document).toHaveValue("87654321");
    expect(email).toHaveAccessibleDescription("El correo y el documento no se pueden modificar desde aquí.");

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const payload = mockUpdate.mock.calls[0][1];
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("identityDocument");
  });

  it("al crear, email y documento son editables", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.getByLabelText("DNI / Documento")).toBeEnabled();
    expect(screen.queryByText(/no se pueden modificar/)).not.toBeInTheDocument();
  });
});
