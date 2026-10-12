import React, { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardScopeProvider, useDashboardScope } from "@/contexts/DashboardScopeContext";
import VentasPage from "../ventas/page";
import OperacionesPage from "../operaciones/page";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/dashboard/PeriodSelector", () => ({
  PeriodSelector: ({ onPeriodChange }: { onPeriodChange: (from: string, to: string) => void }) => (
    <div>
      <button onClick={() => onPeriodChange("2026-10-01", "2026-10-31")}>Octubre</button>
      <button onClick={() => onPeriodChange("2026-09-01", "2026-09-30")}>Septiembre</button>
      <button onClick={() => onPeriodChange("2026-10-12", "2026-10-12")}>Hoy</button>
    </div>
  ),
}));
jest.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Chart = ({ data, children }: { data?: unknown; children?: ReactNode }) => (
    <div><pre data-testid="chart-data">{JSON.stringify(data)}</pre><svg>{children}</svg></div>
  );
  const Element = () => null;
  return {
    ResponsiveContainer: Container,
    BarChart: Chart, LineChart: Chart, AreaChart: Chart, PieChart: Chart,
    Bar: Element, Line: Element, Area: Element, Pie: Element, Cell: Element,
    XAxis: Element, YAxis: Element, CartesianGrid: Element, Tooltip: Element, Legend: Element,
  };
});

const mockGet = jest.mocked(axiosAuth.get);
const mockUseAuth = jest.mocked(useAuth);
const orders = [
  {
    id: "delivered", storeId: "store-web", status: "ENTREGADO", grandTotal: "300",
    created_at: "2026-10-10T12:00:00.000Z", updated_at: "2026-10-12T12:00:00.000Z",
    salesChannel: "SHOPIFY", guideNumber: "guide-1", notes: "", cancellationReason: null,
    items: [{ productName: "Producto Shopify", quantity: 3, subtotal: "300" }],
    logs: [{ timestamp: "2026-10-12T12:00:00.000Z", data: { status: "ENTREGADO" } }],
  },
  {
    id: "cancelled", storeId: "store-web", status: "ANULADO", grandTotal: "100",
    created_at: "2026-10-11T12:00:00.000Z", updated_at: "2026-10-11T12:00:00.000Z",
    salesChannel: "WEB", guideNumber: null, notes: "Sin respuesta", cancellationReason: null,
    items: [{ productName: "Producto Web", quantity: 1, subtotal: "100" }], logs: [],
  },
  {
    id: "previous-pending", storeId: "store-web", status: "PENDIENTE", grandTotal: "100",
    created_at: "2026-09-15T12:00:00.000Z", updated_at: "2026-09-15T12:00:00.000Z",
    salesChannel: "WEB", guideNumber: null, notes: "", cancellationReason: null,
    items: [], logs: [],
  },
];

function ScopeControls() {
  const { setScope } = useDashboardScope();
  return <button onClick={() => setScope("store")}>Ver tienda vacía</button>;
}

function renderMetrics(Page: typeof VentasPage | typeof OperacionesPage) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardScopeProvider>
        <ScopeControls />
        <Page />
      </DashboardScopeProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Octubre" }));
}

function metricCard(label: string) {
  return within(screen.getByText(label).closest(".bg-card")!);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    auth: {
      accessToken: "current-business-token",
      user: { id: "owner", email: "owner@example.com", role: "ADMINISTRADOR", permissions: [] },
      company: {
        id: "business-kunca", name: "Kunca",
        stores: [{ id: "store-empty", name: "KUNCA" }, { id: "store-web", name: "Kunca COD - web" }],
      },
      subscription: null, exp: 9999999999,
    },
    selectedStoreId: "store-empty", loading: false,
    login: jest.fn(), logout: jest.fn(), setSelectedStore: jest.fn(), updateCompany: jest.fn(),
    inventories: [], refreshInventories: jest.fn(), hasPermission: jest.fn(),
    refreshSession: jest.fn(), refreshSubscription: jest.fn(),
  });
  mockGet.mockImplementation(async (url) => ({
    data: String(url).endsWith("/store/store-web") ? orders : [],
  }));
});

