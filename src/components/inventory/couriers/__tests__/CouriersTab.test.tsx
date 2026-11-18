/**
 * Tests: Inventario › Couriers (FEAT-24 H8).
 *
 * 1. Stock POWIP contra courier: dato viejo, SKU sin vincular y Aliclik caído (lo de POWIP sale igual).
 * 2. Conciliar por API o desde un conteo.
 * 3. Reclamar lo no explicado con una clave estable (el reintento reusa el operationId).
 * 4. Cerrar con nota (obligatoria si queda algo sin explicar) y anular (solo sin reclamos).
 * 5. Reclamos: totales por estado, detalle con historial, cambio de estado y PDF.
 * 6. Almacén solo mira: sin montos, sin conciliar y sin reclamos.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cancelReconciliation,
  changeCourierClaimStatus,
  claimReconciliation,
  closeReconciliation,
  createReconciliation,
  getCourierClaim,
  getCourierStock,
  getReconciliation,
  listCourierClaims,
  listCourierWarehouses,
  listReconciliations,
  type CourierClaim,
  type CourierReconciliation,
  type CourierStock,
  type CourierWarehouse,
} from "@/services/sharedCourierService";
import { listCounts } from "@/services/warehouseOpsService";
import CouriersTab from "../CouriersTab";

const mockAuth = { user: { id: "u-1", role: "ADMINISTRADOR", permissions: [] as string[] }, company: { id: "c-1" }, accessToken: "t" };
const pdfDownload = jest.fn().mockResolvedValue(undefined);

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/hooks/useCompanyWarehouses", () => ({ useCompanyWarehouses: () => ({ warehouses: [], nameOf: (id: string) => (id === "w-9" ? "Central" : "Almacén") }) }));
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload }));
jest.mock("@/hooks/useInventoryAlerts", () => ({ invalidateInventoryAlerts: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/warehouseOpsService", () => ({ listCounts: jest.fn() }));
jest.mock("@/services/sharedCourierService", () => ({
  listCourierWarehouses: jest.fn(),
  getCourierStock: jest.fn(),
  listReconciliations: jest.fn(),
  getReconciliation: jest.fn(),
  createReconciliation: jest.fn(),
  recalculateReconciliation: jest.fn(),
  setLineExplanations: jest.fn(),
  claimReconciliation: jest.fn(),
  closeReconciliation: jest.fn(),
  cancelReconciliation: jest.fn(),
  listCourierClaims: jest.fn(),
  getCourierClaim: jest.fn(),
  changeCourierClaimStatus: jest.fn(),
}));

const warehouse = (overrides: Partial<CourierWarehouse> = {}): CourierWarehouse => ({
  id: "w-3",
  name: "Aliclik Lima",
  active: true,
  courierProvider: "aliclik",
  syncMode: "api",
  storageCostMonth: 350,
  physical: 49,
  reserved: 2,
  incomingTransfer: 0,
  pendingReturn: 0,
  value: 1200,
  withoutCost: 0,
  openReconciliation: null,
  openClaims: { count: 0, units: 0, amount: 0 },
  ...overrides,
});

const OLVA = warehouse({ id: "w-4", name: "Olva Cusco", courierProvider: "olva", syncMode: "portal" });

const stock = (overrides: Partial<CourierStock> = {}): CourierStock => ({
  warehouse: { id: "w-3", name: "Aliclik Lima", active: true, courierProvider: "aliclik", syncMode: "api", storageCostMonth: 350 },
  basis: "disponible",
  courier: { source: "api", available: true, mapped: true, aliclikWarehouses: [{ aliclikWarehouseId: 7, warehouseName: "Lima Norte" }], lastSyncedAt: "2026-11-18T13:05:00Z", stale: true, unlinked: { skus: 2, units: 5 } },
  items: [
    { variantId: "v-1", trackingMode: null, physical: 31, reserved: 1, available: 30, inTransit: 0, pendingReturn: 0, incomingTransfer: 2, productName: "Polo", productId: "p-1", sku: "POL-M", companySku: null, attributes: { Talla: "M" }, courier: 28, difference: -2 },
    { variantId: "v-2", trackingMode: null, physical: 15, reserved: 0, available: 15, inTransit: 0, pendingReturn: 0, incomingTransfer: 0, productName: "Gorra", productId: "p-2", sku: "GOR-U", companySku: null, attributes: {}, courier: 15, difference: 0 },
  ],
  totals: { variants: 2, physical: 46, reserved: 1, available: 45, incomingTransfer: 2, pendingReturn: 0, value: 1200, withoutCost: 0 },
  lastCount: null,
  openReconciliation: null,
  ...overrides,
});

const reconciliation = (overrides: Partial<CourierReconciliation> = {}): CourierReconciliation => ({
  id: "rec-1",
  number: "CON-0001",
  inventoryId: "w-3",
  courierProvider: "aliclik",
  source: "api",
  basis: "disponible",
  countId: null,
  countNumber: null,
  cutoffAt: null,
  courierReportedAt: "2026-11-18T13:05:00Z",
  status: "abierta",
  notes: null,
  recalculatedAt: null,
  closedAt: null,
  closeNote: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-11-18T14:00:00Z",
  summary: { lines: 2, withDifference: 1, unexplainedLines: 1, shortageUnits: 2, shortageValue: 64.8, shortageWithoutCost: 0, surplusUnits: 0, claimedUnits: 0, balanced: false },
  claims: [],
  lines: [
    {
      id: "line-1",
      variantId: "v-1",
      sku: "POL-M",
      productName: "Polo · Talla: M",
      powipBase: 30,
      baseAt: null,
      powip: 30,
      powipReserved: 1,
      courier: 26,
      difference: -4,
      explanations: [{ id: "e-1", type: "merma_por_aprobar", source: "auto", quantity: -2, applied: -2, references: [{ id: "aj-1", number: "AJ-0003" }] }],
      explained: -2,
      unexplained: -2,
      claimedQuantity: 0,
      unitCost: 32.4,
      unexplainedValue: 64.8,
    },
    {
      id: "line-2",
      variantId: "v-2",
      sku: "GOR-U",
      productName: "Gorra",
      powipBase: 15,
      baseAt: null,
      powip: 15,
      powipReserved: 0,
      courier: 15,
      difference: 0,
      explanations: [],
      explained: 0,
      unexplained: 0,
      claimedQuantity: 0,
      unitCost: 10,
      unexplainedValue: 0,
    },
  ],
  ...overrides,
});

const claim = (overrides: Partial<CourierClaim> = {}): CourierClaim => ({
  id: "cl-1",
  number: "RCL-0002",
  inventoryId: "w-3",
  courierProvider: "aliclik",
  origin: "conciliacion",
  referenceId: "rec-1",
  referenceNumber: "CON-0001",
  status: "aceptado",
  totalUnits: 3,
  totalAmount: 97.2,
  linesWithoutCost: 0,
  collectedAmount: null,
  notes: null,
  userName: "Ana",
  statusChangedAt: "2026-11-18T15:00:00Z",
  createdAt: "2026-11-17T15:00:00Z",
  lines: [{ id: "l-1", variantId: "v-1", sku: "POL-M", productName: "Polo · Talla: M", quantity: 3, unitCost: 32.4, amount: 97.2 }],
  history: [{ id: "h-1", fromStatus: "abierto", toStatus: "aceptado", note: "Lo descuentan en la liquidación", userEmail: "ana@kunca.pe", userName: "Ana", createdAt: "2026-11-18T15:00:00Z" }],
  ...overrides,
});

const omit = <T extends object>(value: T, ...keys: string[]): T => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as T;

function setup(props: { initialInventoryId?: string; initialClaimId?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CouriersTab {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user.role = "ADMINISTRADOR";
  jest.mocked(listCourierWarehouses).mockResolvedValue([warehouse(), OLVA]);
  jest.mocked(getCourierStock).mockResolvedValue(stock());
  jest.mocked(listReconciliations).mockResolvedValue([]);
  jest.mocked(listCourierClaims).mockResolvedValue({ items: [], totals: {} });
});

describe("Inventario › Couriers: stock POWIP contra courier", () => {
  it("compara por variante, avisa el dato viejo y los SKU sin vincular", async () => {
    setup();
    const row = await screen.findByTestId("stock-POL-M");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Polo · Talla: MPOL-M", "30", "28", "-2", "2", "—"]);
    expect(screen.getByRole("columnheader", { name: "POWIP (disponible)" })).toBeInTheDocument();
    expect(screen.getByTestId("notice-stale")).toHaveTextContent("Dato viejo: Aliclik no se sincroniza hace más de 30 minutos");
    expect(screen.getByTestId("notice-unlinked")).toHaveTextContent("2 SKU de Aliclik sin vincular (5 und)");
    expect(screen.getByText("Con diferencias")).toBeInTheDocument();
    expect(getCourierStock).toHaveBeenCalledWith("w-3", expect.anything());
  });

  it("si Aliclik no responde, avisa y muestra igual lo de POWIP", async () => {
    jest.mocked(getCourierStock).mockResolvedValue(
      stock({
        courier: { source: "api", available: false, message: "No pudimos leer el stock de Aliclik. Inténtalo de nuevo." },
        items: stock().items.map((item) => ({ ...item, courier: null, difference: null })),
      }),
    );
    setup();
    expect(await screen.findByTestId("notice-api-down")).toHaveTextContent("No pudimos leer el stock de Aliclik. Inténtalo de nuevo. Lo de POWIP se muestra igual.");
    const row = screen.getByTestId("stock-POL-M");
    expect(within(row).getAllByRole("cell").slice(1, 4).map((cell) => cell.textContent)).toEqual(["30", "—", "—"]);
    expect(screen.getByText("Sin dato del courier")).toBeInTheDocument();
  });
});

describe("Inventario › Couriers: conciliar", () => {
  it("crea una conciliación con la API de Aliclik y la muestra", async () => {
    const user = userEvent.setup();
    jest.mocked(createReconciliation).mockResolvedValue(reconciliation());
    jest.mocked(getReconciliation).mockResolvedValue(reconciliation());
    setup();
    await user.click(await screen.findByRole("button", { name: /Nueva conciliación/ }));
    expect(screen.getByRole("radio", { name: /Stock por API de Aliclik/ })).toBeChecked();
    // Después de crearla, el servidor ya la lista como abierta.
    jest.mocked(listCourierWarehouses).mockResolvedValue([warehouse({ openReconciliation: { id: "rec-1", number: "CON-0001", createdAt: "2026-11-18T14:00:00Z", unexplainedLines: 1 } }), OLVA]);
    await user.click(screen.getByRole("button", { name: "Crear conciliación" }));
    await waitFor(() => expect(createReconciliation).toHaveBeenCalledWith({ inventoryId: "w-3", source: "api", basis: "disponible" }));
    expect(await screen.findByRole("region", { name: "Conciliación CON-0001" })).toBeInTheDocument();
  });

  it("en un courier sin API concilia desde un conteo por validar o aplicado", async () => {
    const user = userEvent.setup();
    jest.mocked(getCourierStock).mockResolvedValue(stock({ basis: "fisico", courier: { source: "conteo", available: true, countId: "ct-2", countNumber: "CT-0002", countStatus: "por_validar", countedAt: null }, lastCount: { id: "ct-2", number: "CT-0002", status: "por_validar", closedAt: null, appliedAt: null } }));
    jest.mocked(listCounts).mockResolvedValue([
      { id: "ct-1", number: "CT-0001", status: "en_curso", createdAt: "2026-11-10T10:00:00Z" },
      { id: "ct-2", number: "CT-0002", status: "por_validar", closedAt: "2026-11-17T10:00:00Z", createdAt: "2026-11-16T10:00:00Z" },
    ] as never);
    jest.mocked(createReconciliation).mockResolvedValue(reconciliation({ inventoryId: "w-4", source: "conteo", basis: "fisico", countId: "ct-2", countNumber: "CT-0002" }));
    jest.mocked(getReconciliation).mockResolvedValue(reconciliation({ inventoryId: "w-4", source: "conteo", basis: "fisico", countId: "ct-2", countNumber: "CT-0002" }));
    setup({ initialInventoryId: "w-4" });
    await user.click(await screen.findByRole("button", { name: /Nueva conciliación/ }));
    expect(screen.getByRole("radio", { name: /Stock por API de Aliclik/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Un conteo del almacén/ })).toBeChecked();
    const select = await screen.findByLabelText("Conteo");
    await waitFor(() => expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Elige el conteo", "CT-0002 · Por validar · 17/11/2026"]));
    expect(select).toHaveValue("ct-2");
    await user.click(screen.getByRole("button", { name: "Crear conciliación" }));
    await waitFor(() => expect(createReconciliation).toHaveBeenCalledWith({ inventoryId: "w-4", source: "conteo", countId: "ct-2", basis: "fisico" }));
    expect(getCourierStock).toHaveBeenCalledWith("w-4", expect.anything());
  });

  it("muestra las explicaciones, enlaza a la pantalla que la cuadra y reclama con una clave estable", async () => {
    const user = userEvent.setup();
    jest.mocked(listCourierWarehouses).mockResolvedValue([warehouse({ openReconciliation: { id: "rec-1", number: "CON-0001", createdAt: "2026-11-18T14:00:00Z", unexplainedLines: 1 } })]);
    jest.mocked(getReconciliation).mockResolvedValue(reconciliation());
    const offline = Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK" });
    const claimed = reconciliation({ claims: [{ id: "cl-9", number: "RCL-0009", status: "abierto", totalUnits: 2, totalAmount: 64.8 }] });
    jest.mocked(claimReconciliation).mockRejectedValueOnce(offline).mockResolvedValueOnce({ claim: claim({ id: "cl-9", number: "RCL-0009", status: "abierto" }), reconciliation: claimed, duplicate: false });
    setup();
    const line = await screen.findByTestId("line-POL-M");
    expect(within(line).getByText("-2 merma por aprobar (AJ-0003)")).toBeInTheDocument();
    expect(within(line).getByText("-2 sin explicar")).toBeInTheDocument();
    expect(within(line).getByRole("link", { name: "Aprobar merma" })).toHaveAttribute("href", "/inventario/ajustes");
    expect(within(screen.getByTestId("line-GOR-U")).getByText("Cuadra")).toBeInTheDocument();

    await user.click(within(line).getByRole("button", { name: "Reclamar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Unidades a reclamar")).toHaveValue("2");
    await user.click(within(dialog).getByRole("button", { name: "Crear reclamo" }));
    expect(await within(dialog).findByText("No hubo respuesta del servidor. Reintenta: la acción no se duplica.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Crear reclamo" }));
    await waitFor(() => expect(claimReconciliation).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(claimReconciliation).mock.calls;
    expect(first[0]).toBe("rec-1");
    expect(first[1]).toEqual({ lines: [{ lineId: "line-1", quantity: 2 }], operationId: expect.any(String) });
    expect(second[1].operationId).toBe(first[1].operationId);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("RCL-0009")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anular" })).toBeDisabled();

    // Otra acción (reclamar todo) es otra clave.
    jest.mocked(claimReconciliation).mockResolvedValueOnce({ claim: claim({ id: "cl-10", number: "RCL-0010" }), reconciliation: claimed, duplicate: true });
    await user.click(screen.getByRole("button", { name: "Reclamar todo lo sin explicar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Crear reclamo" }));
    await waitFor(() => expect(claimReconciliation).toHaveBeenCalledTimes(3));
    const third = jest.mocked(claimReconciliation).mock.calls[2][1];
    expect(third.lines).toBeUndefined();
    expect(third.operationId).not.toBe(first[1].operationId);
  });

  it("cierra con nota obligatoria si queda algo sin explicar", async () => {
    const user = userEvent.setup();
    jest.mocked(listCourierWarehouses).mockResolvedValue([warehouse({ openReconciliation: { id: "rec-1", number: "CON-0001", createdAt: "2026-11-18T14:00:00Z", unexplainedLines: 1 } })]);
    jest.mocked(getReconciliation).mockResolvedValue(reconciliation());
    jest.mocked(closeReconciliation).mockResolvedValue(reconciliation({ status: "cerrada", closeNote: "Se reclama en la liquidación" }));
    setup();
    await user.click(await screen.findByRole("button", { name: "Cerrar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Quedan 1 SKU sin explicar/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Cerrar conciliación" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Nota de cierre/), "Se reclama en la liquidación");
    await user.click(confirm);
    await waitFor(() => expect(closeReconciliation).toHaveBeenCalledWith("rec-1", { note: "Se reclama en la liquidación" }));
  });

  it("anula una conciliación sin reclamos", async () => {
    const user = userEvent.setup();
    jest.mocked(listCourierWarehouses).mockResolvedValue([warehouse({ openReconciliation: { id: "rec-1", number: "CON-0001", createdAt: "2026-11-18T14:00:00Z", unexplainedLines: 1 } })]);
    jest.mocked(getReconciliation).mockResolvedValue(reconciliation());
    jest.mocked(cancelReconciliation).mockResolvedValue(reconciliation({ status: "anulada" }));
    setup();
    await user.click(await screen.findByRole("button", { name: "Anular" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Motivo/), "Conteo mal cargado");
    await user.click(within(dialog).getByRole("button", { name: "Anular conciliación" }));
    await waitFor(() => expect(cancelReconciliation).toHaveBeenCalledWith("rec-1", { reason: "Conteo mal cargado" }));
  });
});

describe("Inventario › Couriers: reclamos", () => {
  it("totales por estado, detalle con historial, cobrar y PDF", async () => {
    const user = userEvent.setup();
    jest.mocked(listCourierClaims).mockResolvedValue({
      items: [claim()],
      totals: { abierto: { count: 1, units: 2, amount: 64.8, collectedAmount: 0 }, aceptado: { count: 1, units: 3, amount: 97.2, collectedAmount: 0 }, cobrado: { count: 0, units: 0, amount: 0, collectedAmount: 0 } },
    });
    jest.mocked(getCourierClaim).mockResolvedValue(claim());
    jest.mocked(changeCourierClaimStatus).mockResolvedValue(claim({ status: "cobrado", collectedAmount: 97.2 }));
    setup();
    const row = await screen.findByTestId("claim-RCL-0002");
    expect(screen.getByTestId("claim-total-aceptado")).toHaveTextContent("1 · 3 und");
    expect(screen.getByTestId("claim-total-rechazado")).toHaveTextContent("0 · 0 und");
    expect(row).toHaveTextContent("Conciliación CON-0001");
    await user.click(within(row).getByRole("button", { name: "Ver" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Lo descuentan en la liquidación/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "El courier lo aceptó" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Reclamo a courier", number: "RCL-0002", signatures: ["Por la empresa", "Por el courier"] })));

    await user.click(within(dialog).getByRole("button", { name: "Marcar cobrado" }));
    expect(within(dialog).getByLabelText("Monto cobrado (S/)")).toHaveValue("97.20");
    await user.type(within(dialog).getByLabelText("Nota (opcional)"), "Liquidación 45");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar: Cobrado" }));
    await waitFor(() => expect(changeCourierClaimStatus).toHaveBeenCalledWith("cl-1", { status: "cobrado", note: "Liquidación 45", collectedAmount: 97.2 }));
    expect(await within(dialog).findByText("Cobrado:")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Marcar cobrado" })).not.toBeInTheDocument();
  });

  it("desde una alerta abre el almacén y el detalle del reclamo", async () => {
    jest.mocked(getCourierClaim).mockResolvedValue(claim({ status: "abierto", history: [] }));
    setup({ initialInventoryId: "w-4", initialClaimId: "cl-1" });
    await waitFor(() => expect(getCourierStock).toHaveBeenCalledWith("w-4", expect.anything()));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("button", { name: "El courier lo aceptó" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "El courier lo rechazó" })).toBeInTheDocument();
    expect(getCourierClaim).toHaveBeenCalledWith("cl-1", expect.anything());
  });
});

describe("Inventario › Couriers: rol Almacén", () => {
  it("solo mira: sin montos, sin conciliar, sin reclamar y sin la lista de reclamos", async () => {
    mockAuth.user.role = "ALMACEN";
    // Sin rol de costos la fachada omite los montos (no los manda en 0).
    const { openClaims: _claims, ...base } = omit(warehouse({ openReconciliation: { id: "rec-1", number: "CON-0001", createdAt: "2026-11-18T14:00:00Z", unexplainedLines: 1 } }), "storageCostMonth", "value");
    void _claims;
    jest.mocked(listCourierWarehouses).mockResolvedValue([base]);
    const full = reconciliation();
    jest.mocked(getReconciliation).mockResolvedValue({ ...full, summary: omit(full.summary, "shortageValue"), lines: (full.lines ?? []).map((line) => omit(line, "unexplainedValue", "unitCost")) });
    setup();
    expect(await screen.findByText("Almacenaje")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Costo oculto").length).toBeGreaterThan(0);
    const line = await screen.findByTestId("line-POL-M");
    expect(within(line).queryByRole("button", { name: "Reclamar" })).not.toBeInTheDocument();
    expect(within(line).queryByRole("link")).not.toBeInTheDocument();
    expect(within(line).getByLabelText("Costo oculto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nueva conciliación/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Reclamos a couriers" })).not.toBeInTheDocument();
    expect(screen.queryByText("Reclamos sin cobrar")).not.toBeInTheDocument();
    expect(listCourierClaims).not.toHaveBeenCalled();
  });
});
