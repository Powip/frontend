import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "@/app/usuarios/page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" },
  }),
}));
jest.mock("@/components/header/HeaderConfig", () => ({
  HeaderConfig: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/components/modals/UserModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../RolesPanel", () => ({ __esModule: true, default: () => <p>Gestor de perfiles</p> }));
jest.mock("../useCompanyRoles", () => ({
  useCompanyRoles: () => ({
    scope: "company:actor",
    access: { canRead: true, canWrite: true },
    roles: [{ id: "custom", assignmentName: "CUSTOM_UUID", name: "Asesor catálogo" }],
    loading: false,
    error: "",
    refresh: jest.fn(),
  }),
}));
jest.mock("@/services/userService", () => ({
  getUsersByCompany: jest.fn().mockResolvedValue([
    {
      id: "colleague",
      name: "Ana",
      surname: "Pérez",
      email: "ana@example.com",
      identityDocument: "12345678",
      status: true,
      role: { id: "custom", name: "CUSTOM_UUID" },
    },
  ]),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
test("existing users table keeps custom role labels and switches to role manager", async () => {
  const user = userEvent.setup();
  render(<UsersPage />);
  expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
  expect(screen.getByText("Asesor catálogo")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Usuarios y roles" })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Roles y permisos" }));
  expect(screen.getByText("Gestor de perfiles")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Usuarios" }));
  expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
});
