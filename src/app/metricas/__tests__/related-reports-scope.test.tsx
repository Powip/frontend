import React, { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardScopeProvider, useDashboardScope } from "@/contexts/DashboardScopeContext";
import AtencionPage from "../atencion-cliente/page";
import CallCenterPage from "../call-center/page";
import ClientesPage from "../clientes/page";
import SeguimientosPage from "../seguimientos/page";
import CouriersPage from "../couriers/page";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/dashboard/PeriodSelector", () => ({
  PeriodSelector: ({ onPeriodChange }: { onPeriodChange: (from: string, to: string) => void }) => (
    <button onClick={() => onPeriodChange("2026-10-01", "2026-10-31")}>Octubre</button>
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
const orderBase = {
  currency: "PEN",
  storeId: "store-web", created_at: "2026-10-10T12:00:00.000Z", updated_at: "2026-10-12T12:00:00.000Z",
  salesChannel: "SHOPIFY", sellerId: "agent-a", sellerName: "Ana", courier: "Courier A",
  notes: "", cancellationReason: null, logs: [],
};
const orders = [
  {
    ...orderBase, id: "lead", status: "PREPARADO", grandTotal: "50",
    customer: { documentNumber: "customer-a" }, items: [{ productName: "Principal", quantity: 1, subtotal: "50" }],
  },
  {
    ...orderBase, id: "delivered", status: "ENTREGADO", grandTotal: "300",
    customer: { documentNumber: "customer-a" },
    items: [{ productName: "Principal", quantity: 1, subtotal: "250" }, { productName: "Accesorio", quantity: 1, subtotal: "50" }],
  },
  {
    ...orderBase, id: "cancelled", status: "ANULADO", grandTotal: "100", cancellationReason: "Sin respuesta",
    customer: { documentNumber: "customer-b" }, items: [{ productName: "Principal", quantity: 1, subtotal: "100" }],
  },
];
const guideBase = {
  storeId: "store-web", courierId: "courier-a", courierName: "Courier A", deliveryType: "DELIVERY",
  created_at: "2026-10-10T12:00:00.000Z", updated_at: "2026-10-12T12:00:00.000Z",
};
const guides = [
  { ...guideBase, id: "guide-delivered", guideNumber: "guide-1", orderIds: ["delivered"], status: "ENTREGADA", amountToCollect: 20 },
  { ...guideBase, id: "guide-failed", guideNumber: "guide-2", orderIds: ["cancelled"], status: "FALLIDA", amountToCollect: 40 },
];
const couriers = [{ id: "courier-a", name: "Courier A", companyId: "business-kunca", isActive: true }];

function dataFor(url: string) {
  if (url.includes("/couriers/company/business-kunca")) return couriers;
  if (url.includes("/shipping-guides/store/store-web")) return guides;
  if (url.includes("/order-header/store/store-web")) return orders;
  return [];
}

function ScopeControls() {
  const { setScope } = useDashboardScope();
  return <button onClick={() => setScope("store")}>Ver tienda vacía</button>;
}

function renderMetrics(Page: React.ComponentType) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardScopeProvider><ScopeControls /><Page /></DashboardScopeProvider>
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
      company: { id: "business-kunca", name: "Kunca", stores: [{ id: "store-empty", name: "KUNCA" }, { id: "store-web", name: "Kunca COD - web" }] },
      subscription: null, exp: 9999999999,
    },
    selectedStoreId: "store-empty", loading: false,
    login: jest.fn(), logout: jest.fn(), setSelectedStore: jest.fn(), updateCompany: jest.fn(),
    inventories: [], refreshInventories: jest.fn(), hasPermission: jest.fn(), refreshSession: jest.fn(), refreshSubscription: jest.fn(),
  });
  mockGet.mockImplementation(async (url) => ({ data: dataFor(String(url)) }));
});

