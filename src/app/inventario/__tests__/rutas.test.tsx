import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
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

function loginAs(role: string) {
  (useAuth as jest.Mock).mockReturnValue({
    auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1", role, permissions: [] } },
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
});

describe("rutas del módulo de inventario (FEAT-24 F1)", () => {
  it("cada pestaña tiene su ruta", () => {
    expect(INVENTARIO_TAB_ROUTES).toEqual({
      stock: "/inventario/stock",
      movimientos: "/inventario/movimientos",
      recepciones: "/inventario/recepciones",
      unificacion: "/inventario/unificacion",
    });
  });

  it.each([
    ["stock", /^Stock$/],
    ["movimientos", /^Movimientos$/],
    ["recepciones", /^Recepciones$/],
    ["unificacion", /Unificación/],
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

  it("quien no edita inventario no ve Unificación y, si entra por la URL, vuelve al stock", async () => {
    loginAs("VENTAS");
    renderTab("unificacion");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inventario/stock"));
    expect(screen.queryByRole("tab", { name: /Unificación/ })).not.toBeInTheDocument();
    expect(screen.queryByText("bandeja de unificación")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Stock$/ })).toHaveAttribute("aria-selected", "true");
  });

  it("el menú lateral mantiene Inventario activo en sus subrutas y no cambia las demás entradas", () => {
    expect(isChildActive("/inventario/movimientos", "/inventario")).toBe(true);
    expect(isChildActive("/inventario", "/inventario")).toBe(true);
    expect(isChildActive("/operaciones/pedidos", "/operaciones")).toBe(false);
    expect(isChildActive("/productos", "/inventario")).toBe(false);
  });
});
