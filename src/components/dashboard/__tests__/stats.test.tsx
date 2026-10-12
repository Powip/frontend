import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import {
  buildDetailedSalesExportRows,
  exportDetailedSalesToExcel,
} from "@/utils/exportDetailedSalesReport";
import type { OrderResponseDto } from "@/features/sales/dto/order.dto";
import { Stats } from "../stats";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/DashboardScopeContext", () => ({ useDashboardScope: jest.fn() }));

jest.mock("@/utils/exportDetailedSalesReport", () => ({
  buildDetailedSalesExportRows: jest.fn(),
  exportDetailedSalesToExcel: jest.fn(),
}));

jest.mock("../DashboardCard", () => ({ DashboardCard: () => null }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

jest.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Element = () => null;
  return {
    ComposedChart: Container,
    BarChart: Container,
    ResponsiveContainer: Container,
    Bar: Element,
    Line: Element,
    XAxis: Element,
    YAxis: Element,
    CartesianGrid: Element,
    Tooltip: Element,
    Legend: Element,
    Cell: Element,
  };
});

type Summary = {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageTicket: number;
  totalDelivered: number;
  deliveredAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
  dailySales: { date: string; orders: number; amount: number; products: number }[];
  funnelMetrics: {
    ingresados: number;
    confirmados: number;
    enEnvio: number;
    entregados: number;
    pagados: number;
    rechazados: number;
  };
};

const SUMMARY: Summary = {
  totalSales: 980,
  totalOrders: 10,
  totalProducts: 17,
  averageTicket: 98,
  totalDelivered: 3,
  deliveredAmount: 294,
  byStatus: {
    PENDIENTE: { count: 2, amount: 196 },
    LLAMADO: { count: 3, amount: 294 },
    EN_ENVIO: { count: 1, amount: 98 },
    ENTREGADO: { count: 3, amount: 294 },
    PAGADO: { count: 1, amount: 98 },
  },
  dailySales: [{ date: "2026-10-12", orders: 10, amount: 980, products: 17 }],
  funnelMetrics: {
    ingresados: 2,
    confirmados: 3,
    enEnvio: 1,
    entregados: 3,
    pagados: 1,
    rechazados: 0,
  },
};

const EMPTY_SUMMARY: Summary = {
  totalSales: 0,
  totalOrders: 0,
  totalProducts: 0,
  averageTicket: 0,
  totalDelivered: 0,
  deliveredAmount: 0,
  byStatus: {},
  dailySales: [],
  funnelMetrics: {
    ingresados: 0,
    confirmados: 0,
    enEnvio: 0,
    entregados: 0,
    pagados: 0,
    rechazados: 0,
  },
};

const RANGE = { fromDate: "2026-10-01", toDate: "2026-10-31" };
const mockUseAuth = jest.mocked(useAuth);
const mockUseDashboardScope = jest.mocked(useDashboardScope);
const mockGet = jest.mocked(axiosAuth.get);
const mockBuildExportRows = jest.mocked(buildDetailedSalesExportRows);

function makeContext() {
  return {
    auth: {
      accessToken: "valid-token",
      user: {
        id: "owner-1",
        email: "owner@example.com",
        role: "ADMINISTRADOR",
        permissions: [],
      },
      company: {
        id: "company-1",
        name: "Kunca",
        stores: [
          { id: "current", name: "KUNCA" },
          { id: "sister", name: "Kunca COD - web" },
        ],
      },
      subscription: null,
      exp: 9999999999,
    },
    selectedStoreId: "current",
    setSelectedStore: jest.fn(),
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateCompany: jest.fn(),
    inventories: [],
    refreshInventories: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true),
    refreshSubscription: jest.fn(),
    refreshSession: jest.fn(),
  };
}

let context: ReturnType<typeof makeContext>;
let dashboardScope: ReturnType<typeof useDashboardScope>;

function summaryCard(description: string) {
  const card = screen.getByText(description).closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error(`Missing summary card: ${description}`);
  return within(card);
}