it("suma ventas de las dos tiendas y conserva la comparación con el periodo anterior", async () => {
  renderMetrics(VentasPage);

  await waitFor(() => expect(metricCard("Ventas del mes").getByText("S/ 400")).toBeInTheDocument());
  expect(metricCard("Ventas del mes").getByText("2 órdenes")).toBeInTheDocument();
  expect(metricCard("Ticket promedio").getByText("S/ 200")).toBeInTheDocument();
  expect(metricCard("Crecimiento vs mes ant.").getByText("+300%")).toBeInTheDocument();
  expect(screen.getByText("Ingresos vs S/ 100")).toBeInTheDocument();
  expect(metricCard("Tasa de anulación").getByText("50%")).toBeInTheDocument();
  expect(mockGet).toHaveBeenCalledWith(
    expect.stringContaining("/order-header/store/store-empty"),
    expect.objectContaining({ headers: { Authorization: "Bearer current-business-token" } }),
  );
  expect(mockGet).toHaveBeenCalledWith(
    expect.stringContaining("/order-header/store/store-web"),
    expect.objectContaining({ headers: { Authorization: "Bearer current-business-token" } }),
  );
  const channels = screen.getAllByTestId("chart-data")[0].textContent!;
  expect(channels).toContain('"shopify":300');
  expect(channels).toContain('"web":100');

  fireEvent.click(screen.getByRole("button", { name: "Septiembre" }));
  await waitFor(() => expect(metricCard("Ventas del mes").getByText("S/ 100")).toBeInTheDocument());
  expect(metricCard("Ventas del mes").getByText("1 órdenes")).toBeInTheDocument();
  expect(mockGet).toHaveBeenCalledTimes(2);
});

it("mantiene la cola histórica y el ciclo de operaciones al sumar las tiendas", async () => {
  renderMetrics(OperacionesPage);

  await waitFor(() => expect(metricCard("En Cola (sin procesar)").getByText("1")).toBeInTheDocument());
  expect(metricCard("Tiempo Ciclo Promedio").getByText("2d")).toBeInTheDocument();
  expect(metricCard("Tasa de Incidencia").getByText("33.3%")).toBeInTheDocument();
  expect(screen.getAllByTestId("chart-data")[0].textContent).toContain('"name":"Pendiente","value":1');
  expect(mockGet).toHaveBeenCalledTimes(2);
  for (const [, config] of mockGet.mock.calls) {
    expect(config?.params?.fromDate).toBeUndefined();
    expect(config?.params?.toDate).toBeUndefined();
    expect(config?.params?.includeCcLeads).toBe(true);
    expect(config?.headers).toEqual({ Authorization: "Bearer current-business-token" });
  }
});

it.each([
  ["ventas", VentasPage, "Ventas del mes", "S/ 400", "S/ 0"],
  ["operaciones", OperacionesPage, "En Cola (sin procesar)", "1", "0"],
] as const)("actualiza %s al seleccionar una tienda sin pedidos", async (_name, Page, label, businessValue, emptyValue) => {
  renderMetrics(Page);
  await waitFor(() => expect(metricCard(label).getByText(businessValue)).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "Ver tienda vacía" }));

  await waitFor(() => expect(metricCard(label).getByText(emptyValue)).toBeInTheDocument());
  expect(metricCard(label).queryByText(businessValue)).not.toBeInTheDocument();
  expect(mockGet.mock.calls.filter(([url]) => String(url).endsWith("/store/store-empty"))).toHaveLength(2);
  expect(mockGet.mock.calls.filter(([url]) => String(url).endsWith("/store/store-web"))).toHaveLength(1);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

