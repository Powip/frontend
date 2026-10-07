import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/userService", () => ({
  getRoles: jest.fn(),
  createCompanyUser: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("@/components/ui/select", () => {
  const R = jest.requireActual("react");
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

const SESSION = {
  accessToken: "token",
  company: { id: "company-1" },
  user: { id: "admin-1", role: "ADMINISTRADOR" },
};

const authWith = (auth: unknown) =>
  jest.mocked(useAuth).mockReturnValue({ auth } as unknown as ReturnType<typeof useAuth>);

beforeEach(() => {
  jest.clearAllMocks();
  authWith(SESSION);
  mockGetRoles.mockResolvedValue([
    { id: "r-ventas", name: "VENTAS" },
    { id: "r-ops", name: "OPERACIONES" },
  ]);
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
const departmentSelect = () => screen.getByRole("combobox", { name: "department" }) as HTMLSelectElement;
const passwordInput = () => screen.getByLabelText(/^Contraseña/);
const submitForm = (name: string) =>
  fireEvent.submit(screen.getByRole("button", { name }).closest("form") as HTMLFormElement);

const EXISTING_USER: User = {
  id: "u-9",
  identityDocument: "87654321",
  name: "Luis",
  surname: "Paz",
  email: "luis@empresa.com",
  province: "Lima",
  district: "Ate",
  status: true,
  role: { id: "r-ventas", name: "VENTAS" },
};

function fillNewUser({ password = "clave123", ...overrides }: Partial<Record<string, string>> = {}) {
  const values = {
    Nombre: "Ana",
    Apellidos: "Torres",
    Email: "ana@empresa.com",
    "DNI / Documento": "12345678",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.change(passwordInput(), { target: { value: password } });
  chooseRole("VENTAS");
}

describe("UserForm — validación de campos", () => {
  it("recorta los campos de texto y envía la contraseña sin transformar", async () => {
    mockCreate.mockResolvedValue({});
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser({
      Nombre: "  Ana ",
      Apellidos: " Torres  ",
      Email: " ana@empresa.com ",
      "DNI / Documento": " 12345678 ",
      password: " clave123 ",
    });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: " 912345678 " } });
    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: " Av. Lima 1 " } });

    submitForm("Crear usuario");

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({
      name: "Ana",
      surname: "Torres",
      email: "ana@empresa.com",
      identityDocument: "12345678",
      phoneNumber: "912345678",
      address: "Av. Lima 1",
      password: " clave123 ",
    });
  });

  it("rechaza obligatorios que quedan vacíos tras recortar", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser({ Nombre: "   ", "DNI / Documento": "  " });

    submitForm("Crear usuario");

    expect(screen.getByLabelText("Nombre")).toHaveAccessibleDescription("Completá este campo.");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("DNI / Documento")).toHaveAccessibleDescription("Completá este campo.");
    expect(screen.getByLabelText("Apellidos")).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveFocus());
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("el error del campo desaparece al corregirlo", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser({ Nombre: "   " });
    submitForm("Crear usuario");
    expect(screen.getByText("Completá este campo.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });

    expect(screen.queryByText("Completá este campo.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).not.toHaveAttribute("aria-invalid");
  });

  it("rechaza un email con formato inválido junto al campo", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser({ Email: "ana-sin-arroba" });

    submitForm("Crear usuario");

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Ingresá un email válido.");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("pide elegir un rol junto al selector", async () => {
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "Torres" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@empresa.com" } });
    fireEvent.change(screen.getByLabelText("DNI / Documento"), { target: { value: "12345678" } });
    fireEvent.change(passwordInput(), { target: { value: "clave123" } });

    submitForm("Crear usuario");

    expect(roleGroup()).toHaveAccessibleDescription("Elegí un rol para el usuario.");
    await waitFor(() => expect(roleOptions()[0]).toHaveFocus());
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("al editar rechaza nombre vacío tras recortar", async () => {
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Apellidos"), { target: { value: "  " } });

    submitForm("Guardar cambios");

    expect(screen.getByLabelText("Apellidos")).toHaveAccessibleDescription("Completá este campo.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it.each(["abc12", "clavesinnumero", "CLAVE123"])(
    "al crear rechaza la contraseña '%s' que no cumple la política actual",
    async (password) => {
      render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
      await waitFor(() => expect(roleGroup()).toBeEnabled());
      fillNewUser({ password });

      submitForm("Crear usuario");

      expect(passwordInput()).toHaveAccessibleDescription(
        expect.stringContaining("La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número."),
      );
      expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
      expect(mockCreate).not.toHaveBeenCalled();
    },
  );

  it("al editar valida la contraseña solo si se completó", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    fireEvent.change(passwordInput(), { target: { value: "corta" } });
    submitForm("Guardar cambios");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Más datos" })).toHaveAttribute("aria-selected", "true"));
    await waitFor(() => expect(passwordInput()).toHaveFocus());

    fireEvent.change(passwordInput(), { target: { value: "" } });
    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty("password");
  });

  it("la contraseña usa autoComplete new-password al crear y al editar", async () => {
    const { unmount } = render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    expect(passwordInput()).toHaveAttribute("autocomplete", "new-password");
    unmount();

    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    expect(passwordInput()).toHaveAttribute("autocomplete", "new-password");
    await waitFor(() => expect(roleGroup()).toBeEnabled());
  });
});

describe("UserForm — rol propio", () => {
  const SELF: User = { ...EXISTING_USER, id: "admin-1", role: { id: "r-admin", name: "ADMINISTRADOR" } };

  it("deshabilita el selector y reenvía el rol actual", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={SELF} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await screen.findByText("No podés cambiar tu propio rol.");
    await waitFor(() => expect(roleOptions()).toHaveLength(3));

    expect(roleGroup()).toBeDisabled();
    expect(selectedRole()).toBe("ADMINISTRADOR");

    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "ADMINISTRADOR" });
  });

  it("handleSubmit rechaza un cambio del propio rol aunque llegue al formulario", async () => {
    render(<UserForm user={SELF} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleOptions()).toHaveLength(3));

    chooseRole("VENTAS");
    submitForm("Guardar cambios");

    expect(toast.error).toHaveBeenCalledWith("No podés cambiar tu propio rol");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("otro usuario sigue pudiendo cambiar de rol", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    expect(screen.queryByText("No podés cambiar tu propio rol.")).not.toBeInTheDocument();

    chooseRole("OPERACIONES");
    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "OPERACIONES" });
  });
});

