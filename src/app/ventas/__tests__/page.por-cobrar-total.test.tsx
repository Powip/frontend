import { useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ventas — tarjeta «Por cobrar total»: saldo de todas las ventas del rango (sin anuladas)
 * y, al hacer clic, Todas las Ventas con «Saldo pendiente: Sí», sin anuladas y el mismo rango.
 */

jest.mock("@/hooks/useChatSalesFilter", () => ({
  useChatSalesFilter: () => ({ hasCrm: false, solo: false, checked: false, setChecked: jest.fn(), active: false }),
}));
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
jest.mock("@/hooks/useBusinessOrdersCount", () => ({ useBusinessOrdersCount: jest.fn() }));
jest.mock("@/lib/peruDate", () => ({ ...jest.requireActual("@/lib/peruDate"), todayInPeru: () => "2026-09-26" }));
jest.mock("@/components/dashboard/PeriodSelector", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    PeriodSelector: ({ onPeriodChange }: { onPeriodChange: (from: string, to: string) => void }) => {
      useEffect(() => {
        onPeriodChange("2026-09-01", "2026-09-30");
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    },
  };
});
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
import { useBusinessOrdersCount } from "@/hooks/useBusinessOrdersCount";
import VentasPage from "../page";

const mockSalesPage = jest.mocked(useBusinessSalesPage);

let kpis: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  kpis = {
    pendientes: 3,
    anuladas: 1,
    amounts: [{ currency: "PEN", paid: 40, pending: 60 }],
    pendingTotal: [
      { currency: "PEN", pending: 1250.5, count: 7 },
      { currency: "USD", pending: 30, count: 1 },
    ],
  };
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useBusinessOrders).mockReturnValue({
    orders: [], loading: false, error: false, retry: jest.fn(), refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrders>);
  jest.mocked(useBusinessOrdersCount).mockReturnValue({
    count: 0, loading: false, error: false, retry: jest.fn(), refetch: jest.fn(),
  } as unknown as ReturnType<typeof useBusinessOrdersCount>);
  mockSalesPage.mockImplementation((() => {
    // Respuesta estable entre renders: un objeto nuevo en cada render dispara el efecto de la página en bucle.
    const data = useMemo(() => ({
      data: [], total: 0, page: 1, totalPages: 1,
      counts: { pendientes: 3, anuladas: 1, todas: 11, pendientesAntiguos: 0 },
      kpis,
      metadata: { products: [] },
    }), []);
    return { data, isFetching: false, isError: false, isDebouncing: false, refetch: jest.fn() };
  }) as unknown as typeof useBusinessSalesPage);
});

const lastQuery = () => mockSalesPage.mock.calls.at(-1)![1];

describe("VentasPage — Por cobrar total", () => {
  it("muestra la tarjeta junto a las actuales, con el saldo por moneda y las ventas contadas", () => {
    render(<VentasPage />);
    const card = screen.getByTestId("kpi-por-cobrar-total");
    expect(card).toHaveTextContent("Por cobrar total");
    expect(card).toHaveTextContent("Todas las ventas con saldo, menos anuladas");
    expect(card).toHaveTextContent("S/ 1250.50");
    expect(card).toHaveTextContent("USD 30.00");
    expect(screen.getByTestId("kpi-por-cobrar-total-count")).toHaveTextContent("8 ventas");
    // Las tarjetas existentes siguen igual
    for (const title of ["Pendientes", "Anuladas", "Por cobrar", "Adelantado"]) {
      expect(screen.getByText(title, { selector: "p" })).toBeInTheDocument();
    }
  });

  it("sin ventas con saldo muestra 0.00 y sin contador", () => {
    kpis = { ...kpis, pendingTotal: [] };
    render(<VentasPage />);
    expect(screen.getByTestId("kpi-por-cobrar-total")).toHaveTextContent("0.00");
    expect(screen.queryByTestId("kpi-por-cobrar-total-count")).not.toBeInTheDocument();
  });

  it("con el servidor viejo (sin pendingTotal) no se rompe", () => {
    delete kpis.pendingTotal;
    render(<VentasPage />);
    expect(screen.getByTestId("kpi-por-cobrar-total")).toHaveTextContent("0.00");
  });

  it("al hacer clic abre Todas con saldo pendiente, sin anuladas y el rango de las tarjetas", async () => {
    render(<VentasPage />);
    expect(lastQuery()).toMatchObject({ tab: "pendientes" });
    expect(lastQuery()).not.toHaveProperty("excludeCancelled");

    fireEvent.click(screen.getByTestId("kpi-por-cobrar-total"));

    await waitFor(() => expect(lastQuery()).toMatchObject({
      tab: "todas",
      hasPendingBalance: "yes",
      excludeCancelled: "yes",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
      kpiDateFrom: "2026-09-01",
      kpiDateTo: "2026-09-30",
      page: 1,
    }));
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toHaveAttribute("data-state", "active");
    // El filtro «Saldo pendiente: Sí» cuenta como filtro activo
    expect(screen.getByTestId("chip-sin-anuladas")).toBeInTheDocument();
  });

  it("también se activa con el teclado y la insignia «Sin anuladas» quita solo ese filtro", async () => {
    render(<VentasPage />);
    fireEvent.keyDown(screen.getByTestId("kpi-por-cobrar-total"), { key: "Enter" });
    await waitFor(() => expect(lastQuery()).toMatchObject({ tab: "todas", excludeCancelled: "yes", hasPendingBalance: "yes" }));

    fireEvent.click(screen.getByTestId("chip-sin-anuladas"));
    await waitFor(() => expect(lastQuery()).not.toHaveProperty("excludeCancelled"));
    expect(lastQuery()).toMatchObject({ tab: "todas", hasPendingBalance: "yes" });
    expect(screen.queryByTestId("chip-sin-anuladas")).not.toBeInTheDocument();
  });
});
