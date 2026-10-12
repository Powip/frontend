import React, { type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axiosAuth from "@/lib/axiosAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import { Analysis } from "../analysis";
import { Geography } from "../geography";
import { FinanceStats } from "../FinanceStats";
import { TeamManagement } from "../TeamManagement";
import { PaymentDetailsModal } from "../PaymentDetailsModal";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/DashboardScopeContext", () => ({ useDashboardScope: jest.fn() }));
jest.mock("@/lib/excel", () => ({ exportToExcel: jest.fn() }));
jest.mock("xlsx", () => ({ utils: {}, writeFile: jest.fn() }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

jest.mock("../DashboardCard", () => ({
  DashboardCard: ({ title, data }: { title: string; data?: unknown }) => (
    <section><h3>{title}</h3><pre data-testid={title}>{JSON.stringify(data)}</pre></section>
  ),
}));

jest.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) => open ? <div>{children}</div> : null,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    DialogTrigger: Container,
  };
});

jest.mock("@/components/ui/select", () => {
  const Element = () => null;
  return {
    Select: ({ onValueChange }: { onValueChange: (value: string) => void }) => (
      <button onClick={() => onValueChange("PAID")}>Mostrar pagados</button>
    ),
    SelectContent: Element,
    SelectItem: Element,
    SelectTrigger: Element,
    SelectValue: Element,
  };
});

jest.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Element = () => null;
  return {
    BarChart: Container, LineChart: Container, AreaChart: Container,
    PieChart: Container, ComposedChart: Container, ResponsiveContainer: Container,
    Bar: Element, Line: Element, Area: Element, Pie: Element, XAxis: Element,
    YAxis: Element, CartesianGrid: Element, Tooltip: Element, Legend: Element, Cell: Element,
  };
});

const mockGet = jest.mocked(axiosAuth.get);
const mockUseAuth = jest.mocked(useAuth);
const mockUseScope = jest.mocked(useDashboardScope);
const RANGE = { fromDate: "2026-10-01", toDate: "2026-10-31" };
let scope: ReturnType<typeof useDashboardScope>;
let auth: ReturnType<typeof useAuth>;

function dataFor(url: string, storeId?: string) {
  if (url.endsWith("/by-channel")) return { salesChannels: [], closingChannels: [] };
  if (url.endsWith("/inventory-value")) return { totalValue: storeId === "store-a" ? 100 : 250 };
  if (url.endsWith("/receivables")) return { pendingTotal: 75, limaCount: 1, provinciaCount: 0, avgTicket: 75, pendingOrders: [] };
  if (url.endsWith("/summary")) return { deliveredAmount: 1200, totalDelivered: 6, dailySales: [], byStatus: {} };
  if (url.endsWith("/by-seller")) return [
    { sellerId: "owner", sellerName: "Ana", ordersCount: 10, productsCount: 15, totalAmount: 1200, monthlySales: 900, weeklySales: 150 },
    { sellerId: "SIN_VENDEDOR", sellerName: "Sin Vendedor", ordersCount: 2, productsCount: 2, totalAmount: 100, monthlySales: 100, weeklySales: 0 },
  ];
  if (url.endsWith("/delivery-by-seller")) return [
    { sellerId: "owner", createdCount: 10, deliveredCount: 6 },
    { sellerId: "SIN_VENDEDOR", createdCount: 2, deliveredCount: 1 },
  ];
  return [];
}

beforeEach(() => {
  jest.clearAllMocks();
  scope = {
    scope: "business", setScope: jest.fn(), storeIds: ["store-a", "store-b"],
    scopeParams: { storeIds: "store-a,store-b" }, canFetch: true, canViewBusiness: true, scopeKey: "business:store-a,store-b",
  };
  auth = {
    auth: {
      accessToken: "test-token",
      user: { id: "owner", email: "owner@example.com", role: "ADMINISTRADOR", permissions: [] },
      company: { id: "company", name: "Negocio", stores: [{ id: "store-a", name: "A" }, { id: "store-b", name: "B" }] },
      subscription: null, exp: 9999999999,
    },
    selectedStoreId: "store-a", loading: false, login: jest.fn(), logout: jest.fn(),
    setSelectedStore: jest.fn(), updateCompany: jest.fn(), inventories: [],
    refreshInventories: jest.fn(), hasPermission: jest.fn(),
    refreshSubscription: jest.fn(), refreshSession: jest.fn(),
  };
  mockUseAuth.mockImplementation(() => auth);
  mockUseScope.mockImplementation(() => scope);
  mockGet.mockImplementation(async (url, config) => ({
    data: dataFor(String(url), config?.params?.storeId),
  }));
});

it.each([
  ["análisis", Analysis, 3],
  ["geografía", Geography, 5],
  ["finanzas", FinanceStats, 6],
  ["equipo", TeamManagement, 2],
] as const)("consulta todas las tiendas y luego la tienda elegida en %s", async (_name, Panel, count) => {
  const view = render(<Panel key="business" {...RANGE} />);
  await act(async () => {});
  expect(mockGet).toHaveBeenCalledTimes(count);
  for (const [url, config] of mockGet.mock.calls) {
    if (String(url).endsWith("/inventory-value")) {
      expect(scope.storeIds).toContain(config?.params?.storeId);
    } else {
      expect(config?.params).toEqual(expect.objectContaining({ storeIds: "store-a,store-b" }));
      expect(config?.params).not.toHaveProperty("storeId");
      expect(config?.params).not.toHaveProperty("sellerId");
    }
  }

  mockGet.mockClear();
  scope = { ...scope, scope: "store", storeIds: ["store-a"], scopeParams: { storeId: "store-a" } };
  view.rerender(<Panel key="store" {...RANGE} />);
  await act(async () => {});

  expect(mockGet).toHaveBeenCalledTimes(Panel === FinanceStats ? 5 : count);
  for (const [, config] of mockGet.mock.calls) {
    expect(config?.params).toEqual(expect.objectContaining({ storeId: "store-a" }));
    expect(config?.params).not.toHaveProperty("storeIds");
  }
});

