import { render, screen } from "@testing-library/react";

/**
 * Ventas › columna "Estado" — el aviso bajo el select no puede ensanchar la columna.
 *
 * Bajo el select de Estado se muestra el motivo por el que el pedido no se puede
 * preparar (p. ej. "Confirma el pedido en Ver antes de prepararlo."). La celda
 * hereda `whitespace-nowrap` del TableCell, así que sin `whitespace-normal` la
 * frase entera quedaba en una línea, la tabla (layout automático) ensanchaba la
 * columna al largo de la frase y el pill (`w-full`) se estiraba hasta taparle
 * la tabla al usuario. jsdom no calcula layout, por eso se fijan las clases que
 * lo evitan: el aviso se parte en líneas y no pasa del ancho de la columna.
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

// Pedido de Shopify sin confirmar: salesPhysicalOperationBlockReason devuelve
// "Confirma el pedido en Ver antes de prepararlo."
const SHOPIFY_SIN_CONFIRMAR = {
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
} as unknown as OrderHeader;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useBusinessOrders).mockReturnValue({
    orders: [SHOPIFY_SIN_CONFIRMAR],
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useBusinessSalesPage).mockReturnValue({
    data: {
      data: [SHOPIFY_SIN_CONFIRMAR], total: 1, page: 1, totalPages: 1,
      counts: { pendientes: 1, anuladas: 0, todas: 1, pendientesAntiguos: 0 },
      kpis: { pendientes: 1, anuladas: 0, amounts: [] },
      metadata: { products: [] },
    },
    isFetching: false, isError: false, isDebouncing: false, refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessSalesPage>);
});

describe("VentasPage — aviso bajo el select de Estado", () => {
  it("se parte en líneas y no pasa del ancho de la columna (no estira el pill)", async () => {
    render(<VentasPage />);

    const aviso = await screen.findByText("Confirma el pedido en Ver antes de prepararlo.");

    expect(aviso.tagName).toBe("P");
    expect(aviso).toHaveClass("whitespace-normal");
    expect(aviso).toHaveClass("max-w-[150px]");
  });
});
