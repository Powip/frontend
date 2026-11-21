/**
 * Tests: Configuración › Usuarios y almacenes (FEAT-24 H6).
 *
 * 1. Solo el Administrador la usa.
 * 2. Muestra lo asignado y guarda con PUT /user-warehouses reemplazando la lista del usuario.
 * 3. «Todos» guarda la lista vacía (ve y opera todos); sin «Todos» y sin almacenes no deja guardar.
 * 4. Tu propia fila no se edita.
 * 5. Si la sesión venció y no se pudo renovar, lo dice claro (no «No hay usuarios»).
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getUsersByCompany } from "@/services/userService";
import { listUserWarehouses, saveUserWarehouses } from "@/services/userWarehousesService";
import { listWarehouses } from "@/services/warehousesService";
import UserWarehousesView from "../users/UserWarehousesView";
import { WAREHOUSES } from "./fixtures";

const mockUser = { id: "u-1", role: "ADMINISTRADOR", email: "admin@empresa.pe", permissions: [] as string[] };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: mockUser } }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/userService", () => ({ getUsersByCompany: jest.fn() }));
jest.mock("@/services/userWarehousesService", () => ({ listUserWarehouses: jest.fn(), saveUserWarehouses: jest.fn(), getMyWarehouses: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const users = [
  { id: "u-1", name: "Octa", surname: "Admin", email: "admin@empresa.pe", status: true, role: { id: "r-1", name: "ADMINISTRADOR" } },
  { id: "u-2", name: "Luis", surname: "Pérez", email: "luis@empresa.pe", status: true, role: { id: "r-2", name: "ALMACEN" } },
  { id: "u-3", name: "Ana", surname: "Ríos", email: "ana@empresa.pe", status: true, role: { id: "r-3", name: "VENTAS" } },
];

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UserWarehousesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.role = "ADMINISTRADOR";
  jest.mocked(getUsersByCompany).mockResolvedValue(users);
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
  jest.mocked(listUserWarehouses).mockResolvedValue([{ userId: "u-2", inventoryId: "w-1", inventoryName: "Central", canOperate: true }]);
  jest.mocked(saveUserWarehouses).mockResolvedValue(undefined);
});

describe("Usuarios y almacenes", () => {
  it("quien no es Administrador no la ve ni pide datos", () => {
    mockUser.role = "OPERACIONES";
    setup();
    expect(screen.getByRole("alert")).toHaveTextContent("Solo el Administrador puede ver y asignar los almacenes de los usuarios.");
    expect(getUsersByCompany).not.toHaveBeenCalled();
    expect(listUserWarehouses).not.toHaveBeenCalled();
  });

  it("muestra lo asignado y guarda la lista nueva del usuario con PUT", async () => {
    const user = userEvent.setup();
    setup();
    const luis = await screen.findByTestId("user-row-u-2");
    await waitFor(() => expect(within(luis).getByLabelText("Central: Luis Pérez")).toHaveValue("operate"));
    expect(within(luis).getByRole("checkbox", { name: "Todos los almacenes: Luis Pérez" })).not.toBeChecked();
    expect(within(luis).getByLabelText("Tienda Sur: Luis Pérez")).toHaveValue("none");
    expect(within(luis).getByRole("button", { name: "Guardar almacenes de Luis Pérez" })).toBeDisabled();
    await user.selectOptions(within(luis).getByLabelText("Tienda Sur: Luis Pérez"), "view");
    await user.click(within(luis).getByRole("button", { name: "Guardar almacenes de Luis Pérez" }));
    await waitFor(() =>
      expect(saveUserWarehouses).toHaveBeenCalledWith({
        userId: "u-2",
        warehouses: [
          { inventoryId: "w-1", canOperate: true },
          { inventoryId: "w-2", canOperate: false },
        ],
      }),
    );
  });

  it("«Todos» guarda la lista vacía; sin «Todos» y sin almacenes no deja guardar", async () => {
    const user = userEvent.setup();
    setup();
    const ana = await screen.findByTestId("user-row-u-3");
    const all = within(ana).getByRole("checkbox", { name: "Todos los almacenes: Ana Ríos" });
    expect(all).toBeChecked();
    expect(within(ana).getByLabelText("Central: Ana Ríos")).toBeDisabled();
    await user.click(all);
    expect(within(ana).getByText(/Elige al menos un almacén o marca «Todos»/)).toBeInTheDocument();
    expect(within(ana).getByRole("button", { name: "Guardar almacenes de Ana Ríos" })).toBeDisabled();
    await user.selectOptions(within(ana).getByLabelText("Shalom: Ana Ríos"), "operate");
    await user.click(within(ana).getByRole("button", { name: "Guardar almacenes de Ana Ríos" }));
    await waitFor(() => expect(saveUserWarehouses).toHaveBeenCalledWith({ userId: "u-3", warehouses: [{ inventoryId: "w-3", canOperate: true }] }));

    const luis = screen.getByTestId("user-row-u-2");
    await user.click(within(luis).getByRole("checkbox", { name: "Todos los almacenes: Luis Pérez" }));
    await user.click(within(luis).getByRole("button", { name: "Guardar almacenes de Luis Pérez" }));
    await waitFor(() => expect(saveUserWarehouses).toHaveBeenCalledWith({ userId: "u-2", warehouses: [] }));
  });

  it("tu propia fila no se edita", async () => {
    setup();
    const self = await screen.findByTestId("user-row-u-1");
    expect(within(self).getByRole("checkbox", { name: "Todos los almacenes: Octa Admin" })).toBeDisabled();
    expect(within(self).queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    expect(within(self).getByText("Tus propios almacenes no se cambian desde tu sesión.")).toBeInTheDocument();
  });

  it("sesión vencida sin renovar: avisa que inicie sesión y no dice «No hay usuarios»", async () => {
    jest.mocked(getUsersByCompany).mockRejectedValue({ response: { status: 401, data: {} } });
    setup();
    expect(await screen.findByText("Tu sesión venció. Vuelve a iniciar sesión.")).toBeInTheDocument();
    expect(screen.getByText("No se pudo cargar la lista de usuarios.")).toBeInTheDocument();
    expect(screen.queryByText("No hay usuarios en la empresa.")).not.toBeInTheDocument();
  });
});
