import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { getMyWarehouses } from "@/services/userWarehousesService";
import InventarioView, { INVENTARIO_TAB_ROUTES, type InventarioTab } from "../_components/InventarioView";
import { isChildActive } from "@/components/layout/Sidebar";

const push = jest.fn();
const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }), usePathname: () => "/inventario/stock", redirect: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: jest.fn() }));
jest.mock("@/hooks/useBusinessInventories", () => ({ useBusinessInventories: jest.fn() }));
jest.mock("@/services/businessInventoryItemsService", () => ({
  ...jest.requireActual("@/services/businessInventoryItemsService"),
  fetchBusinessInventoryItems: jest.fn(),
}));
jest.mock("@/services/userWarehousesService", () => ({ getMyWarehouses: jest.fn() }));
jest.mock("@/components/warehouse-ops/transfers/TransfersTab", () => ({ __esModule: true, default: () => <div>bandeja de traslados</div> }));
jest.mock("@/components/warehouse-ops/counts/CountsTab", () => ({ __esModule: true, default: () => <div>bandeja de conteos</div> }));
jest.mock("@/components/warehouse-ops/adjustments/AdjustmentsTab", () => ({ __esModule: true, default: () => <div>bandeja de ajustes</div> }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/app/productos/shopify-sync-wizard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/inventory/ReconciliationTab", () => ({ ReconciliationTab: () => <div>bandeja de unificación</div> }));
jest.mock("@/components/inventory/MovementHistoryTable", () => ({ MovementHistoryTable: () => <div>tabla de movimientos</div> }));
jest.mock("@/components/inventory/receptions/ReceptionsTab", () => ({
  __esModule: true,
  default: (props: { canEdit: boolean; scopeInventoryIds: string[] | null }) => (
    <div>bandeja de recepciones · edita: {String(props.canEdit)} · alcance: {props.scopeInventoryIds === null ? "negocio" : props.scopeInventoryIds.join(",")}</div>
  ),
}));
jest.mock("@/components/inventory/out-of-stock/OutOfStockTab", () => ({
  __esModule: true,
  default: (props: { access: { customer: boolean; sinReserva: boolean } }) => (
    <div>bandeja sin stock · atención: {String(props.access.customer)} · sin reserva: {String(props.access.sinReserva)}</div>
  ),
}));

function loginAs(role: string, permissions: string[] = ["MANAGE_OPERATIONS"]) {
  (useAuth as jest.Mock).mockReturnValue({
    auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1", role, permissions } },
    hasPermission: (permission: string) => permissions.includes(permission),
  });
}
function renderTab(tab?: InventarioTab) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InventarioView tab={tab} /></QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useBusinessScope as jest.Mock).mockReturnValue({ scope: "business", storeIds: ["s-1"], canFetch: true });
  (useBusinessInventories as jest.Mock).mockReturnValue({ inventories: [], isSuccess: true, isPending: false, error: null });
  (fetchBusinessInventoryItems as jest.Mock).mockResolvedValue([]);
  (getMyWarehouses as jest.Mock).mockResolvedValue({ all: true, inventoryIds: [], operableIds: [] });
});

