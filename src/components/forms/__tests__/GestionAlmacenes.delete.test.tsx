/**
 * Tests: eliminar un almacén desde GestionAlmacenes (FEAT-24 H1-A).
 *
 * Regla de Octa (11-03): se puede eliminar, pero el diálogo muestra el nombre
 * del almacén y solo habilita "Eliminar" cuando se escribe ese nombre exacto.
 * El backend (ms-logistics) decide si está vacío y sin referencias, y rechaza
 * el principal; aquí se prueba lo que ve y hace la pantalla.
 */

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteWarehouse,
  listWarehouses,
  type CompanyWarehouse,
  type CompanyWarehouses,
} from "@/services/warehousesService";
import GestionAlmacenes from "../GestionAlmacenes";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("../../modals/AlmacenModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/services/warehousesService", () => ({
  listWarehouses: jest.fn(),
  createWarehouse: jest.fn(),
  setWarehouseType: jest.fn(),
  setMainWarehouse: jest.fn(),
  setStoreDefaultWarehouse: jest.fn(),
  deleteWarehouse: jest.fn(),
}));

const mockList = jest.mocked(listWarehouses);
const mockDelete = jest.mocked(deleteWarehouse);
const refreshInventories = jest.fn();

const COMPANY = "company-a";
const STORE = "store-a";

const warehouse = (over: Partial<CompanyWarehouse> & Pick<CompanyWarehouse, "id" | "name">): CompanyWarehouse => ({
  status: true,
  store_id: STORE,
  company_id: COMPANY,
  type: "PROPIO",
  is_main: false,
  ...over,
});

const PRINCIPAL = warehouse({ id: "w-main", name: "Almacén Principal", is_main: true });
const BRENA = warehouse({ id: "w-brena", name: "Almacén Breña" });
const SUR = warehouse({ id: "w-sur", name: "Almacén Sur" });

const payload = (warehouses: CompanyWarehouse[] = [PRINCIPAL, BRENA, SUR]): CompanyWarehouses => ({
  warehouses,
  links: [{ store_id: STORE, inventory_id: PRINCIPAL.id, is_default: true }],
});

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GestionAlmacenes />
    </QueryClientProvider>,
  );
};

const openDialog = async (user: ReturnType<typeof userEvent.setup>, name = "Almacén Breña") => {
  await user.click(await screen.findByRole("button", { name: `Eliminar almacén ${name}` }));
  return screen.getByRole("alertdialog");
};

const typeName = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, text: string) => {
  const input = within(dialog).getByLabelText(/escribe el nombre del almacén/i);
  await user.clear(input);
  if (text) await user.type(input, text);
};

const confirmDeletion = async (user: ReturnType<typeof userEvent.setup>, name = "Almacén Breña") => {
  const dialog = await openDialog(user, name);
  await typeName(user, dialog, name);
  await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "test-token",
      user: { id: "user-a" },
      company: { id: COMPANY, name: "Corporación", stores: [{ id: STORE, name: "LIVII" }] },
    },
    selectedStoreId: STORE,
    refreshInventories,
  } as unknown as ReturnType<typeof useAuth>);
  mockList.mockResolvedValue(payload());
  mockDelete.mockResolvedValue(undefined);
  refreshInventories.mockResolvedValue(undefined);
});

