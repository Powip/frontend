/**
 * Tests: ficha del almacén (FEAT-24 H5).
 *
 * 1. Guarda solo lo que cambió (vacío = null) y valida ubigeo y código SUNAT antes de enviar.
 * 2. Ubicaciones: el código va en mayúsculas y se valida; no se elimina una con productos.
 * 3. Desactivar: bloqueado con saldos o si es el principal; el 409 del servidor se muestra.
 * 4. Sin rol de edición solo se mira.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createLocation, getWarehouseDetails, listLocations, setWarehouseActive, updateWarehouseDetails, type WarehouseDetails } from "@/services/warehouseOpsService";
import WarehouseDetailsDialog from "../structure/WarehouseDetailsDialog";
import { apiError } from "./fixtures";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/warehouseOpsService", () => ({
  getWarehouseDetails: jest.fn(),
  updateWarehouseDetails: jest.fn(),
  listLocations: jest.fn(),
  createLocation: jest.fn(),
  updateLocation: jest.fn(),
  deleteLocation: jest.fn(),
  assignLocation: jest.fn(),
  setWarehouseActive: jest.fn(),
}));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn().mockResolvedValue([]), listProductVariants: jest.fn() }));

const zero = { physical: 0, reserved: 0, inTransit: 0, pendingReturn: 0, incomingTransfer: 0 };
const details = (overrides: Partial<WarehouseDetails> = {}): WarehouseDetails => ({
  id: "w-2",
  storeId: "s-1",
  name: "Tienda Sur",
  type: "PROPIO",
  isMain: false,
  active: true,
  code: "SUR",
  ubigeo: null,
  address: "Av. Los Olivos 123",
  contactName: null,
  contactPhone: null,
  sunatEstablishmentCode: null,
  counters: zero,
  ...overrides,
});

function setup(canEdit = true, warehouse = { id: "w-2", name: "Tienda Sur", is_main: false, status: true }) {
  const onActiveChanged = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WarehouseDetailsDialog companyId="c-1" warehouse={warehouse} canEdit={canEdit} onClose={jest.fn()} onActiveChanged={onActiveChanged} />
    </QueryClientProvider>,
  );
  return { onActiveChanged };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getWarehouseDetails).mockResolvedValue(details());
  jest.mocked(listLocations).mockResolvedValue([
    { id: "loc-1", inventoryId: "w-2", code: "A-01", description: "Pasillo A", active: true, assignedItems: 3, createdAt: "", updatedAt: "" },
  ]);
});

describe("Ficha del almacén", () => {
  it("valida y guarda solo lo que cambió (vacío borra)", async () => {
    const user = userEvent.setup();
    jest.mocked(updateWarehouseDetails).mockResolvedValue(details({ ubigeo: "150101", address: null }));
    setup();
    const address = await screen.findByLabelText("Dirección");
    await waitFor(() => expect(address).toHaveValue("Av. Los Olivos 123"));
    await user.type(screen.getByLabelText("Ubigeo"), "1501");
    expect(screen.getByText("El ubigeo son 6 dígitos (por ejemplo, 150101).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar datos" })).toBeDisabled();
    await user.type(screen.getByLabelText("Ubigeo"), "01");
    await user.clear(address);
    await user.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(updateWarehouseDetails).toHaveBeenCalledWith("w-2", { ubigeo: "150101", address: null }));
  });

  it("ubicaciones: el código va en mayúsculas, se valida y una con productos no se elimina", async () => {
    const user = userEvent.setup();
    jest.mocked(createLocation).mockResolvedValue({ id: "loc-2", inventoryId: "w-2", code: "B-02", description: null, active: true, assignedItems: 0, createdAt: "", updatedAt: "" });
    setup();
    const row = await screen.findByTestId("location-A-01");
    expect(within(row).getByRole("button", { name: "Eliminar ubicación A-01" })).toBeDisabled();
    await user.type(screen.getByLabelText("Código"), "B 02");
    await user.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    expect(screen.getByText("Usa solo letras, números y . _ / - (sin espacios).")).toBeInTheDocument();
    expect(createLocation).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Código"));
    await user.type(screen.getByLabelText("Código"), "b-02");
    await user.click(screen.getByRole("button", { name: "Agregar ubicación" }));
    await waitFor(() => expect(createLocation).toHaveBeenCalledWith({ inventoryId: "w-2", code: "B-02" }));
  });

  it("con saldos no deja desactivar y lo explica", async () => {
    jest.mocked(getWarehouseDetails).mockResolvedValue(details({ counters: { ...zero, physical: 4, incomingTransfer: 1 } }));
    setup();
    expect(await screen.findByText("No se puede desactivar mientras tenga 4 stock físico, 1 traslados en camino.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Estado del almacén" })).getByRole("button", { name: "Desactivar" })).toBeDisabled();
  });

  it("el principal no se desactiva", async () => {
    setup(true, { id: "w-1", name: "Central", is_main: true, status: true });
    expect(await screen.findByText("El almacén principal no se desactiva: define otro como principal primero.")).toBeInTheDocument();
  });

  it("desactivar confirma, llama al servidor y muestra el 409 si lo rechaza", async () => {
    const user = userEvent.setup();
    jest.mocked(setWarehouseActive).mockRejectedValueOnce(apiError(409, "El almacén tiene reservas pendientes.")).mockResolvedValueOnce(undefined);
    const { onActiveChanged } = setup();
    const section = await screen.findByRole("region", { name: "Estado del almacén" });
    await user.click(within(section).getByRole("button", { name: "Desactivar" }));
    await user.click(within(section).getByRole("button", { name: "Sí, desactivar" }));
    expect(await within(section).findByText("El almacén tiene reservas pendientes.")).toBeInTheDocument();
    expect(setWarehouseActive).toHaveBeenCalledWith("w-2", false);
    await user.click(within(section).getByRole("button", { name: "Sí, desactivar" }));
    await waitFor(() => expect(onActiveChanged).toHaveBeenCalled());
  });

  it("sin rol de edición solo se mira", async () => {
    setup(false);
    expect(await screen.findByLabelText("Dirección")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar datos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar ubicación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Estado del almacén" })).not.toBeInTheDocument();
  });
});
