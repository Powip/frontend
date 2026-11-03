/**
 * PedidosContent con las pestañas reales: qué se le pide al servidor en cada pestaña, la
 * compatibilidad de URLs y la navegación entre tarjetas.
 */
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { OperationsPedidosQuery } from "@/services/operationsPedidosService";

const mockHookCalls: OperationsPedidosQuery[] = [];
let mockSearch = "";
const mockInvalidate = jest.fn();

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn(), promise: jest.fn() } }));
jest.mock("@/hooks/useOperationsPedidos", () => ({
  ...jest.requireActual("@/hooks/useOperationsPedidos"),
  useOperationsPedidos: (query: OperationsPedidosQuery) => {
    mockHookCalls.push(query);
    return {
      data: {
        data: [], total: 0, page: query.page, totalPages: 1,
        counts: { preparados: 32, preparadosContactados: 24, preparadosNoContactados: 8, enCamino: 41, despachados: 18, entregados: 156, anulados: 12, historial: 168, atencion: 3 },
        window: { days: 30, from: null, to: null, explicit: false },
      },
      isLoading: false, isFetching: false, isError: false, refetch: jest.fn(), invalidate: mockInvalidate,
    };
  },
  useVisibleSelection: () => ({ visibleIds: null, loading: false }),
}));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: ["store-a"], canFetch: true }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "company-1" }, user: { id: "user-1" } } }) }));
jest.mock("@/contexts/OperationsRoleContext", () => ({ useOperationsRole: () => ({ can: () => true }) }));
jest.mock("@/hooks/useUserAuditInfo", () => ({ useUserAuditInfo: () => () => ({ userId: "operator" }) }));
jest.mock("@/services/courierService", () => ({ fetchCouriers: jest.fn().mockResolvedValue([{ name: "Shalom" }]) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("@/components/orders/OrderDetailModal", () => ({
  OrderDetailModalProvider: ({ children }: { children: ReactNode }) => children,
  OrderDetailButton: () => null,
  useOrderDetailModal: () => ({ openOrderDetail: jest.fn() }),
}));
jest.mock("@/app/operaciones/_shared/GlobalScanner", () => ({ GlobalScanner: () => null }));
jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
for (const modal of ["CreateGuideModal", "GuideDetailsModal", "AddToExistingGuideModal", "PaymentVerificationModal", "CancellationModal", "CourierAssignmentModal", "ReassignSellerModal"]) {
  jest.mock(`@/components/modals/${modal}`, () => ({ __esModule: true, default: () => null, getCancellationReasonLabel: () => "Otro" }));
}
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null, getCancellationReasonLabel: () => "Otro" }));
jest.mock("@/components/ventas/RescheduleDialog", () => ({ RescheduleDialog: () => null }));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/utils/exportSalesExcel", () => ({ exportSalesToExcel: jest.fn() }));
jest.mock("@/utils/bulk-receipt-printer", () => ({ openPrintWindow: jest.fn(), printReceipts: jest.fn() }));

import { PedidosContent } from "../PedidosContent";

const lastQuery = () => mockHookCalls[mockHookCalls.length - 1];
const heading = () => screen.getByRole("heading", { level: 2 });

beforeEach(() => {
  jest.clearAllMocks();
  mockHookCalls.length = 0;
  mockSearch = "";
});

