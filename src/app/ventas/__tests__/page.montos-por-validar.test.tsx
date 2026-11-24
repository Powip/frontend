import { render, screen, within } from "@testing-library/react";

/**
 * Ventas › Montos (FEAT-33 A4/D5): un Yape enviado y sin validar se ve aparte, en morado, y la
 * etiqueta dice «Por validar», nunca «Con saldo» por ese monto. El punto rojo del botón $ avisa si
 * hay algo por validar o saldo.
 */

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: jest.requireMock("axios"),
}));
jest.mock("@/contexts/BusinessScopeContext", () => ({
  useBusinessScope: () => ({
    scopeKey: "company-1:business:store-1",
    storeIds: ["store-1"],
  }),
}));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({
  useInvalidateBusinessData: () => jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
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
jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: jest.fn(),
}));
jest.mock("@/hooks/useBusinessSalesPage", () => ({
  useBusinessSalesPage: jest.fn(),
}));
jest.mock("@/services/businessSalesService", () => ({
  getBusinessSalesExport: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: () => ({
    count: 0,
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch: jest.fn(),
  }),
}));
jest.mock("@/lib/peruDate", () => ({
  ...jest.requireActual("@/lib/peruDate"),
  todayInPeru: () => "2026-09-26",
}));
jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/ImportSalesModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CreateGuideModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CancellationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/ReassignSellerModal", () => ({
  __esModule: true,
  default: () => null,
}));

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
    orders,
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useBusinessSalesPage).mockReturnValue({
    data: {
      data: orders,
      total: orders.length,
      page: 1,
      totalPages: 1,
      counts: {
        pendientes: orders.length,
        anuladas: 0,
        todas: orders.length,
        pendientesAntiguos: 0,
      },
      kpis: { pendientes: orders.length, anuladas: 0, amounts: [] },
      metadata: { products: [] },
    },
    isFetching: false,
    isError: false,
    isDebouncing: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessSalesPage>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: {
        id: "user-1",
        name: "Ana",
        surname: "V",
        role: "ADMIN",
        permissions: [],
      },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
});

const yape = (status: string) => ({
  id: `p-${status}`,
  paymentMethod: "YAPE",
  amount: "199.00",
  status,
  created_at: "2026-09-25T15:00:00.000Z",
});
const row = (orderNumber: string) =>
  screen.getByText(orderNumber).closest("tr") as HTMLElement;

describe("VentasPage — Montos con pago por validar (FEAT-33 A4)", () => {
  it("shows the Yape under review in purple and labels the order «Por validar»", async () => {
    mockPage([
      pedido({
        id: "o-1",
        orderNumber: "ORD-153866",
        currency: "PEN",
        grandTotal: "199.00",
        externalSource: "POWIP_LIVE",
        payments: [yape("PENDING")],
      }),
      pedido({
        id: "o-2",
        orderNumber: "ORD-153902",
        currency: "PEN",
        grandTotal: "199.00",
        externalSource: "POWIP_LIVE",
        payments: [yape("PAID")],
      }),
      pedido({
        id: "o-3",
        orderNumber: "ORD-153950",
        currency: "PEN",
        grandTotal: "100.00",
      }),
    ]);
    render(<VentasPage />);
    await screen.findByText("ORD-153866");

    const reviewing = row("ORD-153866");
    expect(
      within(reviewing).getByText("Yape por validar: S/ 199.00"),
    ).toBeInTheDocument();
    expect(within(reviewing).getByText("Adel: S/ 0.00")).toBeInTheDocument();
    expect(within(reviewing).getByText("Por validar")).toBeInTheDocument();
    expect(within(reviewing).queryByText("Con saldo")).not.toBeInTheDocument();
    expect(
      within(reviewing).getByTestId("payment-attention"),
    ).toBeInTheDocument();

    const paid = row("ORD-153902");
    expect(within(paid).getByText("Pagado")).toBeInTheDocument();
    expect(
      within(paid).queryByTestId("payment-attention"),
    ).not.toBeInTheDocument();

    const owing = row("ORD-153950");
    expect(within(owing).getByText("Con saldo")).toBeInTheDocument();
    expect(within(owing).getByTestId("payment-attention")).toBeInTheDocument();
  });
});

describe("VentasPage — Pago / Envío y Origen (FEAT-33 A6/A7)", () => {
  it("says the agency and courier of an agency order and keeps home deliveries as DOMICILIO", async () => {
    mockPage([
      pedido({
        id: "o-1",
        orderNumber: "ORD-153866",
        currency: "PEN",
        deliveryType: "PUNTO_EXTERNO",
        courier: "SHALOM",
        externalSource: "POWIP_LIVE",
        closingChannel: "POWIP_LIVE",
        payments: [yape("PENDING")],
      }),
      pedido({
        id: "o-2",
        orderNumber: "ORD-153902",
        currency: "PEN",
        deliveryType: "PUNTO_EXTERNO",
        courier: "OLVA",
        externalSource: "POWIP_LIVE",
        closingChannel: "POWIP_LINK",
        payments: [yape("PAID")],
      }),
      pedido({
        id: "o-3",
        orderNumber: "ORD-153950",
        currency: "PEN",
        deliveryType: "DOMICILIO",
        courier: "MOTORIZADO",
        externalSource: "POWIP_LIVE",
        closingChannel: "POWIP_LIVE",
        payments: [yape("PAID")],
      }),
    ]);
    render(<VentasPage />);
    await screen.findByText("ORD-153866");

    expect(within(row("ORD-153866")).getByText("AGENCIA SHALOM")).toBeInTheDocument();
    expect(within(row("ORD-153866")).getByText(/POWIP Live/)).toBeInTheDocument();
    expect(within(row("ORD-153902")).getByText("AGENCIA OLVA COURIER")).toBeInTheDocument();
    expect(within(row("ORD-153902")).getByText(/POWIP Link/)).toBeInTheDocument();
    expect(within(row("ORD-153950")).getByText("DOMICILIO")).toBeInTheDocument();
  });
});
