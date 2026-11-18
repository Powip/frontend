/**
 * Tests: datos del courier en la ficha del almacén (FEAT-24 H8-D1).
 *
 * 1. Un almacén COURIER suma courier, sincronización y almacenaje; se guarda solo lo que cambió.
 * 2. «Por API» solo con Aliclik.
 * 3. Con Aliclik, el mapa de almacenes de Aliclik; el 409 ALICLIK_WAREHOUSE_TAKEN se explica con nombres.
 * 4. Sin rol de costos no se ve el almacenaje; quien no edita solo mira y no pide el mapa.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getWarehouseDetails, listLocations, updateWarehouseDetails, type WarehouseDetails } from "@/services/warehouseOpsService";
import { getAliclikMap, saveAliclikMap } from "@/services/sharedCourierService";
import WarehouseDetailsDialog from "../structure/WarehouseDetailsDialog";
import { apiError } from "./fixtures";

const mockAuth = { user: { id: "u-1", role: "ADMINISTRADOR", permissions: [] as string[] }, company: { id: "c-1" } };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/hooks/useCompanyWarehouses", () => ({ useCompanyWarehouses: () => ({ warehouses: [], nameOf: (id: string) => (id === "w-9" ? "Olva Lima" : "Almacén") }) }));
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
jest.mock("@/services/sharedCourierService", () => ({ getAliclikMap: jest.fn(), saveAliclikMap: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn().mockResolvedValue([]), listProductVariants: jest.fn() }));

const zero = { physical: 0, reserved: 0, inTransit: 0, pendingReturn: 0, incomingTransfer: 0 };
const details = (overrides: Partial<WarehouseDetails> = {}): WarehouseDetails => ({
  id: "w-3",
  storeId: "s-1",
  name: "Courier Lima",
  type: "COURIER",
  isMain: false,
  active: true,
  code: null,
  ubigeo: null,
  address: null,
  contactName: null,
  contactPhone: null,
  sunatEstablishmentCode: null,
  courierProvider: null,
  syncMode: null,
  storageCostMonth: null,
  counters: zero,
  ...overrides,
});

const MAP = {
  inventoryId: "w-3",
  items: [
    { aliclikWarehouseId: 7, warehouseName: "Lima Norte", inventoryId: "w-3", mappedHere: true, skus: 40, linkedSkus: 38, units: 120, lastSyncedAt: "2026-11-18T13:05:00Z" },
    { aliclikWarehouseId: 8, warehouseName: "Lima Sur", inventoryId: "w-9", mappedHere: false, skus: 10, linkedSkus: 10, units: 30, lastSyncedAt: "2026-11-18T13:05:00Z" },
  ],
};

function setup(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WarehouseDetailsDialog companyId="c-1" warehouse={{ id: "w-3", name: "Courier Lima", is_main: false, status: true }} canEdit={canEdit} onClose={jest.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user.role = "ADMINISTRADOR";
  jest.mocked(listLocations).mockResolvedValue([]);
  jest.mocked(getAliclikMap).mockResolvedValue(MAP);
});

describe("Ficha del almacén courier", () => {
  it("guarda courier, sincronización y almacenaje (solo lo que cambió); «Por API» solo con Aliclik", async () => {
    const user = userEvent.setup();
    jest.mocked(getWarehouseDetails).mockResolvedValue(details());
    jest.mocked(updateWarehouseDetails).mockResolvedValue(details({ courierProvider: "olva", syncMode: "portal", storageCostMonth: 120.5 }));
    setup();
    const section = await screen.findByRole("region", { name: "Datos del courier" });
    const sync = within(section).getByLabelText("Sincronización del stock");
    expect(within(sync).getByRole("option", { name: "Por API" })).toBeDisabled();
    await user.selectOptions(within(section).getByLabelText("Courier"), "olva");
    await user.selectOptions(sync, "portal");
    expect(within(section).getByText("El personal del courier cuenta en POWIP, en el modo almacén.")).toBeInTheDocument();
    await user.type(within(section).getByLabelText("Almacenaje por mes (S/)"), "120.555");
    expect(within(section).getByText(/hasta 2 decimales/)).toBeInTheDocument();
    await user.type(within(section).getByLabelText("Almacenaje por mes (S/)"), "{Backspace}");
    await user.click(within(section).getByRole("button", { name: "Guardar datos del courier" }));
    await waitFor(() => expect(updateWarehouseDetails).toHaveBeenCalledWith("w-3", { courierProvider: "olva", syncMode: "portal", storageCostMonth: 120.55 }));
    // Olva no tiene mapa de Aliclik.
    expect(getAliclikMap).not.toHaveBeenCalled();
  });

  it("con Aliclik edita su mapa y explica el 409 ALICLIK_WAREHOUSE_TAKEN con los nombres", async () => {
    const user = userEvent.setup();
    jest.mocked(getWarehouseDetails).mockResolvedValue(details({ courierProvider: "aliclik", syncMode: "api", storageCostMonth: 350 }));
    jest.mocked(saveAliclikMap).mockRejectedValue(
      apiError(409, "Ese almacén de Aliclik ya está asignado a otro almacén.", { code: "ALICLIK_WAREHOUSE_TAKEN", aliclikWarehouseId: 8, inventoryId: "w-9" }),
    );
    setup();
    const map = await screen.findByLabelText("Almacenes de Aliclik");
    expect(await within(map).findByLabelText(/Lima Norte/)).toBeChecked();
    expect(within(map).getByText("Asignado a «Olva Lima»")).toBeInTheDocument();
    const save = within(map).getByRole("button", { name: "Guardar almacenes de Aliclik" });
    expect(save).toBeDisabled();
    await user.click(within(map).getByLabelText(/Lima Sur/));
    await user.click(save);
    await waitFor(() => expect(saveAliclikMap).toHaveBeenCalledWith("w-3", [7, 8]));
    expect(await within(map).findByRole("alert")).toHaveTextContent("«Lima Sur» de Aliclik ya está asignado a «Olva Lima». Quítalo de ese almacén primero y vuelve a guardar.");
    expect(screen.getByLabelText("Almacenaje por mes (S/)")).toHaveValue("350");
  });

  it("quien no edita solo mira: sin almacenaje (sin rol de costos), sin guardar y sin pedir el mapa", async () => {
    mockAuth.user.role = "ALMACEN";
    const { storageCostMonth: _cost, ...noCost } = details({ courierProvider: "aliclik", syncMode: "api" });
    void _cost;
    jest.mocked(getWarehouseDetails).mockResolvedValue(noCost as WarehouseDetails);
    setup(false);
    const section = await screen.findByRole("region", { name: "Datos del courier" });
    await waitFor(() => expect(within(section).getByLabelText("Courier")).toHaveValue("aliclik"));
    expect(within(section).getByLabelText("Courier")).toBeDisabled();
    expect(within(section).queryByLabelText("Almacenaje por mes (S/)")).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Guardar datos del courier" })).not.toBeInTheDocument();
    expect(getAliclikMap).not.toHaveBeenCalled();
  });

  it("un almacén propio no muestra los datos del courier", async () => {
    jest.mocked(getWarehouseDetails).mockResolvedValue(details({ type: "PROPIO" }));
    setup();
    await screen.findByLabelText("Dirección");
    expect(screen.queryByRole("region", { name: "Datos del courier" })).not.toBeInTheDocument();
  });
});
