import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AlertsTab from "../AlertsTab";
import { InventoryAlertsBadge } from "../InventoryAlertsBadge";
import { getInventoryAlerts, type InventoryAlerts } from "@/services/inventoryReportsService";
import { resolveOrderNumbers } from "@/services/orderNumbersService";

// FEAT-24 H10-D8 — Alertas: contador, lista por tipo y enlace a la pantalla que la resuelve.

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", company: { id: "c1" }, user: { id: "u1", role: "VENTAS" } } }) }));
jest.mock("@/services/inventoryReportsService", () => ({ getInventoryAlerts: jest.fn() }));
jest.mock("@/services/orderNumbersService", () => ({ resolveOrderNumbers: jest.fn() }));
jest.mock("@/hooks/useCompanyWarehouses", () => ({ useCompanyWarehouses: () => ({ warehouses: [], nameOf: (id: string) => ({ w1: "Central", w2: "Olva" })[id] ?? "su almacén" }) }));

const DATA: InventoryAlerts = {
  generatedAt: "2026-11-18T15:00:00Z",
  total: 4,
  alerts: [
    { type: "bajo_minimo", enabled: true, count: 1, items: [{ inventoryId: "w1", inventoryName: "Central", variantId: "v1", physical: 0, reserved: 0, available: 0, minStock: 5, outOfStock: true, productName: "Polo", sku: "POL-M", attributes: { Talla: "M" } }] },
    { type: "sin_stock_con_pedidos", enabled: true, count: 1, items: [{ orderId: "o1", inventoryId: "w2", since: null, ageDays: 2, lines: [{ variantId: "v1", quantity: 1 }] }] },
    { type: "sku_por_vincular", enabled: true, count: 2, items: [] },
    { type: "lotes_por_vencer", enabled: false, dependsOn: "H5", count: 0, items: [] },
  ],
};

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getInventoryAlerts).mockResolvedValue(DATA);
  jest.mocked(resolveOrderNumbers).mockResolvedValue({ o1: "ORD-150300" });
});

it("lista cada alerta con su tipo, detalle y el enlace que la resuelve", async () => {
  renderWith(<AlertsTab />);
  const items = await screen.findAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByText("Agotado")).toBeInTheDocument();
  expect(within(items[0]).getByRole("link", { name: "Crear compra" })).toHaveAttribute("href", "/compras");
  expect(await within(items[1]).findByText("ORD-150300 en Olva espera 1 und hace 2 días.")).toBeInTheDocument();
  expect(within(items[1]).getByRole("link", { name: "Gestionar" })).toHaveAttribute("href", "/inventario/pedidos-sin-stock");
  expect(within(items[2]).getByRole("link", { name: "Vincular" })).toHaveAttribute("href", "/inventario/unificacion");
  expect(screen.getByText("4 alertas")).toBeInTheDocument();
  expect(screen.getByText("SKU por vincular: 2")).toBeInTheDocument();
  expect(screen.getByText(/Llegan con próximas versiones: Lotes por vencer/)).toBeInTheDocument();
  expect(getInventoryAlerts).toHaveBeenCalledWith(20, expect.anything());
  expect(resolveOrderNumbers).toHaveBeenCalledWith(["o1"]);
});

it("sin alertas lo dice", async () => {
  jest.mocked(getInventoryAlerts).mockResolvedValue({ generatedAt: "2026-11-18T15:00:00Z", total: 0, alerts: [] });
  renderWith(<AlertsTab />);
  expect(await screen.findByText("No hay alertas. Todo en orden.")).toBeInTheDocument();
});

it("el contador del menú muestra el total y se oculta en cero", async () => {
  const { unmount } = renderWith(<InventoryAlertsBadge />);
  expect(await screen.findByLabelText("4 alertas de inventario")).toHaveTextContent("4");
  unmount();
  jest.mocked(getInventoryAlerts).mockResolvedValue({ generatedAt: "", total: 0, alerts: [] });
  const { container } = renderWith(<InventoryAlertsBadge />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(container).toBeEmptyDOMElement();
});
