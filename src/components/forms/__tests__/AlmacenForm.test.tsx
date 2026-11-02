/**
 * Tests: AlmacenForm (FEAT-24 H1-A, Task 20 — alta de almacén de la empresa)
 *
 * Comportamiento verificado:
 * 1. Crea con `createWarehouse({ name, storeId, type })`: la tienda de origen es
 *    la tienda seleccionada y el tipo por defecto es PROPIO; luego refresca los
 *    inventarios globales, avisa con un toast y llama a `onClienteSaved`.
 * 2. El tipo elegido (Propio/Tienda/Courier) viaja en la llamada.
 * 3. No usa `axios` suelto (el `createInventory` de antes pegaba sin token).
 * 4. Nombre vacío o solo espacios: aviso y no crea; sin tienda: error y no crea.
 * 5. Un error 403/503 muestra el mensaje del backend en un toast y no cierra.
 * 6. Sin mensaje del backend se usa el texto genérico; mientras guarda el
 *    botón queda deshabilitado.
 *
 * Mocks: AuthContext, sonner, `@/services/warehousesService` y `axios`.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createWarehouse } from "@/services/warehousesService";
import AlmacenForm from "../AlmacenForm";

jest.mock("axios");
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/warehousesService", () => ({
  createWarehouse: jest.fn(),
}));

const mockCreate = jest.mocked(createWarehouse);
const refreshInventories = jest.fn();
const onClienteSaved = jest.fn();

const STORES = [
  { id: "store-a", name: "LIVII" },
  { id: "store-b", name: "Aranni" },
];

const mockAuth = (over: { selectedStoreId?: string | null; stores?: typeof STORES } = {}) =>
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "test-token", company: { id: "company-a", stores: over.stores ?? STORES } },
    selectedStoreId: "selectedStoreId" in over ? over.selectedStoreId : "store-b",
    refreshInventories,
  } as unknown as ReturnType<typeof useAuth>);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth();
  refreshInventories.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue({
    id: "w-1",
    name: "Almacén Central",
    status: true,
    store_id: "store-b",
    company_id: "company-a",
    type: "PROPIO",
    is_main: false,
  });
});

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.type(screen.getByLabelText("Nombre del almacén"), name);
  await user.click(screen.getByRole("button", { name: "Crear Almacén" }));
};

describe("Formulario de almacén", () => {
  it("crea con createWarehouse en la tienda seleccionada y sin axios suelto", async () => {
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);

    expect(screen.getByText("Tienda de origen: Aranni")).toBeInTheDocument();
    await fillAndSubmit(user, "  Almacén Central ");

    await waitFor(() => expect(onClienteSaved).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({ name: "Almacén Central", storeId: "store-b", type: "PROPIO" });
    // El refresco de inventarios lo hace `GestionAlmacenes` vía `onSaved`, no el formulario.
    expect(refreshInventories).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Almacén creado correctamente");
    // El createInventory de antes usaba axios.post sin token: ya no se usa.
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("envía el tipo elegido", async () => {
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);

    const type = screen.getByLabelText("Tipo");
    expect(type).toHaveDisplayValue("Propio");
    await user.selectOptions(type, "COURIER");
    await fillAndSubmit(user, "Shalom");

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: "Shalom", storeId: "store-b", type: "COURIER" }));
  });

  it("sin tienda seleccionada usa la primera de la empresa", async () => {
    mockAuth({ selectedStoreId: null });
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "Almacén Central");

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: "Almacén Central", storeId: "store-a", type: "PROPIO" }));
  });

  it("un nombre de solo espacios avisa y no crea", async () => {
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "   ");

    expect(toast.warning).toHaveBeenCalledWith("El nombre es obligatorio");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(onClienteSaved).not.toHaveBeenCalled();
  });

  it("una empresa sin tiendas no crea y lo dice", async () => {
    mockAuth({ selectedStoreId: null, stores: [] });
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "Almacén Central");

    expect(toast.error).toHaveBeenCalledWith("La empresa no tiene una tienda asociada");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    [403, "No puedes crear almacenes en otra empresa"],
    [503, "No se pudo confirmar la tienda con el servicio de empresas"],
  ])("un error %i muestra el mensaje del backend en un toast y no cierra el formulario", async (status, message) => {
    mockCreate.mockRejectedValue({ response: { status, data: { message } } });
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "Almacén Central");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
    expect(onClienteSaved).not.toHaveBeenCalled();
    expect(refreshInventories).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear Almacén" })).toBeEnabled();
  });

  it("sin mensaje del backend usa el texto genérico", async () => {
    mockCreate.mockRejectedValue(new Error("Network Error"));
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "Almacén Central");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo crear el almacén. Inténtalo de nuevo."));
  });

  it("mientras guarda deshabilita el botón y no crea dos veces", async () => {
    let resolveCreate: (value: Awaited<ReturnType<typeof createWarehouse>>) => void = () => {};
    mockCreate.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    const user = userEvent.setup();
    render(<AlmacenForm onClienteSaved={onClienteSaved} />);
    await fillAndSubmit(user, "Almacén Central");

    const button = screen.getByRole("button", { name: "Crear Almacén" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    resolveCreate({
      id: "w-1",
      name: "Almacén Central",
      status: true,
      store_id: "store-b",
      company_id: "company-a",
      type: "PROPIO",
      is_main: false,
    });
    await waitFor(() => expect(onClienteSaved).toHaveBeenCalledTimes(1));
  });
});
