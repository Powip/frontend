/**
 * Tests: portal del courier en el modo almacén (FEAT-24 H8-D5).
 *
 * 1. Inicio: Stock, Recibir (traslados), Contar y Conciliación; nada de Consultar ni Picking.
 * 2. Recibir: solo traslados.
 * 3. Sin almacén asignado no ve nada (fail-closed); otros roles no pasan por ese control.
 * 4. Stock de su almacén y la conciliación, sin montos ni reclamos.
 */

import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CourierScopeGate, { COURIER_WITHOUT_WAREHOUSE } from "@/components/almacen/CourierScopeGate";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { getCourierStock, getReconciliation, listCourierWarehouses, listReconciliations, type CourierReconciliation } from "@/services/sharedCourierService";
import CourierPortalScreen from "../_components/CourierPortalScreen";
import ReceiveMenu from "../_components/ReceiveMenu";
import WarehouseHome from "../_components/WarehouseHome";

const mockAuth = { user: { id: "u-1", role: "COURIER", permissions: ["UPDATE_DELIVERY_STATUS", "MANAGE_INVENTORY"] }, company: { id: "c-1" }, accessToken: "t" };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: mockAuth, hasPermission: (permission: string) => mockAuth.user.permissions.includes(permission) }),
}));
jest.mock("@/components/almacen/WarehouseQueueContext", () => ({
  useWarehouseQueue: () => ({ outbox: [], review: [], persistent: true, otherSessions: 0 }),
}));
jest.mock("@/hooks/useMyWarehouses", () => ({ useMyWarehouses: jest.fn() }));
jest.mock("@/hooks/useInventoryAlerts", () => ({ invalidateInventoryAlerts: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/sharedCourierService", () => ({
  listCourierWarehouses: jest.fn(),
  getCourierStock: jest.fn(),
  listReconciliations: jest.fn(),
  getReconciliation: jest.fn(),
  recalculateReconciliation: jest.fn(),
  setLineExplanations: jest.fn(),
  claimReconciliation: jest.fn(),
  closeReconciliation: jest.fn(),
  cancelReconciliation: jest.fn(),
}));

const OLVA = {
  id: "w-4",
  name: "Olva Cusco",
  active: true,
  courierProvider: "olva" as const,
  syncMode: "portal" as const,
  physical: 20,
  reserved: 0,
  incomingTransfer: 3,
  pendingReturn: 0,
  withoutCost: 0,
  openReconciliation: null,
};