describe("rutas del módulo de inventario (FEAT-24 F1)", () => {
  it("cada pestaña tiene su ruta", () => {
    expect(INVENTARIO_TAB_ROUTES).toEqual({
      stock: "/inventario/stock",
      movimientos: "/inventario/movimientos",
      recepciones: "/inventario/recepciones",
      "pedidos-sin-stock": "/inventario/pedidos-sin-stock",
      unificacion: "/inventario/unificacion",
      traslados: "/inventario/traslados",
      conteos: "/inventario/conteos",
      ajustes: "/inventario/ajustes",
    });
  });

  it.each([
    ["stock", /^Stock$/],
    ["movimientos", /^Movimientos$/],
    ["recepciones", /^Recepciones$/],
    ["pedidos-sin-stock", /Pedidos sin stock/],
    ["unificacion", /Unificación/],
    ["traslados", /^Traslados$/],
    ["conteos", /^Conteos$/],
    ["ajustes", /^Ajustes y mermas$/],
  ] as const)("la ruta %s abre su pestaña seleccionada", async (tab, name) => {
    loginAs("ADMINISTRADOR");
    renderTab(tab);
    await waitFor(() => expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("movimientos muestra el historial y unificación la bandeja", async () => {
    loginAs("ADMINISTRADOR");
    const { unmount } = renderTab("movimientos");
    expect(await screen.findByText("tabla de movimientos")).toBeInTheDocument();
    unmount();
    renderTab("unificacion");
    expect(await screen.findByText("bandeja de unificación")).toBeInTheDocument();
  });

  it("Recepciones la ven todos; recibir es de quien edita inventario y en una tienda se acota a sus almacenes (FEAT-24 H2-F)", async () => {
    loginAs("VENTAS");
    const { unmount } = renderTab("recepciones");
    expect(await screen.findByText("bandeja de recepciones · edita: false · alcance: negocio")).toBeInTheDocument();
    unmount();
    loginAs("OPERACIONES");
    (useBusinessScope as jest.Mock).mockReturnValue({ scope: "store", storeIds: ["s-1"], canFetch: true });
    (useBusinessInventories as jest.Mock).mockReturnValue({ inventories: [{ id: "w-1", name: "Central", storeId: "s-1" }], isSuccess: true, isPending: false, error: null });
    renderTab("recepciones");
    expect(await screen.findByText("bandeja de recepciones · edita: true · alcance: w-1")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("Pedidos sin stock es de Atención al cliente y Operaciones; sin permiso vuelve al stock (FEAT-24 H2-F)", async () => {
    loginAs("ATENCION", ["MANAGE_CUSTOMER_SERVICE"]);
    const { unmount } = renderTab("pedidos-sin-stock");
    expect(await screen.findByText("bandeja sin stock · atención: true · sin reserva: true")).toBeInTheDocument();
    unmount();
    loginAs("REPARTO", ["UPDATE_DELIVERY_STATUS"]);
    const second = renderTab("pedidos-sin-stock");
    expect(await screen.findByText("bandeja sin stock · atención: false · sin reserva: true")).toBeInTheDocument();
    second.unmount();
    expect(replace).not.toHaveBeenCalled();
    loginAs("VENTAS", ["VIEW_SALES"]);
    renderTab("pedidos-sin-stock");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inventario/stock"));
    expect(screen.queryByRole("tab", { name: /Pedidos sin stock/ })).not.toBeInTheDocument();
  });

  it("quien no edita inventario no ve Unificación y, si entra por la URL, vuelve al stock", async () => {
    loginAs("VENTAS");
    renderTab("unificacion");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inventario/stock"));
    expect(screen.queryByRole("tab", { name: /Unificación/ })).not.toBeInTheDocument();
    expect(screen.queryByText("bandeja de unificación")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Stock$/ })).toHaveAttribute("aria-selected", "true");
  });

  it("Traslados, Conteos y Ajustes los ve cualquier rol del inventario y cada uno abre su bandeja (FEAT-24 H5)", async () => {
    loginAs("VENTAS", ["VIEW_SALES"]);
    for (const [tab, text] of [["traslados", "bandeja de traslados"], ["conteos", "bandeja de conteos"], ["ajustes", "bandeja de ajustes"]] as const) {
      const { unmount } = renderTab(tab);
      expect(await screen.findByText(text)).toBeInTheDocument();
      unmount();
    }
    expect(replace).not.toHaveBeenCalled();
  });

  it("el stock se pide solo de los almacenes que el usuario ve (FEAT-24 H6)", async () => {
    loginAs("ALMACEN", []);
    (useBusinessInventories as jest.Mock).mockReturnValue({
      inventories: [{ id: "w-1", name: "Central", storeId: "s-1" }, { id: "w-2", name: "Tienda Miraflores", storeId: "s-1" }],
      isSuccess: true,
      isPending: false,
      error: null,
    });
    (getMyWarehouses as jest.Mock).mockResolvedValue({ all: false, inventoryIds: ["w-2"], operableIds: ["w-2"] });
    renderTab("stock");
    await waitFor(() => expect(fetchBusinessInventoryItems).toHaveBeenCalled());
    for (const [args] of (fetchBusinessInventoryItems as jest.Mock).mock.calls) {
      expect(args.inventories.map((inv: { id: string }) => inv.id)).toEqual(["w-2"]);
    }
  });

  it("el menú lateral mantiene Inventario activo en sus subrutas y no cambia las demás entradas", () => {
    expect(isChildActive("/inventario/movimientos", "/inventario")).toBe(true);
    expect(isChildActive("/inventario", "/inventario")).toBe(true);
    expect(isChildActive("/operaciones/pedidos", "/operaciones")).toBe(false);
    expect(isChildActive("/productos", "/inventario")).toBe(false);
  });
});