it("suma los activos de las tiendas y consulta los pagos con el mismo alcance", async () => {
  render(<FinanceStats {...RANGE} />);
  await act(async () => {});
  const inventoryCard = screen.getByText("Valor Almacén").closest('[data-slot="card"]') as HTMLElement;
  expect(within(inventoryCard).getByText("S/ 350.00")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Pagos Aprobados"));
  await act(async () => {});
  expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("/stats/payment-details"), expect.objectContaining({
    params: { storeIds: "store-a,store-b", ...RANGE, status: "ALL" },
  }));
});

it("cuenta una vez el almacén compartido entre KUNCA y su tienda Shopify", async () => {
  // inventory-value filtra por la tienda propietaria del almacén. La tienda
  // Shopify referencia el mismo inventory_id, pero no es una segunda propietaria.
  mockGet.mockImplementation(async (url, config) => ({
    data: String(url).endsWith("/inventory-value")
      ? { totalValue: config?.params?.storeId === "store-a" ? 200 : 0 }
      : dataFor(String(url), config?.params?.storeId),
  }));

  render(<FinanceStats {...RANGE} />);
  await act(async () => {});

  const inventoryCard = screen.getByText("Valor Almacén").closest('[data-slot="card"]') as HTMLElement;
  expect(within(inventoryCard).getByText("S/ 200.00")).toBeInTheDocument();
  const inventoryRequests = mockGet.mock.calls.filter(([url]) => String(url).endsWith("/inventory-value"));
  expect(inventoryRequests.map(([, config]) => config?.params?.storeId)).toEqual(["store-a", "store-b"]);
});

it("adapta vendedores y entregas del negocio al modelo del equipo", async () => {
  render(<TeamManagement {...RANGE} />);
  await act(async () => {});
  expect(screen.getByText("7/12 entregados")).toBeInTheDocument();
  const chart = JSON.parse(screen.getByTestId("Ventas por Colaborador").textContent || "[]");
  expect(chart).toEqual(expect.arrayContaining([
    expect.objectContaining({ sellerId: "owner", totalSales: 1200, orderCount: 10, productsCount: 15, averageTicket: 120, monthlySales: 900, weeklySales: 150, deliveryEffectiveness: 60 }),
    expect.objectContaining({ sellerId: "unassigned", orderCount: 2, deliveredCount: 1 }),
  ]));
});

it.each([Analysis, Geography, FinanceStats])("evita limitar a un superadministrador por vendedor", async (Panel) => {
  auth.auth!.user = { ...auth.auth!.user, role: "VENTAS", email: "joel@aranni.com.pe" };
  render(<Panel {...RANGE} />);
  await act(async () => {});
  for (const [, config] of mockGet.mock.calls) expect(config?.params).not.toHaveProperty("sellerId");
});

it.each([
  [FinanceStats, "/stats/receivables", "datos financieros"],
  [TeamManagement, "/stats/delivery-by-seller", "datos del equipo"],
] as const)("muestra una falla parcial sin fabricar métricas cero", async (Panel, endpoint, message) => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  mockGet.mockImplementation(async (url, config) => {
    if (String(url).endsWith(endpoint)) throw new Error("Servicio no disponible");
    return { data: dataFor(String(url), config?.params?.storeId) };
  });
  render(<Panel {...RANGE} />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
  consoleError.mockRestore();
});

it("descarta una respuesta de pagos anterior al cambiar alcance o filtro", async () => {
  let resolveOld!: (value: { data: unknown[] }) => void;
  mockGet.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<PaymentDetailsModal open onOpenChange={jest.fn()} {...RANGE} />);
  const firstSignal = mockGet.mock.calls[0][1]?.signal;

  scope = { ...scope, scope: "store", storeIds: ["store-a"], scopeParams: { storeId: "store-a" } };
  view.rerender(<PaymentDetailsModal open onOpenChange={jest.fn()} {...RANGE} />);
  await act(async () => {});
  expect(firstSignal?.aborted).toBe(true);
  expect(mockGet).toHaveBeenLastCalledWith(expect.stringContaining("/stats/payment-details"), expect.objectContaining({
    params: { storeId: "store-a", ...RANGE, status: "ALL" },
  }));

  fireEvent.click(screen.getByRole("button", { name: "Mostrar pagados" }));
  await act(async () => {});
  expect(mockGet).toHaveBeenLastCalledWith(expect.stringContaining("/stats/payment-details"), expect.objectContaining({
    params: { storeId: "store-a", ...RANGE, status: "PAID" },
  }));

  await act(async () => resolveOld({ data: [{ id: "old", orderNumber: "ORDEN-ANTERIOR", amount: 100, status: "PAID" }] }));
  expect(screen.queryByText("ORDEN-ANTERIOR")).not.toBeInTheDocument();
  expect(screen.getByText(/No se encontraron pagos/)).toBeInTheDocument();
});