const REPORTS = [
  ["atención al cliente", AtencionPage, "Pedidos por Gestionar", "1", "0"],
  ["call center", CallCenterPage, "Contact Rate", "67%", "0%"],
  ["clientes", ClientesPage, "Total Clientes", "2", "0"],
  ["seguimientos", SeguimientosPage, "Entrega 1er Intento", "50%", "0%"],
  ["couriers", CouriersPage, "Envíos del Mes", "2", "0"],
] as const;

it.each(REPORTS)("carga %s de todo el negocio y permite seleccionar la tienda vacía", async (_name, Page, label, businessValue, emptyValue) => {
  renderMetrics(Page);
  await waitFor(() => expect(metricCard(label).getByText(businessValue)).toBeInTheDocument());
  for (const [url, config] of mockGet.mock.calls) {
    expect(config?.headers).toEqual({ Authorization: "Bearer current-business-token" });
    expect(config?.signal).toBeInstanceOf(AbortSignal);
    if (String(url).includes("/order-header/store/")) expect(config?.params?.includeCcLeads).toBe(true);
  }

  fireEvent.click(screen.getByRole("button", { name: "Ver tienda vacía" }));

  await waitFor(() => expect(metricCard(label).getByText(emptyValue)).toBeInTheDocument());
  expect(metricCard(label).queryByText(businessValue)).not.toBeInTheDocument();
  expect(mockGet.mock.calls.filter(([url]) => String(url).includes("/order-header/store/store-empty"))).toHaveLength(2);
  expect(mockGet.mock.calls.filter(([url]) => String(url).includes("/order-header/store/store-web"))).toHaveLength(1);
  if (Page === SeguimientosPage || Page === CouriersPage) {
    expect(mockGet.mock.calls.filter(([url]) => String(url).includes("/shipping-guides/store/store-empty"))).toHaveLength(2);
    expect(mockGet.mock.calls.filter(([url]) => String(url).includes("/shipping-guides/store/store-web"))).toHaveLength(1);
  }
  if (Page === CouriersPage) {
    expect(mockGet.mock.calls.filter(([url]) => String(url).includes("/couriers/company/business-kunca"))).toHaveLength(1);
  }
});

it.each(REPORTS)("muestra un fallo autenticado de %s y recupera los datos al reintentar", async (_name, Page, label, businessValue) => {
  let fail = true;
  mockGet.mockImplementation(async (url) => {
    if (fail && String(url).includes("/order-header/store/store-web")) throw { response: { status: 401 } };
    return { data: dataFor(String(url)) };
  });
  renderMetrics(Page);

  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar los datos de este reporte");
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

  await waitFor(() => expect(metricCard(label).getByText(businessValue)).toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each([
  ["guías", SeguimientosPage, "/shipping-guides/store/store-web", "Entrega 1er Intento", "50%"],
  ["couriers", CouriersPage, "/couriers/company/business-kunca", "Envíos del Mes", "2"],
] as const)("no presenta métricas completas si falla la consulta independiente de %s", async (_name, Page, failedPath, label, businessValue) => {
  let fail = true;
  mockGet.mockImplementation(async (url) => {
    if (fail && String(url).includes(failedPath)) throw new Error("Unavailable");
    return { data: dataFor(String(url)) };
  });
  renderMetrics(Page);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText(label)).not.toBeInTheDocument();

  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(metricCard(label).getByText(businessValue)).toBeInTheDocument());
});

it("cuenta una guía compartida por su id una sola vez en el resumen del negocio", async () => {
  mockGet.mockImplementation(async (url) => ({
    data: String(url).includes("/shipping-guides/store/store-empty") ? [guides[0]] : dataFor(String(url)),
  }));
  renderMetrics(CouriersPage);
  await waitFor(() => expect(metricCard("Envíos del Mes").getByText("2")).toBeInTheDocument());
  expect(metricCard("Tasa Entrega Global").getByText("50%")).toBeInTheDocument();
  expect(metricCard("Costo Promedio Envío").getByText("S/ 30.00")).toBeInTheDocument();
});