describe("UserForm — ubicación", () => {
  it("inicializa el departamento desde city si la respuesta no trae department", async () => {
    mockUpdate.mockResolvedValue({});
    render(
      <UserForm user={{ ...EXISTING_USER, city: "Lima" }} onUserSaved={jest.fn()} onCancel={jest.fn()} />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    expect(departmentSelect().value).toBe("Lima");

    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ city: "Lima", province: "Lima", district: "Ate" });
  });

  it("prefiere department cuando la respuesta trae ambos", async () => {
    render(
      <UserForm
        user={{ ...EXISTING_USER, department: "Lima", city: "Cusco" }}
        onUserSaved={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    expect(departmentSelect().value).toBe("Lima");
  });

  it("al editar sin departamento no envía city vacío", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty("city");
  });

  it("el alta conserva la clave department", async () => {
    mockCreate.mockResolvedValue({});
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    fillNewUser();
    fireEvent.change(departmentSelect(), { target: { value: "Lima" } });

    submitForm("Crear usuario");

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ department: "Lima" });
    expect(mockCreate.mock.calls[0][1]).not.toHaveProperty("city");
  });
});

describe("UserForm — sin sesión", () => {
  it("no queda en 'Cargando roles', no pide roles y no permite guardar", async () => {
    authWith({ ...SESSION, accessToken: undefined });
    render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sesión no disponible. Volvé a iniciar sesión para cargar los roles.",
    );
    expect(mockGetRoles).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeDisabled();

    submitForm("Crear usuario");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("UserForm — carga de roles", () => {
  it("si cambia el token, la respuesta de la carga anterior se descarta", async () => {
    const pending: Array<(roles: unknown) => void> = [];
    mockGetRoles.mockImplementation(() => new Promise((resolve) => pending.push(resolve as (roles: unknown) => void)));
    const { rerender } = render(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);

    authWith({ ...SESSION, accessToken: "token-2" });
    rerender(<UserForm user={null} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    expect(mockGetRoles).toHaveBeenLastCalledWith("token-2");

    pending[1]([{ id: "r-ventas", name: "VENTAS" }]);
    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS"]));

    pending[0]([]);
    await waitFor(() => expect(roleOptions().map((o) => o.value)).toEqual(["VENTAS"]));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear usuario" })).toBeEnabled();
  });
});

describe("UserForm — guardado pendiente", () => {
  it("un segundo envío mientras guarda no duplica la petición y avisa el estado", async () => {
    let resolveUpdate!: (value: unknown) => void;
    mockUpdate.mockImplementation(() => new Promise((resolve) => (resolveUpdate = resolve)));
    const onSaved = jest.fn();
    const onSavingChange = jest.fn();
    render(
      <UserForm
        user={EXISTING_USER}
        onUserSaved={onSaved}
        onCancel={jest.fn()}
        onSavingChange={onSavingChange}
      />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    submitForm("Guardar cambios");
    submitForm("Guardando...");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(onSavingChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolveUpdate({});

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
  });

  it("si el guardado falla, libera el bloqueo sin reportar éxito", async () => {
    mockUpdate.mockRejectedValue({ response: { data: { message: "Error de ms-auth" } } });
    const onSaved = jest.fn();
    const onSavingChange = jest.fn();
    render(
      <UserForm
        user={EXISTING_USER}
        onUserSaved={onSaved}
        onCancel={jest.fn()}
        onSavingChange={onSavingChange}
      />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    submitForm("Guardar cambios");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error de ms-auth"));
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });

  it("si se desmonta durante el guardado, libera su bloqueo una vez y no llama a callbacks después", async () => {
    let resolveUpdate!: (value: unknown) => void;
    mockUpdate.mockImplementation(() => new Promise((resolve) => (resolveUpdate = resolve)));
    const onSaved = jest.fn();
    const onSavingChange = jest.fn();
    const { unmount } = render(
      <UserForm
        user={EXISTING_USER}
        onUserSaved={onSaved}
        onCancel={jest.fn()}
        onSavingChange={onSavingChange}
      />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    submitForm("Guardar cambios");
    expect(onSavingChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(onSavingChange).toHaveBeenCalledTimes(2);
    expect(onSavingChange).toHaveBeenLastCalledWith(false);

    resolveUpdate({});

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Usuario actualizado exitosamente"));
    expect(onSaved).not.toHaveBeenCalled();
    expect(onSavingChange).toHaveBeenCalledTimes(2);
  });

  it("al desmontarse sin guardado en curso no notifica nada", async () => {
    const onSavingChange = jest.fn();
    const { unmount } = render(
      <UserForm user={EXISTING_USER} onUserSaved={jest.fn()} onCancel={jest.fn()} onSavingChange={onSavingChange} />,
    );
    await waitFor(() => expect(roleGroup()).toBeEnabled());

    unmount();

    expect(onSavingChange).not.toHaveBeenCalled();
  });

  it("con un onSavingChange nuevo en cada render, solo libera el bloqueo al desmontarse", async () => {
    let resolveUpdate!: (value: unknown) => void;
    mockUpdate.mockImplementation(() => new Promise((resolve) => (resolveUpdate = resolve)));
    const calls: boolean[] = [];
    const renderForm = () => (
      <UserForm
        user={EXISTING_USER}
        onUserSaved={jest.fn()}
        onCancel={jest.fn()}
        onSavingChange={(saving) => calls.push(saving)}
      />
    );
    const { rerender } = render(renderForm());
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    submitForm("Guardar cambios");

    rerender(renderForm());
    rerender(renderForm());

    expect(calls).toEqual([true]);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();

    resolveUpdate({});
    await waitFor(() => expect(calls).toEqual([true, false]));
  });
});

describe("UserForm — edición propia sin rol", () => {
  const SELF_WITHOUT_ROLE: User = { ...EXISTING_USER, id: "admin-1", role: null };
  const MESSAGE =
    "Tu usuario no tiene un rol asignado y no podés asignártelo vos. No se pueden guardar cambios en tu perfil desde aquí hasta que otro administrador te asigne un rol.";

  it("explica por qué no puede guardarse, sin ofrecer ni enviar un rol", async () => {
    render(<UserForm user={SELF_WITHOUT_ROLE} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleOptions()).toHaveLength(2));

    expect(screen.getByRole("status")).toHaveTextContent(MESSAGE);
    expect(screen.queryByText("No podés cambiar tu propio rol.")).not.toBeInTheDocument();
    expect(roleGroup()).toBeDisabled();
    expect(selectedRole()).toBe("");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();

    submitForm("Guardar cambios");

    expect(toast.error).toHaveBeenCalledWith(MESSAGE);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("aunque llegue un rol al formulario, no permite autoasignárselo", async () => {
    render(<UserForm user={SELF_WITHOUT_ROLE} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleOptions()).toHaveLength(2));

    chooseRole("VENTAS");
    submitForm("Guardar cambios");

    expect(toast.error).toHaveBeenCalledWith(MESSAGE);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("otro usuario sin rol sigue pudiendo recibir uno", async () => {
    mockUpdate.mockResolvedValue({});
    render(<UserForm user={{ ...EXISTING_USER, role: null }} onUserSaved={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(roleGroup()).toBeEnabled());
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    chooseRole("VENTAS");
    submitForm("Guardar cambios");

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ roleName: "VENTAS" });
  });
});
