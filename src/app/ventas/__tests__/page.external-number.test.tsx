import { render, screen } from "@testing-library/react";

/**
 * Ventas › columna «N° Externo» (FEAT-31).
 *
 * El número con el que el cliente identifica el pedido fuera de Powip (el «AGPE923190» de
 * Shopify, o uno propio) va en una columna pegada a «N° Orden». Solo se dibuja si algún pedido
 * de la página lo trae: un cliente sin Shopify no ve una columna vacía.
 */

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: jest.requireMock("axios") }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1", storeIds: ["store-1"] }) }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/ventas",
}));
jest.mock("@/services/atencionClienteService", () => ({
  enviarPedidoALima: jest.fn(),
  reassignSeller: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/hooks/useBusinessSalesPage", () => ({ useBusinessSalesPage: jest.fn() }));
jest.mock("@/services/businessSalesService", () => ({ getBusinessSalesExport: jest.fn() }));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: () => ({ count: 0, loading: false, error: false, retry: jest.fn(), refetch: jest.fn() }),
}));
jest.mock("@/lib/peruDate", () => ({ ...jest.requireActual("@/lib/peruDate"), todayInPeru: () => "2026-09-26" }));
jest.mock("@/components/modals/CustomerServiceModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CreateGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));

import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessSalesPage } from "@/hooks/useBusinessSalesPage";
import type { OrderHeader } from "@/interfaces/IOrder";
import VentasPage from "../page";

// Pedido de la pestaña Pendientes (mismo fixture que el aviso de Estado).
function pedido(overrides: Record<string, unknown> = {}) {
  return {
    id: "o-1",
    orderNumber: "ORD-001",
    customer: { id: "c-1", fullName: "Cliente 1", phoneNumber: "999111222" },
    deliveryType: "DOMICILIO",
    grandTotal: "100.00",
    status: "PENDIENTE",
    salesRegion: "LIMA",
    items: [],
    payments: [],
    externalSource: "shopify",
    shopifyCommercialGate: true,
    commercialCommittedAt: null,
    stockVersion: 0,
    created_at: "2026-09-25T15:00:00.000Z",
    updated_at: "2026-09-25T15:00:00.000Z",
    ...overrides,
  } as unknown as OrderHeader;
}

function mockPage(orders: OrderHeader[]) {
  jest.mocked(useBusinessOrders).mockReturnValue({
    orders, loading: false, error: false, retry: jest.fn(), refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useBusinessSalesPage).mockReturnValue({
    data: {
      data: orders, total: orders.length, page: 1, totalPages: 1,
      counts: { pendientes: orders.length, anuladas: 0, todas: orders.length, pendientesAntiguos: 0 },
      kpis: { pendientes: orders.length, anuladas: 0, amounts: [] },
      metadata: { products: [] },
    },
    isFetching: false, isError: false, isDebouncing: false, refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessSalesPage>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
});

describe("VentasPage — columna N° Externo", () => {
  it("con un pedido que trae N° externo muestra la columna y el número", async () => {
    mockPage([pedido({ externalOrderNumber: "AGPE923190" })]);
    render(<VentasPage />);

    expect(await screen.findByText("AGPE923190")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "N° Externo" })).toBeInTheDocument();
  });

  it("si solo algunos pedidos lo traen, los demás quedan con un guion", async () => {
    mockPage([
      pedido({ externalOrderNumber: "AGPE923190" }),
      pedido({ id: "o-2", orderNumber: "ORD-002" }),
    ]);
    render(<VentasPage />);

    await screen.findByText("AGPE923190");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ORD-002")).toBeInTheDocument();
  });

  it("sin ningún N° externo no dibuja la columna", async () => {
    mockPage([pedido()]);
    render(<VentasPage />);

    expect(await screen.findByRole("columnheader", { name: "N° Orden" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "N° Externo" })).not.toBeInTheDocument();
  });
});