function funnelStage(label: string) {
  const stage = screen.getByText(label).closest(".relative");
  if (!(stage instanceof HTMLElement)) throw new Error(`Missing funnel stage: ${label}`);
  return within(stage);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReset();
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.example.com";
  context = makeContext();
  dashboardScope = {
    scope: "business",
    setScope: jest.fn(),
    storeIds: ["current", "sister"],
    scopeParams: { storeIds: "current,sister" },
    canFetch: true,
  };
  mockUseAuth.mockImplementation(() => context);
  mockUseDashboardScope.mockImplementation(() => dashboardScope);
  mockGet.mockResolvedValue({ data: SUMMARY });
});

describe("Stats dashboard data", () => {
  it("uses one authenticated business summary for the cards and COD funnel", async () => {
    render(<Stats {...RANGE} />);

    await waitFor(() => expect(summaryCard("Monto acumulado").getByText("S/ 980")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      "https://ventas.example.com/stats/summary",
      expect.objectContaining({
        params: { storeIds: "current,sister", ...RANGE },
        signal: expect.any(AbortSignal),
      }),
    );

    expect(summaryCard("Total pedidos").getByText("10")).toBeInTheDocument();
    expect(summaryCard("Total ítems vendidos").getByText("17")).toBeInTheDocument();
    expect(summaryCard("Por orden").getByText("S/ 98")).toBeInTheDocument();
    expect(funnelStage("Ingresados (Pendientes)").getByText("2")).toBeInTheDocument();
    expect(funnelStage("Confirmados (Llamado)").getByText("3")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("No hay pedidos en esta tienda para el período seleccionado.")).not.toBeInTheDocument();
  });

  it.each(["ADMINISTRADOR", "OWNER"])("includes every business store for owner role %s", async (role) => {
    context.auth.user.role = role;
    render(<Stats {...RANGE} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    expect(mockGet.mock.calls[0][1]?.params).toEqual({ storeIds: "current,sister", ...RANGE });
  });

  it("uses business totals for a whitelisted superadmin with a seller role", async () => {
    context.auth.user.role = "VENTAS";
    context.auth.user.email = "joel@aranni.com.pe";
    render(<Stats {...RANGE} />);

    await waitFor(() => expect(summaryCard("Total pedidos").getByText("10")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][1]?.params).toEqual({ storeIds: "current,sister", ...RANGE });
  });

  it("keeps the personal seller scope for VENTAS", async () => {
    context.auth.user.role = "VENTAS";
    dashboardScope = {
      ...dashboardScope,
      scope: "store",
      storeIds: ["current"],
      scopeParams: { storeId: "current" },
    };
    render(<Stats {...RANGE} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    expect(mockGet.mock.calls[0][1]?.params).toEqual({
      storeId: "current",
      ...RANGE,
      sellerId: "owner-1",
    });
  });

  it("explains an empty selected store and lets the user select a sister store", async () => {
    dashboardScope = {
      ...dashboardScope,
      scope: "store",
      storeIds: ["current"],
      scopeParams: { storeId: "current" },
    };
    mockGet.mockResolvedValue({ data: EMPTY_SUMMARY });
    render(<Stats {...RANGE} />);

    expect(await screen.findByText("No hay pedidos en esta tienda para el período seleccionado.")).toBeInTheDocument();
    expect(summaryCard("Total pedidos").getByText("0")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][1]?.params.storeId).toBe("current");
    expect(context.setSelectedStore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Ver Kunca COD - web" }));

    expect(context.setSelectedStore).toHaveBeenCalledTimes(1);
    expect(context.setSelectedStore).toHaveBeenCalledWith("sister");
    expect(dashboardScope.setScope).toHaveBeenCalledWith("store");
    expect(screen.queryByRole("button", { name: "Ver KUNCA" })).not.toBeInTheDocument();
  });

  it("explains an empty business without automatically switching to a store", async () => {
    mockGet.mockResolvedValue({ data: EMPTY_SUMMARY });
    render(<Stats {...RANGE} />);

    expect(await screen.findByText("No hay pedidos en este negocio para el período seleccionado.")).toBeInTheDocument();
    expect(summaryCard("Total pedidos").getByText("0")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(context.setSelectedStore).not.toHaveBeenCalled();
    expect(dashboardScope.setScope).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Ver Kunca COD - web" })).not.toBeInTheDocument();
  });

  it("does not request statistics before the access token is available", async () => {
    context.auth.accessToken = "";
    dashboardScope = { ...dashboardScope, canFetch: false };
    const { rerender } = render(<Stats {...RANGE} />);

    expect(mockGet).not.toHaveBeenCalled();
    context = { ...context, auth: { ...context.auth, accessToken: "valid-token" } };
    dashboardScope = { ...dashboardScope, canFetch: true };
    rerender(<Stats {...RANGE} />);

    await waitFor(() => expect(summaryCard("Total pedidos").getByText("10")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it.each([
    { role: "ADMINISTRADOR", email: "owner@example.com" },
    { role: "VENTAS", email: "joel@aranni.com.pe" },
  ])("exports every store in the business period for $email", async ({ role, email }) => {
    context.auth.user.role = role;
    context.auth.user.email = email;
    const currentOrder = { id: "order-current", status: "PENDIENTE", sellerId: null } as unknown as OrderResponseDto;
    const sisterOrder = { id: "order-sister", status: "ENTREGADO", sellerId: "other-seller" } as OrderResponseDto;
    const exportRows = [{ orderNumber: "CURRENT-1" }, { orderNumber: "SISTER-1" }] as ReturnType<typeof buildDetailedSalesExportRows>;
    mockGet
      .mockResolvedValueOnce({ data: SUMMARY })
      .mockResolvedValueOnce({ data: [currentOrder] })
      .mockResolvedValueOnce({ data: [sisterOrder] });
    mockBuildExportRows.mockReturnValue(exportRows);
    render(<Stats {...RANGE} />);
    await waitFor(() => expect(summaryCard("Total pedidos").getByText("10")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));

    await waitFor(() => expect(exportDetailedSalesToExcel).toHaveBeenCalledWith(exportRows, "funnel_efectividad_cod"));
    expect(mockGet).toHaveBeenCalledTimes(3);
    for (const storeId of ["current", "sister"]) {
      expect(mockGet).toHaveBeenCalledWith(
        `https://ventas.example.com/order-header/store/${storeId}`,
        expect.objectContaining({ params: RANGE }),
      );
    }
    expect(mockBuildExportRows).toHaveBeenCalledWith([currentOrder, sisterOrder]);
  });

  it("shows a request failure without inventing zero sales and allows retrying", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGet.mockRejectedValueOnce(new Error("Servicio no disponible"));

    try {
      render(<Stats {...RANGE} />);

      expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las estadísticas.");
      expect(summaryCard("Total pedidos").getByText("-")).toBeInTheDocument();
      expect(summaryCard("Total pedidos").queryByText("0")).not.toBeInTheDocument();
      expect(screen.queryByText("No hay pedidos en esta tienda para el período seleccionado.")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      await waitFor(() => expect(summaryCard("Total pedidos").getByText("10")).toBeInTheDocument());
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(funnelStage("Confirmados (Llamado)").getByText("3")).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each(["scope", "period"])("ignores an old response after changing the %s", async (change) => {
    const oldResponse = deferred<{ data: Summary }>();
    const newSummary = { ...SUMMARY, totalSales: 440, totalOrders: 4, averageTicket: 110 };
    mockGet.mockReturnValueOnce(oldResponse.promise).mockResolvedValueOnce({ data: newSummary });
    const { rerender } = render(<Stats {...RANGE} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    const oldSignal = mockGet.mock.calls[0][1]?.signal;

    if (change === "scope") {
      context = { ...context, selectedStoreId: "sister" };
      dashboardScope = {
        ...dashboardScope,
        scope: "store",
        storeIds: ["sister"],
        scopeParams: { storeId: "sister" },
      };
      rerender(<Stats {...RANGE} />);
    } else {
      rerender(<Stats fromDate="2026-09-01" toDate="2026-09-30" />);
    }

    await waitFor(() => expect(summaryCard("Monto acumulado").getByText("S/ 440")).toBeInTheDocument());
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(oldSignal?.aborted).toBe(true);
    expect(mockGet.mock.calls[1][1]?.params).toEqual(change === "scope"
      ? { storeId: "sister", ...RANGE }
      : { storeIds: "current,sister", fromDate: "2026-09-01", toDate: "2026-09-30" });

    await act(async () => { oldResponse.resolve({ data: SUMMARY }); });

    expect(summaryCard("Monto acumulado").getByText("S/ 440")).toBeInTheDocument();
    expect(summaryCard("Monto acumulado").queryByText("S/ 980")).not.toBeInTheDocument();
    expect(summaryCard("Total pedidos").getByText("4")).toBeInTheDocument();
  });
});
