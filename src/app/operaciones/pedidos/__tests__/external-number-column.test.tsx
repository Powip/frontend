import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Operaciones › Pedidos › columna «N° Externo» (FEAT-31) en Atención, Preparados,
 * En camino / Despachados y Entregados / Anulados / Historial.
 *
 * El número con el que el cliente identifica el pedido fuera de Powip (el «AGPE923190» de
 * Shopify, o uno propio) va pegado a «N° Orden». Solo se dibuja la columna si algún pedido
 * de la pestaña lo trae.
 */

jest.mock("@/components/orders/OrderDetailModal", () => ({
  OrderDetailButton: () => null,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  }),
}));
jest.mock("@/contexts/DashboardScopeContext", () => ({
  useDashboardScope: () => ({ storeIds: ["store-1"], scopeKey: "company-1:business:store-1", canFetch: true }),
}));

import type { OrderHeader } from "@/interfaces/IOrder";
import { emptySalesFilters } from "@/components/ventas/SalesTableFilters";
import { AtencionTab } from "../_components/AtencionTab";
import { ClosedTab } from "../_components/ClosedTab";
import { PreparadosTab } from "../_components/PreparadosTab";
import { TransitTab } from "../_components/TransitTab";
import { emptyTabState, type OperationsTabData } from "../_components/tabState";
import { mapOrderToSale, type PedidosActions } from "../_components/types";

// Las pestañas usan react-query (selección visible); sin servidor, sin reintentos.
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function sale(overrides: Record<string, unknown> = {}) {
  return mapOrderToSale({
    id: "o-1",
    orderNumber: "ORD-001",
    customer: { id: "c-1", fullName: "Cliente Uno", phoneNumber: "999111222" },
    deliveryType: "DOMICILIO",
    grandTotal: "100.00",
    status: "PREPARADO",
    salesRegion: "LIMA",
    items: [],
    payments: [],
    created_at: "2026-09-25T15:00:00.000Z",
    updated_at: "2026-09-25T15:00:00.000Z",
    ...overrides,
  } as unknown as OrderHeader);
}

const actions = new Proxy(
  { can: () => true, apiCouriers: [], salesChannels: [], isBulkLoading: false, loadSalesByIds: async () => [] },
  { get: (target, prop: string) => (prop in target ? (target as never)[prop] : jest.fn()) },
) as unknown as PedidosActions;

function tabProps(sales: ReturnType<typeof sale>[]) {
  const data: OperationsTabData = {
    sales,
    total: sales.length,
    totalPages: 1,
    loading: false,
    fetching: false,
  };
  return {
    data,
    state: emptyTabState(),
    query: { tab: "preparados", filters: { ...emptySalesFilters }, page: 1 } as never,
    onState: jest.fn(),
    actions,
  };
}

const TABS: Array<[string, (sales: ReturnType<typeof sale>[]) => React.ReactElement]> = [
  ["Atención", (sales) => <AtencionTab sales={sales} actions={actions} />],
  ["Preparados", (sales) => <PreparadosTab {...tabProps(sales)} />],
  ["En camino", (sales) => <TransitTab variant="camino" {...tabProps(sales)} />],
  ["Despachados", (sales) => <TransitTab variant="despachados" {...tabProps(sales)} />],
  ["Entregados", (sales) => <ClosedTab variant="entregados" {...tabProps(sales)} />],
  ["Anulados", (sales) => <ClosedTab variant="anulados" {...tabProps(sales)} />],
  ["Historial", (sales) => <ClosedTab variant="historial" {...tabProps(sales)} />],
];

describe.each(TABS)("Operaciones › %s — columna N° Externo", (_name, renderTab) => {
  it("con un pedido que trae N° externo muestra la columna y el número", () => {
    render(renderTab([sale({ externalOrderNumber: "AGPE923190" })]));

    expect(screen.getByRole("columnheader", { name: "N° Externo" })).toBeInTheDocument();
    expect(screen.getByText("AGPE923190")).toBeInTheDocument();
  });

  it("si solo algunos lo traen, los demás quedan con un guion", () => {
    render(
      renderTab([
        sale({ externalOrderNumber: "AGPE923190" }),
        sale({ id: "o-2", orderNumber: "ORD-002" }),
      ]),
    );

    expect(screen.getByText("AGPE923190")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("sin ningún N° externo no dibuja la columna", () => {
    render(renderTab([sale()]));

    expect(screen.getByRole("columnheader", { name: "N° Orden" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "N° Externo" })).not.toBeInTheDocument();
  });
});
