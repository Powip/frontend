import { fireEvent, render, screen, within } from "@testing-library/react";

/**
 * Ventas › "Todas las Ventas" — filtro por producto + exportación.
 *
 * 1. El filtro abarca todas las órdenes cargadas, no solo la página visible.
 * 2. Se combina con el rango de fechas (cuánto salió de un producto un día).
 * 3. El filtro se mantiene al cambiar de página.
 * 4. Exportar manda solo las órdenes filtradas, con "Productos" completo.
 */

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
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
jest.mock("@/hooks/useOrdersByStore", () => ({ useOrdersByStore: jest.fn() }));
jest.mock("@/utils/exportSalesExcel", () => ({
  ...jest.requireActual("@/utils/exportSalesExcel"),
  exportSalesToExcel: jest.fn(),
}));
jest.mock("@/components/modals/CustomerServiceModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CreateGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));

import { useAuth } from "@/contexts/AuthContext";
import { useOrdersByStore } from "@/hooks/useOrdersByStore";
import { exportSalesToExcel } from "@/utils/exportSalesExcel";
import type { OrderHeader, OrderItem } from "@/interfaces/IOrder";
import VentasPage from "../page";

const mockUseAuth = jest.mocked(useAuth);
const mockUseOrdersByStore = jest.mocked(useOrdersByStore);
const mockExport = jest.mocked(exportSalesToExcel);

function item(productVariantId: string, productName: string, talla: string, quantity: number): OrderItem {
  return {
    id: `${productVariantId}-${quantity}`,
    productVariantId,
    sku: productVariantId.toUpperCase(),
    productName,
    attributes: { Talla: talla },
    quantity,
    unitPrice: "10.00",
    subtotal: String(10 * quantity),
    discountType: "NONE",
    discountAmount: "0",
    created_at: "",
    updated_at: "",
  };
}

const POLO_M = (q: number) => item("var-polo-m", "Polo", "M", q);
const POLO_L = (q: number) => item("var-polo-l", "Polo", "L", q);

function makeOrder(n: number, day: number, items: OrderItem[]): OrderHeader {
  const createdAt = `2026-09-${String(day).padStart(2, "0")}T15:00:00.000Z`;
  return {
    id: `o-${n}`,
    orderNumber: `ORD-${String(n).padStart(3, "0")}`,
    customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
    deliveryType: "DOMICILIO",
    grandTotal: "100.00",
    status: "PENDIENTE",
    salesRegion: "LIMA",
    items,
    payments: [],
    created_at: createdAt,
    updated_at: createdAt,
  } as unknown as OrderHeader;
}

// 25 órdenes (3 páginas de 10). La lista se ordena por fecha desc, así que
// ORD-025 (día 25) queda primera y ORD-001 (día 1) última, en la página 3.
// Polo L solo está en ORD-001, ORD-002, ORD-024 (página 1) y en ORD-012.
const POLO_L_ORDERS = new Set([1, 2, 12, 24]);
const ORDERS = Array.from({ length: 25 }, (_, i) => {
  const n = i + 1;
  return makeOrder(n, n, POLO_L_ORDERS.has(n) ? [POLO_L(n), POLO_M(1)] : [POLO_M(2)]);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
  mockUseOrdersByStore.mockReturnValue({
    data: ORDERS,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useOrdersByStore>);
});

async function openTodasWithFilters() {
  render(<VentasPage />);
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
  const panel = await screen.findByRole("tabpanel");
  fireEvent.click(within(panel).getByRole("button", { name: /Filtros/ }));
  return panel;
}

const visibleOrders = (panel: HTMLElement) =>
  within(panel)
    .queryAllByText(/^ORD-\d{3}$/)
    .map((el) => el.textContent);

describe("VentasPage — filtro por producto", () => {
  it("encuentra órdenes de todas las páginas y el filtro sigue al paginar", async () => {
    const panel = await openTodasWithFilters();
    expect(visibleOrders(panel)).not.toContain("ORD-001"); // sin filtro, ORD-001 está en la página 3

    fireEvent.change(within(panel).getByLabelText("Producto"), { target: { value: "var-polo-l" } });

    expect(visibleOrders(panel)).toEqual(["ORD-024", "ORD-012", "ORD-002", "ORD-001"]);
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toHaveTextContent(/Todas las Ventas\s*4$/);
  });

  it("mantiene el producto elegido al pasar de página", async () => {
    const panel = await openTodasWithFilters();
    // Polo M está en las 25 → 3 páginas
    fireEvent.change(within(panel).getByLabelText("Producto"), { target: { value: "var-polo-m" } });
    expect(visibleOrders(panel)).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "3" }));

    expect(visibleOrders(panel)).toEqual(["ORD-005", "ORD-004", "ORD-003", "ORD-002", "ORD-001"]);
    expect((within(panel).getByLabelText("Producto") as HTMLSelectElement).value).toBe("var-polo-m");
  });

  it("se combina con fecha y exporta solo ese día con los productos de cada orden", async () => {
    const panel = await openTodasWithFilters();
    fireEvent.change(within(panel).getByLabelText("Producto"), { target: { value: "var-polo-l" } });
    const [from, to] = Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(from, { target: { value: "2026-09-12" } });
    fireEvent.change(to, { target: { value: "2026-09-12" } });

    expect(visibleOrders(panel)).toEqual(["ORD-012"]);

    fireEvent.click(within(panel).getByRole("button", { name: /Exportar Excel/ }));

    expect(mockExport).toHaveBeenCalledTimes(1);
    const [rows, prefix] = mockExport.mock.calls[0];
    expect(prefix).toBe("ventas_todas_las_ventas");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderNumber: "ORD-012",
      total: 100,
      products: "Polo (L) x12; Polo (M) x1",
      filteredProductUnits: 12,
    });
  });

  it("las unidades son las del producto filtrado en cada orden; sin filtro no se agregan", async () => {
    const panel = await openTodasWithFilters();
    fireEvent.click(within(panel).getByRole("button", { name: /Exportar Excel/ }));
    expect(mockExport.mock.calls[0][0][0]).not.toHaveProperty("filteredProductUnits");

    fireEvent.change(within(panel).getByLabelText("Producto"), { target: { value: "var-polo-m" } });
    fireEvent.click(within(panel).getByRole("button", { name: /Exportar Excel/ }));

    const rows = mockExport.mock.calls[1][0];
    expect(rows).toHaveLength(25);
    const units = Object.fromEntries(rows.map((r) => [r.orderNumber, r.filteredProductUnits]));
    expect(units["ORD-012"]).toBe(1); // Polo L x12 + Polo M x1 → solo cuenta Polo M
    expect(units["ORD-003"]).toBe(2);
    expect(rows.every((r) => r.total === 100)).toBe(true);
  });
});