describe("PedidosContent — pestañas y compatibilidad de URLs", () => {
  it("abre en Preparados por defecto y pide Preparados, de a 15, al servidor", () => {
    render(<PedidosContent />);

    expect(heading()).toHaveTextContent("Preparados");
    expect(screen.getByTestId("tab-card-preparados")).toHaveAttribute("aria-selected", "true");
    expect(lastQuery()).toMatchObject({ tab: "preparados", page: 1, limit: 15 });
  });

  it("muestra los contadores de las 7 tarjetas que vienen en la misma respuesta", () => {
    render(<PedidosContent />);

    const expected: Record<string, string> = {
      preparados: "32", camino: "41", despachados: "18", entregados: "156", anulados: "12", historial: "168",
    };
    for (const [tab, count] of Object.entries(expected)) {
      expect(within(screen.getByTestId(`tab-card-${tab}`)).getByText(count)).toBeInTheDocument();
    }
    expect(screen.getByTestId("tab-card-atencion")).toHaveTextContent("3alertas");
    // El botón Escanear y el título siguen ahí.
    expect(screen.getByRole("button", { name: /escanear/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Pedidos" })).toBeInTheDocument();
  });

  it.each(["por-despachar", "despachar", "pendientes", "algo-raro"])("?tab=%s cae en Preparados", (slug) => {
    mockSearch = `tab=${slug}`;
    render(<PedidosContent />);
    expect(heading()).toHaveTextContent("Preparados");
    expect(lastQuery().tab).toBe("preparados");
  });

  it("el antiguo ?tab=camino&qf=por-confirmar abre Despachados con ese filtro", () => {
    mockSearch = "tab=camino&qf=por-confirmar";
    render(<PedidosContent />);

    expect(heading()).toHaveTextContent("Despachados");
    expect(lastQuery()).toMatchObject({ tab: "despachados", quick: "por-confirmar" });
  });

  it("?tab=camino&qf=listos-escanear abre En camino filtrando EN_ENVIO con guía", () => {
    mockSearch = "tab=camino&qf=listos-escanear";
    render(<PedidosContent />);

    expect(lastQuery()).toMatchObject({ tab: "en-camino", filters: expect.objectContaining({ status: "EN_ENVIO", hasGuide: "yes" }) });
  });

  it("?q= precarga la búsqueda en la pestaña pedida", () => {
    mockSearch = "tab=historial&q=ORD-1";
    render(<PedidosContent />);
    expect(lastQuery()).toMatchObject({ tab: "historial", filters: expect.objectContaining({ search: "ORD-1" }) });
  });

  it("cada tarjeta abre su pestaña y pide la pestaña correcta al servidor", () => {
    render(<PedidosContent />);

    const cases: [string, string, string][] = [
      ["camino", "En camino", "en-camino"],
      ["despachados", "Despachados", "despachados"],
      ["entregados", "Entregados", "entregados"],
      ["anulados", "Anulados", "anulados"],
      ["historial", "Historial", "historial"],
      ["atencion", "Necesita atención", "atencion"],
      ["preparados", "Preparados", "preparados"],
    ];
    for (const [card, title, serverTab] of cases) {
      fireEvent.click(screen.getByTestId(`tab-card-${card}`));
      expect(heading()).toHaveTextContent(title);
      expect(lastQuery().tab).toBe(serverTab);
    }
  });

  it("solo Preparados lleva subestado, solo En camino/Despachados llevan vista por guía y solo Despachados el filtro rápido", () => {
    render(<PedidosContent />);

    fireEvent.click(screen.getByRole("button", { name: /^no contactado/i }));
    expect(lastQuery()).toMatchObject({ tab: "preparados", sub: "no_contactado" });

    fireEvent.click(screen.getByTestId("tab-card-camino"));
    expect(lastQuery().sub).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Por guía" }));
    expect(lastQuery()).toMatchObject({ tab: "en-camino", view: "guia" });

    fireEvent.click(screen.getByTestId("tab-card-despachados"));
    fireEvent.click(screen.getByRole("button", { name: /por confirmar entrega/i }));
    expect(lastQuery()).toMatchObject({ tab: "despachados", quick: "por-confirmar" });

    fireEvent.click(screen.getByTestId("tab-card-entregados"));
    expect(lastQuery().view).toBeUndefined();
    expect(lastQuery().quick).toBeUndefined();
    expect(lastQuery().sub).toBeUndefined();
  });

  it("Necesita atención se pide completa (hasta 100) porque sus subvistas se calculan en el navegador", () => {
    render(<PedidosContent />);
    fireEvent.click(screen.getByTestId("tab-card-atencion"));
    expect(lastQuery()).toMatchObject({ tab: "atencion", limit: 100, page: 1 });
  });

  it("cada pestaña recuerda su página y sus filtros al volver a ella", () => {
    render(<PedidosContent />);

    fireEvent.click(screen.getByRole("button", { name: /^contactado/i }));
    fireEvent.click(screen.getByTestId("tab-card-entregados"));
    fireEvent.click(screen.getByTestId("tab-card-preparados"));

    expect(lastQuery()).toMatchObject({ tab: "preparados", sub: "contactado" });
  });
});

describe("PedidosContent — estados vacíos y cargas", () => {
  it("sin pedidos muestra el mensaje de cada pestaña y no un error", () => {
    render(<PedidosContent />);
    expect(screen.getByText("Sin pedidos preparados")).toBeInTheDocument();
    act(() => { fireEvent.click(screen.getByTestId("tab-card-entregados")); });
    expect(screen.getByText(/sin pedidos entregados en este período/i)).toBeInTheDocument();
  });
});
