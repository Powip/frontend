import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import UserForm from "@/components/forms/UserForm";
import type { User } from "@/interfaces/IUser";
import { createCompanyUser, updateUser } from "@/services/userService";
import { useCompanyRoles } from "../useCompanyRoles";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "token", user: { id: "actor" }, company: { id: "company" } },
  }),
}));
jest.mock("../useCompanyRoles", () => ({ useCompanyRoles: jest.fn() }));
jest.mock("@/services/userService", () => ({
  createCompanyUser: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const existing: User = {
  id: "colleague",
  name: "Ana",
  surname: "Pérez",
  email: "ana@example.com",
  identityDocument: "12345678",
  status: true,
  role: { id: "sales", name: "VENTAS" },
};
const custom = {
  id: "custom",
  name: "Asesor catálogo",
  assignmentName: "CUSTOM_UUID",
  isCustom: true,
  isSystem: false,
  assignable: true,
  canEditPermissions: true,
  userCount: 0,
  permissionsVersion: 0,
};
function submit(name: string) {
  const form = screen.getByRole("button", { name }).closest("form");
  if (!form) throw new Error("Expected a user form");
  fireEvent.submit(form);
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCompanyRoles).mockReturnValue({
    scope: "actor:company",
    access: { userId: "actor", companyId: "company", canRead: true, canWrite: false },
    roles: [custom],
    loading: false,
    error: "",
    refresh: jest.fn(),
  });
  jest.mocked(updateUser).mockResolvedValue({});
  jest.mocked(createCompanyUser).mockResolvedValue({});
});
test("selects custom display name and sends its server assignmentName", async () => {
  const saved = jest.fn();
  render(<UserForm user={existing} onUserSaved={saved} />);
  expect(screen.getByRole("option", { name: "Asesor catálogo" })).toHaveValue("CUSTOM_UUID");
  fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), {
    target: { value: "CUSTOM_UUID" },
  });
  submit("Actualizar Usuario");
  await waitFor(() =>
    expect(updateUser).toHaveBeenCalledWith(
      "colleague",
      expect.objectContaining({ roleName: "CUSTOM_UUID" }),
      "token",
    ),
  );
  expect(saved).toHaveBeenCalled();
  expect(screen.queryByLabelText(/Contraseña/)).not.toBeInTheDocument();
  expect(jest.mocked(updateUser).mock.calls[0][1]).not.toHaveProperty("password");
});

test("creation requires a password and sends it only when creating the user", async () => {
  const saved = jest.fn();
  render(<UserForm user={null} onUserSaved={saved} />);
  const password = screen.getByLabelText("Contraseña");
  expect(password).toBeRequired();
  expect(password).toHaveAttribute("autocomplete", "new-password");
  fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), {
    target: { value: "CUSTOM_UUID" },
  });
  submit("Crear Usuario");
  expect(createCompanyUser).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith("La contraseña es obligatoria para nuevos usuarios");

  fireEvent.change(password, { target: { value: "newpassword123" } });
  submit("Crear Usuario");
  await waitFor(() =>
    expect(createCompanyUser).toHaveBeenCalledWith(
      "company",
      expect.objectContaining({ password: "newpassword123", roleName: "CUSTOM_UUID" }),
      "token",
    ),
  );
  expect(updateUser).not.toHaveBeenCalled();
  expect(saved).toHaveBeenCalled();
});
test("role load failure exposes retry, no invented roles, and blocks saving", () => {
  const refresh = jest.fn();
  jest.mocked(useCompanyRoles).mockReturnValue({
    scope: "actor:company",
    access: null,
    roles: [],
    loading: false,
    error: "No se pudieron cargar los perfiles",
    refresh,
  });
  render(<UserForm user={null} onUserSaved={jest.fn()} />);
  expect(screen.getByRole("combobox", { name: "Rol" })).toBeDisabled();
  expect(screen.queryByRole("option", { name: "AGENTES" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Crear Usuario" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar perfiles" }));
  expect(refresh).toHaveBeenCalled();
  submit("Crear Usuario");
  expect(createCompanyUser).not.toHaveBeenCalled();
});
test("own protected role remains visible and unchanged updates omit role assignment", async () => {
  render(
    <UserForm
      user={{ ...existing, id: "actor", role: { id: "admin", name: "ADMINISTRADOR" } }}
      onUserSaved={jest.fn()}
    />,
  );
  expect(screen.getByRole("option", { name: "ADMINISTRADOR (actual)" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Rol" })).toBeDisabled();
  submit("Actualizar Usuario");
  await waitFor(() => expect(updateUser).toHaveBeenCalled());
  expect(jest.mocked(updateUser).mock.calls[0][1]).not.toHaveProperty("roleName");
});