function localOrder(id: string, created_at: string, grandTotal: string, status = "ENTREGADO") {
  return { ...orders[0], id, created_at, updated_at: created_at, grandTotal, status, guideNumber: id };
}

function octoberLocalTime(day: number, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return new Date(2026, 9, day, hour, minute, second, millisecond).toISOString();
}

it("incluye Oct1 y Oct31 completos y compara septiembre según el calendario local", async () => {
  const boundaryOrders = [
    localOrder("previous-month", octoberLocalTime(0, 23, 59, 59, 999), "10"),
    localOrder("first-day", octoberLocalTime(1), "20"),
    localOrder("last-day", octoberLocalTime(31, 23, 59, 59, 999), "30"),
    localOrder("next-month", octoberLocalTime(32), "1000"),
  ];
  mockGet.mockImplementation(async (url) => ({ data: String(url).endsWith("/store/store-web") ? boundaryOrders : [] }));
  renderMetrics(VentasPage);

  await waitFor(() => expect(metricCard("Ventas del mes").getByText("S/ 50")).toBeInTheDocument());
  expect(metricCard("Ventas del mes").getByText("2 órdenes")).toBeInTheDocument();
  expect(screen.getByText("Ingresos vs S/ 10")).toBeInTheDocument();
  expect(metricCard("Crecimiento vs mes ant.").getByText("+400%")).toBeInTheDocument();
});

it.each([
  ["ventas", VentasPage],
  ["operaciones", OperacionesPage],
] as const)("usa el día local completo para Hoy en %s", async (name, Page) => {
  const boundaryOrders = [
    localOrder("yesterday", octoberLocalTime(11, 23, 59, 59, 999), "10", "LLAMADO"),
    localOrder("start-today", octoberLocalTime(12), "20"),
    localOrder("end-today", octoberLocalTime(12, 23, 59, 59, 999), "30"),
    localOrder("tomorrow", octoberLocalTime(13), "1000", "LLAMADO"),
  ];
  mockGet.mockImplementation(async (url) => ({ data: String(url).endsWith("/store/store-web") ? boundaryOrders : [] }));
  renderMetrics(Page);
  fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

  if (name === "ventas") {
    await waitFor(() => expect(metricCard("Ventas del mes").getByText("S/ 50")).toBeInTheDocument());
    expect(metricCard("Ventas del mes").getByText("2 órdenes")).toBeInTheDocument();
    expect(screen.getByText("Ingresos vs S/ 10")).toBeInTheDocument();
  } else {
    await waitFor(() => expect(screen.getAllByTestId("chart-data")).toHaveLength(4));
    const daily = JSON.parse(screen.getAllByTestId("chart-data")[2].textContent!);
    expect(daily).toHaveLength(1);
    expect(daily[0].procesados).toBe(2);
    const weekday = JSON.parse(screen.getAllByTestId("chart-data")[3].textContent!);
    expect(weekday.reduce((sum: number, day: { resueltos: number }) => sum + day.resueltos, 0)).toBe(2);
  }
});

it.each([
  ["ventas", VentasPage, "Ventas del mes", "S/ 400"],
  ["operaciones", OperacionesPage, "En Cola (sin procesar)", "1"],
] as const)("muestra el fallo autenticado de %s y recupera los datos al reintentar", async (name, Page, label, recoveredValue) => {
  let fail = true;
  mockGet.mockImplementation(async (url) => {
    if (fail && String(url).endsWith("/store/store-web")) {
      throw { response: { status: 401 } };
    }
    return { data: String(url).endsWith("/store/store-web") ? orders : [] };
  });
  renderMetrics(Page);

  expect(await screen.findByRole("alert")).toHaveTextContent(`No se pudieron cargar las métricas de ${name}`);
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  expect(screen.queryByText("Sin datos para el periodo")).not.toBeInTheDocument();

  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

  await waitFor(() => expect(metricCard(label).getByText(recoveredValue)).toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
