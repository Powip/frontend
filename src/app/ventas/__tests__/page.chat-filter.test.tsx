import { useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ventas — casilla «Solo ventas por chat» (mockup 152): filtra las pestañas en el Core, solo cuentas con CRM.
 */

jest.mock("@/hooks/useCrmPlan", () => ({
  useCrmAccess: () => ({ data: { allowed: mockCrm.allowed } }),
  useCrmPlan: () => ({ data: { accountType: mockCrm.accountType } }),
}));
const mockCrm = { allowed: true, accountType: "core" };
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

describe("VentasPage — Solo ventas por chat", () => {
  beforeEach(() => { mockCrm.allowed = true; mockCrm.accountType = "core"; });
  const box = () => screen.getByRole("checkbox", { name: "Solo ventas por chat" });

  it("hay solo tres pestañas y la casilla manda crmOnly al Core en cada una", async () => {
    render(<VentasPage />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("tab", { name: /Ventas del chat/ })).not.toBeInTheDocument();
    expect(lastQuery()).not.toHaveProperty("crmOnly");

    fireEvent.click(box());
    await waitFor(() => expect(lastQuery()).toMatchObject({ tab: "pendientes", crmOnly: "yes", page: 1 }));

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }), { button: 0 });
    await waitFor(() => expect(lastQuery()).toMatchObject({ tab: "todas", crmOnly: "yes" }));
    expect(box()).toBeChecked();

    fireEvent.click(box());
    await waitFor(() => expect(lastQuery()).not.toHaveProperty("crmOnly"));
  });

  it("cuenta sin CRM: no hay casilla ni filtro", () => {
    mockCrm.allowed = false;
    render(<VentasPage />);
    expect(screen.queryByRole("checkbox", { name: "Solo ventas por chat" })).not.toBeInTheDocument();
    expect(lastQuery()).not.toHaveProperty("crmOnly");
  });

  it("cuenta Solo CRM: filtro fijo y sin casilla", () => {
    mockCrm.accountType = "solo";
    render(<VentasPage />);
    expect(screen.queryByRole("checkbox", { name: "Solo ventas por chat" })).not.toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ crmOnly: "yes" });
  });
});