describe("Eliminar almacén con confirmación por nombre", () => {
  it("muestra el nombre del almacén, explica la regla y cancelar no envía nada", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    const dialog = await openDialog(user);
    expect(within(dialog).getByRole("heading", { name: "Eliminar almacén" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Vas a eliminar Almacén Breña");
    expect(dialog).toHaveTextContent("vacíos, sin productos, movimientos, pedidos ni integraciones vinculadas");
    expect(dialog).toHaveTextContent("Para confirmar, escribe el nombre del almacén: Almacén Breña");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("deja Eliminar deshabilitado hasta escribir el nombre exacto", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole("button", { name: "Eliminar" });
    expect(confirm).toBeDisabled();

    await typeName(user, dialog, "Almacén Bre");
    expect(confirm).toBeDisabled();
    await typeName(user, dialog, "almacén breña"); // otra capitalización
    expect(confirm).toBeDisabled();
    await typeName(user, dialog, "Almacen Breña"); // sin tilde
    expect(confirm).toBeDisabled();
    await typeName(user, dialog, "Almacén Sur"); // el nombre de otro almacén
    expect(confirm).toBeDisabled();
    expect(mockDelete).not.toHaveBeenCalled();

    await typeName(user, dialog, "Almacén Breña");
    expect(confirm).toBeEnabled();
    await typeName(user, dialog, "  Almacén Breña  "); // espacios en los extremos no cuentan
    expect(confirm).toBeEnabled();
  });

  it("al abrir otra vez el diálogo el campo vuelve vacío", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    let dialog = await openDialog(user);
    await typeName(user, dialog, "Almacén Breña");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    dialog = await openDialog(user, "Almacén Sur");
    expect(within(dialog).getByLabelText(/escribe el nombre del almacén/i)).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Eliminar" })).toBeDisabled();
  });

  it("el principal no se puede eliminar: el botón está deshabilitado y no abre el diálogo", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    const button = await screen.findByRole("button", { name: "Eliminar almacén Almacén Principal" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("envía un solo DELETE con el id, bloquea acciones repetidas y refresca lista e inventarios", async () => {
    let finishDelete!: () => void;
    mockDelete.mockReturnValue(new Promise<void>((resolve) => { finishDelete = resolve; }));
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await confirmDeletion(user);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith("w-brena");
    // Mientras se procesa: el diálogo sigue abierto, sin segundo envío posible.
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Eliminar" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();

    mockList.mockResolvedValue(payload([PRINCIPAL, SUR]));
    await act(async () => finishDelete());
    await waitFor(() => expect(refreshInventories).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Eliminar almacén Almacén Breña" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Eliminar almacén Almacén Sur" })).toBeEnabled();
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Almacén eliminado correctamente");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("Enter en el campo elimina solo cuando el nombre coincide", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    const dialog = await openDialog(user);
    const input = within(dialog).getByLabelText(/escribe el nombre del almacén/i);
    await user.type(input, "Almacén Bre{Enter}");
    expect(mockDelete).not.toHaveBeenCalled();
    await user.type(input, "ña{Enter}");
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("w-brena"));
  });

  it("muestra el motivo del backend (409), conserva el almacén y no avisa éxito", async () => {
    const message = "No se puede eliminar este almacén porque tiene productos, movimientos, pedidos o integraciones vinculadas.";
    mockDelete.mockRejectedValue({ response: { status: 409, data: { message } } });
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await confirmDeletion(user);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Eliminar almacén Almacén Breña" })).toBeEnabled();
    expect(refreshInventories).not.toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("convierte una lista de mensajes de validación en un texto legible", async () => {
    mockDelete.mockRejectedValue({
      response: { data: { message: [" Almacén vinculado a pedidos ", null, "Revisa sus referencias"] } },
    });
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await confirmDeletion(user);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Almacén vinculado a pedidos. Revisa sus referencias"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("usa un mensaje claro cuando falla la petición sin mensaje del backend", async () => {
    mockDelete.mockRejectedValue(new Error("Network Error"));
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await confirmDeletion(user);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar el almacén. Inténtalo nuevamente."),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(refreshInventories).not.toHaveBeenCalled();
  });

  it("avisa aparte si falla refrescar la información después de eliminar", async () => {
    refreshInventories.mockRejectedValue(new Error("Refresh unavailable"));
    mockList.mockResolvedValueOnce(payload()).mockResolvedValue(payload([PRINCIPAL, SUR]));
    const user = userEvent.setup({ delay: null });
    renderScreen();
    await confirmDeletion(user);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "El almacén se eliminó, pero no se pudo actualizar la información. Actualiza la página.",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Almacén eliminado correctamente");
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