// La fachada, sin rol de costos, no manda montos ni el detalle de los reclamos.
const RECONCILIATION: CourierReconciliation = {
  id: "rec-1",
  number: "CON-0004",
  inventoryId: "w-4",
  courierProvider: "olva",
  source: "conteo",
  basis: "fisico",
  countId: "ct-2",
  countNumber: "CT-0002",
  cutoffAt: null,
  courierReportedAt: null,
  status: "abierta",
  notes: null,
  recalculatedAt: null,
  closedAt: null,
  closeNote: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-11-18T14:00:00Z",
  summary: { lines: 1, withDifference: 1, unexplainedLines: 1, shortageUnits: 3, shortageWithoutCost: 0, surplusUnits: 0, claimedUnits: 1, balanced: false },
  lines: [
    {
      id: "line-1",
      variantId: "v-1",
      sku: "POL-M",
      productName: "Polo · Talla: M",
      powipBase: 20,
      baseAt: null,
      powip: 20,
      powipReserved: 0,
      courier: 15,
      difference: -5,
      explanations: [{ id: "e-1", type: "traslado_en_camino", source: "auto", quantity: 2, applied: 2, references: [{ id: "t-1", number: "TRA-0003" }] }],
      explained: 2,
      unexplained: -3,
      claimedQuantity: 1,
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user.role = "COURIER";
  jest.mocked(listCourierWarehouses).mockResolvedValue([OLVA]);
});

describe("Portal del courier: menú", () => {
  it("el inicio ofrece Stock, Recibir, Contar y Conciliación; nada de Consultar ni Picking", () => {
    render(<WarehouseHome />);
    expect(screen.getByRole("heading", { name: "Portal del courier" })).toBeInTheDocument();
    expect(screen.getByTestId("tile-Stock")).toHaveAttribute("href", "/almacen/stock");
    expect(screen.getByTestId("tile-Recibir")).toHaveAttribute("href", "/almacen/recibir/traslados");
    expect(screen.getByTestId("tile-Contar")).toHaveAttribute("href", "/almacen/contar");
    expect(screen.getByTestId("tile-Conciliación")).toHaveAttribute("href", "/almacen/conciliacion");
    expect(screen.queryByTestId("tile-Consultar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tile-Picking")).not.toBeInTheDocument();
  });

  it("Recibir: solo traslados, sin el aviso de rol", () => {
    render(<ReceiveMenu />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/almacen/recibir/traslados"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Portal del courier: su almacén", () => {
  const scope = (overrides: Partial<ReturnType<typeof useMyWarehouses>>) =>
    jest.mocked(useMyWarehouses).mockReturnValue({ known: true, all: false, visibleIds: new Set(["w-4"]), operableIds: new Set(["w-4"]), isLoading: false, ...overrides } as ReturnType<typeof useMyWarehouses>);

  it("sin almacén asignado no ve nada (con H6, sin asignaciones sería ver todos)", () => {
    scope({ all: true, visibleIds: new Set() });
    render(
      <CourierScopeGate>
        <p>Pantalla</p>
      </CourierScopeGate>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(COURIER_WITHOUT_WAREHOUSE);
    expect(screen.queryByText("Pantalla")).not.toBeInTheDocument();
  });

  it("con su almacén entra; si /me/warehouses no responde no se bloquea (el servidor valida)", () => {
    scope({});
    const { unmount } = render(
      <CourierScopeGate>
        <p>Pantalla</p>
      </CourierScopeGate>,
    );
    expect(screen.getByText("Pantalla")).toBeInTheDocument();
    unmount();
    scope({ known: false, all: true, visibleIds: new Set() });
    render(
      <CourierScopeGate>
        <p>Pantalla</p>
      </CourierScopeGate>,
    );
    expect(screen.getByText("Pantalla")).toBeInTheDocument();
  });

  it("otro rol no pasa por el control del courier", () => {
    mockAuth.user.role = "ALMACEN";
    render(
      <CourierScopeGate>
        <p>Pantalla</p>
      </CourierScopeGate>,
    );
    expect(screen.getByText("Pantalla")).toBeInTheDocument();
    expect(useMyWarehouses).not.toHaveBeenCalled();
  });

  it("stock: POWIP contra lo que reportó, sin columnas de gestión", async () => {
    jest.mocked(getCourierStock).mockResolvedValue({
      warehouse: { id: "w-4", name: "Olva Cusco", active: true, courierProvider: "olva", syncMode: "portal" },
      basis: "fisico",
      courier: { source: "conteo", available: true, countId: "ct-2", countNumber: "CT-0002", countStatus: "aplicado", countedAt: "2026-11-17T10:00:00Z" },
      items: [{ variantId: "v-1", trackingMode: null, physical: 20, reserved: 0, available: 20, inTransit: 0, pendingReturn: 0, incomingTransfer: 3, productName: "Polo", productId: "p-1", sku: "POL-M", companySku: null, attributes: { Talla: "M" }, courier: 15, difference: -5 }],
      totals: { variants: 1, physical: 20, reserved: 0, available: 20, incomingTransfer: 3, pendingReturn: 0, withoutCost: 0 },
      lastCount: { id: "ct-2", number: "CT-0002", status: "aplicado", closedAt: null, appliedAt: null },
      openReconciliation: null,
    });
    renderWithClient(<CourierPortalScreen view="stock" />);
    const row = await screen.findByTestId("stock-POL-M");
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Polo · Talla: MPOL-M", "20", "15", "-5"]);
    expect(screen.getByText("Olva Cusco")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Traslado en camino" })).not.toBeInTheDocument();
    expect(screen.queryByText(/S\/|••••/)).not.toBeInTheDocument();
    expect(getCourierStock).toHaveBeenCalledWith("w-4", expect.anything());
  });

  it("conciliación: solo mira, sin montos ni reclamos; lo que la cuadra es recibir el traslado", async () => {
    jest.mocked(listReconciliations).mockResolvedValue([{ ...RECONCILIATION, lines: undefined }]);
    jest.mocked(getReconciliation).mockResolvedValue(RECONCILIATION);
    renderWithClient(<CourierPortalScreen view="conciliacion" />);
    const line = await screen.findByTestId("line-POL-M");
    expect(within(line).getByText("+2 traslado en camino (TRA-0003)")).toBeInTheDocument();
    expect(within(line).getByRole("link", { name: "Recibir traslado" })).toHaveAttribute("href", "/almacen/recibir/traslados");
    expect(screen.queryByRole("button", { name: /Reclamar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explicar" })).not.toBeInTheDocument();
    expect(screen.queryByText(/S\/|••••|valorizado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/[Rr]eclam/)).not.toBeInTheDocument();
    expect(listReconciliations).toHaveBeenCalledWith({ inventoryId: "w-4" }, expect.anything());
  });

  it("sin conciliaciones lo dice", async () => {
    jest.mocked(listReconciliations).mockResolvedValue([]);
    renderWithClient(<CourierPortalScreen view="conciliacion" />);
    expect(await screen.findByText("Todavía no hay conciliaciones de tu almacén.")).toBeInTheDocument();
  });
});
