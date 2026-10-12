import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardScope } from "@/contexts/DashboardScopeContext";
import {
  fetchInventoryMetrics,
  type InventoryMetricItem,
} from "@/services/inventoryMetricsService";
import InventoryPage from "../inventario/page";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/DashboardScopeContext", () => ({ useDashboardScope: jest.fn() }));
jest.mock("@/services/inventoryMetricsService", () => ({
  ...jest.requireActual("@/services/inventoryMetricsService"),
  fetchInventoryMetrics: jest.fn(),
}));
jest.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Chart,
    PieChart: Chart,
    Pie: Chart,
    Cell: () => null,
    Tooltip: () => null,
  };
});

const fetchMetrics = jest.mocked(fetchInventoryMetrics);
const stock: InventoryMetricItem[] = [
  {
    inventoryItemId: "item-a",
    inventoryId: "warehouse-a",
    variantId: "variant-a",
    productId: "product-a",
    productName: "Producto A",
    sku: "SKU-A",
    availableStock: 4,
    physicalStock: 5,
  },
  {
    inventoryItemId: "item-b",
    inventoryId: "warehouse-b",
    variantId: "variant-a",
    productId: "product-a",
    productName: "Producto A",
    sku: "SKU-A",
    availableStock: 6,
    physicalStock: 8,
  },
  {
    inventoryItemId: "item-c",
    inventoryId: "warehouse-b",
    variantId: "variant-b",
    productId: "product-b",
    productName: "Producto B",
    sku: "SKU-B",
    availableStock: 2,
    physicalStock: 3,
  },
];
function setAuth(companyId = "company-a", userId = "user-a") {
  jest.mocked(useAuth).mockReturnValue({
    auth: { company: { id: companyId }, user: { id: userId }, accessToken: "test-token" },
    loading: false,
  } as ReturnType<typeof useAuth>);
}
function setScope(scope: "business" | "store" = "business", storeIds = ["store-a", "store-b"]) {
  jest.mocked(useDashboardScope).mockReturnValue({
    scope,
    storeIds,
    canFetch: true,
    canViewBusiness: true,
    scopeKey: JSON.stringify([scope, storeIds]),
    setScope: jest.fn(),
    scopeParams: scope === "business" ? { storeIds: storeIds.join(",") } : { storeId: storeIds[0] },
  });
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = () => (
    <QueryClientProvider client={client}>
      <InventoryPage />
    </QueryClientProvider>
  );
  return { ...render(view()), view, client };
}

describe("Inventory metrics page scope and errors", () => {
  beforeEach(() => {
    fetchMetrics.mockReset();
    setAuth();
    setScope();
  });

  it("shows positive stock across company warehouses and distinct products without duplicating a shared variant", async () => {
    fetchMetrics.mockResolvedValue(stock);
    setup();
    expect(
      await screen.findByText("12 unidades disponibles · 16 unidades físicas"),
    ).toBeInTheDocument();
    expect(screen.getByText("Total Productos").nextElementSibling).toHaveTextContent("2");
    expect(fetchMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-a",
        accessToken: "test-token",
        scope: "business",
        storeIds: ["store-a", "store-b"],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      screen.queryByText("No hay productos de inventario en este alcance."),
    ).not.toBeInTheDocument();
  });

  it("shows loading placeholders while stock is pending instead of zero totals", () => {
    fetchMetrics.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando inventario...");
    expect(screen.getByText("Total Productos").nextElementSibling).toHaveTextContent("—");
    expect(
      screen.queryByText("No hay productos de inventario en este alcance."),
    ).not.toBeInTheDocument();
  });

  it("shows an authorization failure with retry, then displays the recovered inventory", async () => {
    fetchMetrics
      .mockRejectedValueOnce(
        Object.assign(new Error("Unauthorized"), { response: { status: 401 } }),
      )
      .mockResolvedValueOnce(stock);
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el inventario.");
    expect(screen.queryByText("Total Productos")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay productos de inventario en este alcance."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("12 unidades disponibles · 16 unidades físicas"),
    ).toBeInTheDocument();
    expect(fetchMetrics).toHaveBeenCalledTimes(2);
  });

  it("refetches for a selected store and a different user or business instead of sharing cached company totals", async () => {
    fetchMetrics
      .mockResolvedValueOnce(stock)
      .mockResolvedValueOnce([stock[0]])
      .mockResolvedValueOnce([stock[2]]);
    const { rerender, view } = setup();
    await screen.findByText("12 unidades disponibles · 16 unidades físicas");
    setScope("store", ["store-a"]);
    rerender(view());
    await screen.findByText("4 unidades disponibles · 5 unidades físicas");
    setAuth("company-b", "user-b");
    setScope("store", ["store-c"]);
    rerender(view());
    await screen.findByText("2 unidades disponibles · 3 unidades físicas");
    expect(
      fetchMetrics.mock.calls.map(([input]) => [input.companyId, input.scope, input.storeIds]),
    ).toEqual([
      ["company-a", "business", ["store-a", "store-b"]],
      ["company-a", "store", ["store-a"]],
      ["company-b", "store", ["store-c"]],
    ]);
    await waitFor(() =>
      expect(
        screen.queryByText("12 unidades disponibles · 16 unidades físicas"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows an explicit empty result after a successful inventory load", async () => {
    fetchMetrics.mockResolvedValue([]);
    setup();
    expect(
      await screen.findByText("No hay productos de inventario en este alcance."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
