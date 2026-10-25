import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import UsersPage from "@/app/usuarios/page";
import {
  getUsersByCompany,
  type UserStatusResponse,
  updateUserStatus,
} from "@/services/userService";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: { id: "actor" }, company: { id: "company" }, accessToken: "token" },
  }),
}));
jest.mock("@/components/header/HeaderConfig", () => ({
  HeaderConfig: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/components/modals/UserModal", () => ({ __esModule: true, default: () => null }));
jest.mock("../RolesPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../useCompanyRoles", () => ({
  useCompanyRoles: () => ({
    roles: [],
    loading: false,
    error: "",
    refresh: jest.fn(),
  }),
}));
jest.mock("@/services/userService", () => ({
  getUsersByCompany: jest.fn(),
  updateUserStatus: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const colleague = {
  id: "colleague",
  name: "Ana",
  surname: "Pérez",
  email: "ana@example.com",
  identityDocument: "12345678",
  status: true,
  role: { id: "sales", name: "VENTAS" },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getUsersByCompany).mockResolvedValue([{ ...colleague }]);
});

test("waits for confirmation, prevents duplicate requests, and reloads the persisted status", async () => {
  let confirm!: (result: UserStatusResponse) => void;
  jest.mocked(updateUserStatus).mockImplementation(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  const view = render(<UsersPage />);
  const button = await screen.findByRole("button", { name: "Desactivar Ana Pérez" });
  fireEvent.click(button);
  fireEvent.click(button);

  expect(updateUserStatus).toHaveBeenCalledTimes(1);
  expect(updateUserStatus).toHaveBeenCalledWith(
    "colleague",
    { status: false, expectedStatus: true },
    "token",
  );
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");
  expect(screen.getByText("Activo")).toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();

  jest.mocked(getUsersByCompany).mockResolvedValue([{ ...colleague, status: false }]);
  await act(async () => {
    confirm({ userId: "colleague", status: false });
  });
  await waitFor(() => expect(getUsersByCompany).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("button", { name: "Activar Ana Pérez" })).toBeEnabled();
  expect(screen.getByText("Inactivo")).toBeInTheDocument();
  expect(toast.success).toHaveBeenCalledWith("Usuario desactivado correctamente");

  view.unmount();
  render(<UsersPage />);
  expect(await screen.findByRole("button", { name: "Activar Ana Pérez" })).toBeEnabled();
  expect(screen.getByText("Inactivo")).toBeInTheDocument();
});

test("preserves the displayed state and shows the server denial on failure", async () => {
  jest.mocked(updateUserStatus).mockRejectedValue({
    isAxiosError: true,
    response: { status: 403, data: { message: "No puedes administrar esta cuenta protegida." } },
  });
  render(<UsersPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Desactivar Ana Pérez" }));
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith("No puedes administrar esta cuenta protegida."),
  );
  expect(screen.getByText("Activo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Desactivar Ana Pérez" })).toBeEnabled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(getUsersByCompany).toHaveBeenCalledTimes(1);
});

test("reactivates an inactive user using its current persisted status", async () => {
  jest.mocked(getUsersByCompany).mockResolvedValue([{ ...colleague, status: false }]);
  jest.mocked(updateUserStatus).mockResolvedValue({ userId: "colleague", status: true });
  render(<UsersPage />);
  const button = await screen.findByRole("button", { name: "Activar Ana Pérez" });
  jest.mocked(getUsersByCompany).mockResolvedValue([{ ...colleague, status: true }]);
  fireEvent.click(button);
  await waitFor(() =>
    expect(updateUserStatus).toHaveBeenCalledWith(
      "colleague",
      { status: true, expectedStatus: false },
      "token",
    ),
  );
  expect(await screen.findByRole("button", { name: "Desactivar Ana Pérez" })).toBeEnabled();
  expect(screen.getByText("Activo")).toBeInTheDocument();
  expect(toast.success).toHaveBeenCalledWith("Usuario activado correctamente");
});

test("refreshes stale data after a conflict without reporting a successful change", async () => {
  jest.mocked(updateUserStatus).mockRejectedValue({
    isAxiosError: true,
    response: { status: 409, data: { message: "El estado ya cambió en otra sesión." } },
  });
  render(<UsersPage />);
  const button = await screen.findByRole("button", { name: "Desactivar Ana Pérez" });
  jest.mocked(getUsersByCompany).mockResolvedValue([{ ...colleague, status: false }]);
  fireEvent.click(button);
  expect(await screen.findByRole("button", { name: "Activar Ana Pérez" })).toBeEnabled();
  expect(getUsersByCompany).toHaveBeenCalledTimes(2);
  expect(toast.error).toHaveBeenCalledWith("El estado ya cambió en otra sesión.");
  expect(toast.success).not.toHaveBeenCalled();
});

test("retains the confirmed status if the follow-up list refresh fails", async () => {
  jest.mocked(updateUserStatus).mockResolvedValue({ userId: "colleague", status: false });
  render(<UsersPage />);
  const button = await screen.findByRole("button", { name: "Desactivar Ana Pérez" });
  jest.mocked(getUsersByCompany).mockRejectedValue(new Error("List unavailable"));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  fireEvent.click(button);
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar usuarios"));
  expect(screen.getByText("Inactivo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Activar Ana Pérez" })).toBeEnabled();
  expect(toast.success).toHaveBeenCalledWith("Usuario desactivado correctamente");
  log.mockRestore();
});

test("blocks self and administrator status changes while keeping ordinary users available", async () => {
  jest.mocked(getUsersByCompany).mockResolvedValue([
    { ...colleague },
    { ...colleague, id: "actor", name: "Mi", surname: "Cuenta" },
    {
      ...colleague,
      id: "admin",
      name: "Otro",
      surname: "Administrador",
      role: { id: "admin-role", name: " administrador " },
    },
  ]);
  render(<UsersPage />);
  expect(await screen.findByRole("button", { name: "Desactivar Mi Cuenta" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Desactivar Otro Administrador" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Desactivar Mi Cuenta" }));
  fireEvent.click(screen.getByRole("button", { name: "Desactivar Otro Administrador" }));
  expect(updateUserStatus).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Desactivar Ana Pérez" })).toBeEnabled();
});
