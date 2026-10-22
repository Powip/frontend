import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AtencionClientePage from "../page";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useCcPedidos } from "@/hooks/useCcPedidos";
import { useCcKpis } from "@/hooks/useCcKpis";
import { useAgentes } from "@/hooks/useAgentes";
import CustomerServiceModal from "@/components/modals/CustomerServiceModal";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import type { OrderHeader } from "@/interfaces/IOrder";

const mockPush = jest.fn();
const mockRefetchCc = jest.fn();
const clients: QueryClient[] = [];
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><AtencionClientePage /></QueryClientProvider>);
}
afterEach(() => { for (const client of clients.splice(0)) client.clear(); });

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/atencion-cliente",
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: ["store-cc-1"], scope: "business", scopeKey: "company-cc-1:business:store-cc-1", canFetch: true }) }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("@/hooks/useCcPedidosAll", () => ({ useCcPedidosAll: () => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() }) }));
jest.mock("@/hooks/useSaleLifecycleRouting", () => ({ useSaleLifecycleRouting: () => async () => false }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/useCcPedidos", () => ({ useCcPedidos: jest.fn() }));
jest.mock("@/hooks/useCcKpis", () => ({ useCcKpis: jest.fn() }));
jest.mock("@/hooks/useAgentes", () => ({ useAgentes: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: ({ title }: { title: string }) => <h1>{title}</h1> }));
jest.mock("@/components/atencion-cliente/cc-v2/CcMovimientosTab", () => ({ CcMovimientosTab: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/cierre-dia/CcCierreDiaTab", () => ({ CcCierreDiaTab: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/CcTabsL1", () => ({ CcTabsL1: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/CcTabsL2", () => ({ CcTabsL2: () => null, defaultSubEstado: () => "por_confirmar" }));
jest.mock("@/components/atencion-cliente/cc-v2/CcKpiBar", () => ({ CcKpiBar: () => null }));
jest.mock("@/components/atencion-cliente/cc-v2/CcToolbar", () => ({ CcToolbar: () => null, AGENTE_UNASSIGNED: "UNASSIGNED" }));
jest.mock("@/components/atencion-cliente/IncompleteOrdersTab", () => ({ IncompleteOrdersTab: () => null }));
jest.mock("@/components/eva/SendToEvaButton", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: jest.fn(({ open, orderId, onClose }: { open: boolean; orderId: string; onClose: () => void }) =>
    open ? <div data-testid="cc-order-detail">Detalle CC {orderId}<button onClick={onClose}>Cerrar detalle</button></div> : null),
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: jest.fn(({ open, orderId, orderNumber, onClose }: { open: boolean; orderId: string; orderNumber: string; onClose: () => void }) =>
    open ? <div data-testid="cc-order-payments">Pagos {orderNumber} · {orderId}<button onClick={onClose}>Cerrar pagos</button></div> : null),
}));
jest.mock("@/utils/exportCcPedidosExcel", () => ({ exportCcPedidosToExcel: jest.fn() }));
jest.mock("@/utils/exportSalesExcel", () => ({ exportSalesToExcel: jest.fn() }));
jest.mock("@/services/incompleteOrdersService", () => ({ confirmOrder: jest.fn() }));
jest.mock("@/services/atencionClienteService", () => ({ reassignSeller: jest.fn(), recuperarVentaCC: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() } }));

const COD_ORDER = {
  id: "shopify-cod-order-1",
  orderNumber: "SHOP-501",
  storeId: "store-cc-1",
  commercialStage: "LEAD",
  commercialLeadId: "lead-cod-1",
  commercialStockState: "DEFERRED",
  canalOrigen: "shopify_cod",
  subEstadoCc: "por_confirmar",
  externalSource: "shopify",
  currency: "PEN",
  grandTotal: "79.90",
  created_at: "2026-10-22T22:00:00.000Z",
  datosCompletos: true,
  dniCliente: "45678912",
  customer: { fullName: "María Pérez", phoneNumber: "999111222", district: "Miraflores", address: "Av. Flores 123" },
  payments: [],
  items: [],
} as unknown as OrderHeader;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    selectedStoreId: "store-cc-1",
    hasPermission: (permission: string) => permission === "MANAGE_CUSTOMER_SERVICE",
    auth: {
      company: { id: "company-cc-1", stores: [] },
      user: {
        id: "cc-user-1",
        authorizationVerified: true,
        authorizationCompanyId: "company-cc-1",
        permissions: ["MANAGE_CUSTOMER_SERVICE"],
      },
    },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useCcPedidos).mockReturnValue({
    data: { data: [COD_ORDER], total: 1, page: 1, totalPages: 1 }, isLoading: false, refetch: mockRefetchCc,
  } as unknown as ReturnType<typeof useCcPedidos>);
  jest.mocked(useBusinessOrders).mockReturnValue({ orders: [], loading: false, error: false, refetch: jest.fn() } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useCcKpis).mockReturnValue({ data: {}, isLoading: false } as unknown as ReturnType<typeof useCcKpis>);
  jest.mocked(useAgentes).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useAgentes>);
});

it("lets a CC-only operator open the Shopify COD detail locally without querying sales by store", async () => {
  renderPage();
  const user = userEvent.setup();

  expect(screen.getByText("SHOP-501")).toBeInTheDocument();
  expect(screen.getByText("Lead · compra pendiente")).toBeInTheDocument();
  expect(useCcPedidos).toHaveBeenCalledWith(expect.objectContaining({ storeIds: ["store-cc-1"], tipoGestion: "cod" }));
  expect(useBusinessOrders).toHaveBeenCalledWith(undefined, undefined, expect.objectContaining({ enabled: false }));
  expect(screen.queryByRole("tab", { name: /Pre-Ventas/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Correcciones/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Promos/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Ver detalle del pedido SHOP-501" }));
  expect(await screen.findByTestId("cc-order-detail")).toHaveTextContent("shopify-cod-order-1");
  expect(jest.mocked(CustomerServiceModal).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
    open: true, orderId: "shopify-cod-order-1", onOrderUpdated: expect.any(Function),
  }));
  jest.mocked(CustomerServiceModal).mock.calls.at(-1)?.[0].onOrderUpdated?.();
  expect(mockRefetchCc).toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Lead/i })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
  expect(screen.queryByTestId("cc-order-detail")).not.toBeInTheDocument();
  expect(screen.getByText("SHOP-501")).toBeInTheDocument();
});

it("opens payments for that same pending COD order in CC without approval or a Lead redirect", async () => {
  renderPage();
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "Gestionar pagos" }));
  expect(screen.getByTestId("cc-order-payments")).toHaveTextContent("SHOP-501 · shopify-cod-order-1");
  expect(jest.mocked(PaymentVerificationModal).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
    open: true, orderId: "shopify-cod-order-1", orderNumber: "SHOP-501", canApprove: false, onPaymentUpdated: expect.any(Function),
  }));
  jest.mocked(PaymentVerificationModal).mock.calls.at(-1)?.[0].onPaymentUpdated?.();
  expect(mockRefetchCc).toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: /Lead/i })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Cerrar pagos" }));
  expect(screen.queryByTestId("cc-order-payments")).not.toBeInTheDocument();
  expect(screen.getByText("SHOP-501")).toBeInTheDocument();
});
