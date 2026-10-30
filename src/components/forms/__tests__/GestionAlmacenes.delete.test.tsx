import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import GestionAlmacenes from "../GestionAlmacenes";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    isAxiosError: (error: unknown) => Boolean(
      error && typeof error === "object" && "isAxiosError" in error,
    ),
  },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../modals/AlmacenModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const inventories = [
  { id: "empty-id", name: "Almacén vacío", store_id: "store-id", status: true },
  { id: "used-id", name: "Almacén en uso", store_id: "store-id", status: true },
];
const refreshInventories = jest.fn();
const mockGet = jest.mocked(axiosAuth.get);
const mockDelete = jest.mocked(axiosAuth.delete);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_API_INVENTORY = "https://inventory.example.test";
  mockGet.mockReset().mockResolvedValue({ data: inventories });
  mockDelete.mockReset().mockResolvedValue({ data: { message: "Almacén eliminado" } });
  refreshInventories.mockReset().mockResolvedValue(undefined);
  jest.mocked(useAuth).mockReturnValue({
    auth: { company: { id: "company-id", stores: [{ id: "store-id" }] } },
    refreshInventories,
  } as unknown as ReturnType<typeof useAuth>);
});

async function confirmDeletion() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Eliminar almacén Almacén vacío" }));
  const dialog = screen.getByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Eliminar", exact: true }));
  return user;
}

test("explains that only unused empty warehouses can be deleted and cancellation sends no request", async () => {
  const user = userEvent.setup();
  render(<GestionAlmacenes />);
  await user.click(await screen.findByRole("button", { name: "Eliminar almacén Almacén vacío" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent("está vacío y no tiene productos, movimientos, pedidos ni integraciones vinculadas");
  expect(dialog).toHaveTextContent("El stock y el historial de los almacenes en uso se conservan");
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
  expect(mockDelete).not.toHaveBeenCalled();
});

test("sends one confirmed DELETE, blocks repeated actions, and refreshes both inventory views", async () => {
  let finishDelete!: () => void;
  mockDelete.mockReturnValue(new Promise((resolve) => {
    finishDelete = () => resolve({ data: {} });
  }));
  mockGet.mockResolvedValueOnce({ data: inventories })
    .mockResolvedValue({ data: [inventories[1]] });
  render(<GestionAlmacenes />);
  const user = await confirmDeletion();

  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith("https://inventory.example.test/inventory/empty-id");
  const usedButton = screen.getByRole("button", { name: "Eliminar almacén Almacén en uso" });
  expect(usedButton).toBeDisabled();
  expect(screen.getByRole("button", { name: "Eliminar almacén Almacén vacío" })).toHaveAttribute("aria-busy", "true");
  await user.click(usedButton);
  expect(mockDelete).toHaveBeenCalledTimes(1);

  await act(async () => finishDelete());
  await waitFor(() => expect(refreshInventories).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("button", { name: "Eliminar almacén Almacén en uso" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "Eliminar almacén Almacén vacío" })).not.toBeInTheDocument();
  expect(toast.success).toHaveBeenCalledWith("Almacén eliminado correctamente");
});

test("shows the backend stock conflict and keeps the warehouse without reporting success", async () => {
  const message = "No se puede eliminar un almacén con productos o movimientos.";
  mockDelete.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message } } });
  render(<GestionAlmacenes />);
  await confirmDeletion();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
  expect(screen.getByRole("button", { name: "Eliminar almacén Almacén vacío" })).toBeEnabled();
  expect(refreshInventories).not.toHaveBeenCalled();
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(toast.success).not.toHaveBeenCalled();
});

test("normalizes backend validation arrays into a readable message", async () => {
  mockDelete.mockRejectedValue({
    isAxiosError: true,
    response: { data: { message: [" Almacén vinculado a pedidos ", null, "Revisa sus referencias"] } },
  });
  render(<GestionAlmacenes />);
  await confirmDeletion();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Almacén vinculado a pedidos. Revisa sus referencias"));
  expect(toast.success).not.toHaveBeenCalled();
});

test("uses a readable fallback when the request fails without a backend message", async () => {
  mockDelete.mockRejectedValue(new Error("Network Error"));
  render(<GestionAlmacenes />);
  await confirmDeletion();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo eliminar el almacén. Inténtalo nuevamente."));
  expect(toast.success).not.toHaveBeenCalled();
  expect(refreshInventories).not.toHaveBeenCalled();
});

test("reports a failed context refresh separately after a successful deletion", async () => {
  mockGet.mockResolvedValueOnce({ data: inventories })
    .mockResolvedValue({ data: [inventories[1]] });
  refreshInventories.mockRejectedValue(new Error("Refresh unavailable"));
  render(<GestionAlmacenes />);
  await confirmDeletion();
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    "El almacén se eliminó, pero no se pudo actualizar la información. Actualiza la página.",
  ));
  expect(toast.success).toHaveBeenCalledWith("Almacén eliminado correctamente");
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Eliminar almacén Almacén vacío" })).not.toBeInTheDocument();
});

test("keeps the remaining warehouses visible when reloading the list fails after deletion", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockGet.mockResolvedValueOnce({ data: inventories })
    .mockRejectedValue(new Error("List unavailable"));
  try {
    render(<GestionAlmacenes />);
    await confirmDeletion();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error al cargar los almacenes"));
    expect(await screen.findByRole("button", { name: "Eliminar almacén Almacén en uso" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Eliminar almacén Almacén vacío" })).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Almacén eliminado correctamente");
    expect(refreshInventories).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  } finally {
    consoleError.mockRestore();
  }
});
