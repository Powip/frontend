/**
 * Pedidos › Entregados / Anulados / Historial (ClosedTab).
 *
 * 1. mapOrderToSale conserva productVariantId/atributos (clave del filtro y texto de "Productos").
 * 2. Las pestañas de cierre avisan "Últimos 30 días" y permiten pasar a un rango propio y volver.
 * 3. Historial = entregados + anulados: chips de estado y "Con saldo pendiente" piden el filtro al servidor.
 * 4. Cada pestaña muestra la fecha en que el pedido llegó a su estado y sus columnas propias.
 * 5. Los filtros y la paginación ya no se calculan en el navegador: se piden al servidor.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { OrderHeader, OrderItem } from "@/interfaces/IOrder";
import { formatProductsForExport } from "@/utils/exportSalesExcel";
import { ClosedTab } from "../ClosedTab";
import { OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import { emptyTabState, type OperationsTabData } from "../tabState";
import { mapOrderToSale, type PedidosActions, type Sale } from "../types";

jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/useOperationsPedidos", () => ({
  ...jest.requireActual("@/hooks/useOperationsPedidos"),
  useVisibleSelection: () => ({ visibleIds: null, loading: false }),
}));

function item(productVariantId: string, productName: string, quantity: number): OrderItem {
  return {
    id: `${productVariantId}-${quantity}`, productVariantId, sku: productVariantId.toUpperCase(), productName,
    attributes: { Color: "Negro" }, quantity, unitPrice: "10.00", subtotal: String(10 * quantity),
    discountType: "NONE", discountAmount: "0", created_at: "", updated_at: "",
  };
}

function makeOrder(n: number, status: "ENTREGADO" | "ANULADO", items: OrderItem[], extra: Record<string, unknown> = {}): OrderHeader {
  const createdAt = `2026-10-${String(n).padStart(2, "0")}T15:00:00.000Z`;
  return {
    id: `o-${n}`, orderNumber: `PED-${String(n).padStart(3, "0")}`,
    customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
    deliveryType: "DOMICILIO", grandTotal: "50.00", status, salesRegion: "LIMA", items, payments: [],
    created_at: createdAt, updated_at: createdAt, ...extra,
  } as unknown as OrderHeader;
}

const ENTREGADO = mapOrderToSale(makeOrder(3, "ENTREGADO", [item("var-mochila", "Mochila", 1), item("var-taza", "Taza", 3)], {
  statusChangedAt: "2026-10-28T14:00:00.000Z", guideNumber: "G-77", courier: "Shalom",
}));
const ANULADO = mapOrderToSale(makeOrder(5, "ANULADO", [item("var-taza", "Taza", 1)], {
  statusChangedAt: "2026-10-30T09:00:00.000Z", cancellationReason: "OTHER",
}));

function makeActions(overrides: Partial<PedidosActions> = {}): PedidosActions {
  return { can: () => true, apiCouriers: [], salesChannels: [], isBulkLoading: false, onExportExcel: jest.fn(), onWhatsApp: jest.fn(), onCopySelected: jest.fn(), ...overrides } as unknown as PedidosActions;
}

function makeData(sales: Sale[], overrides: Partial<OperationsTabData> = {}): OperationsTabData {
  return {
    sales, total: sales.length, totalPages: 1, loading: false, fetching: false,
    window: { days: 30, from: "2026-10-05T05:00:00.000Z", to: null, explicit: false },
    counts: { preparados: 0, preparadosContactados: 0, preparadosNoContactados: 0, enCamino: 0, despachados: 0, entregados: 12, anulados: 4, historial: 16, atencion: 0 },
    metadata: { couriers: [], channels: [], products: [] },
    ...overrides,
  };
}

function renderTab(variant: "entregados" | "anulados" | "historial", sales: Sale[], extra: { actions?: PedidosActions; onState?: jest.Mock; state?: ReturnType<typeof emptyTabState>; data?: Partial<OperationsTabData> } = {}) {
  const onState = extra.onState ?? jest.fn();
  const state = extra.state ?? emptyTabState();
  render(
    <ClosedTab variant={variant} data={makeData(sales, extra.data)} state={state}
      query={{ tab: variant, page: 1, limit: 15, filters: state.filters }} onState={onState} actions={extra.actions ?? makeActions()} />,
    { wrapper: OrderDetailModalProvider },
  );
  return { onState };
}

describe("mapOrderToSale — ítems", () => {
  it("conserva productVariantId y atributos, que alimentan filtro y columna Productos", () => {
    expect(ENTREGADO.items[0]).toMatchObject({ productVariantId: "var-mochila", attributes: { Color: "Negro" } });
    expect(formatProductsForExport(ENTREGADO.items)).toBe("Mochila (Negro) x1; Taza (Negro) x3");
  });

  it("trae la fecha en que el pedido llegó a su estado", () => {
    expect(ENTREGADO.statusChangedAt).toBe("2026-10-28T14:00:00.000Z");
  });
});

describe("ClosedTab — ventana de 30 días", () => {
  it.each(["entregados", "anulados", "historial"] as const)("%s avisa que muestra los últimos 30 días", (variant) => {
    renderTab(variant, [ENTREGADO]);
    expect(screen.getByTestId("window-notice")).toHaveTextContent(/últimos 30 días/i);
    expect(screen.getByTestId("window-notice")).toHaveTextContent(/amplía el rango/i);
  });

  it("con un rango elegido lo muestra y ofrece volver a los últimos 30 días", () => {
    const state = { ...emptyTabState(), filters: { ...emptyTabState().filters, dateFrom: "2026-01-01", dateTo: "2026-03-31" } };
    const { onState } = renderTab("entregados", [ENTREGADO], { state, data: { window: { days: 30, from: null, to: null, explicit: true } } });

    const notice = screen.getByTestId("window-notice");
    expect(notice).toHaveTextContent("2026-01-01");
    expect(notice).toHaveTextContent("2026-03-31");
    fireEvent.click(within(notice).getByRole("button", { name: /volver a los últimos 30 días/i }));
    expect(onState).toHaveBeenCalledWith({ filters: expect.objectContaining({ dateFrom: "", dateTo: "" }) });
  });
});

describe("ClosedTab — columnas y encabezado", () => {
  it("Entregados muestra cuándo se entregó, guía · courier y liquidación", () => {
    renderTab("entregados", [ENTREGADO]);

    expect(screen.getByRole("heading", { name: "Entregados" })).toBeInTheDocument();
    expect(screen.getByTestId("tab-total-badge")).toHaveTextContent("1 pedidos");
    expect(screen.getByRole("columnheader", { name: "Entregado" })).toBeInTheDocument();
    expect(screen.getByText("G-77 · Shalom")).toBeInTheDocument();
    // Sin pagos registrados, el saldo sigue pendiente.
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Motivo" })).not.toBeInTheDocument();
  });

  it("Anulados muestra cuándo se anuló y el motivo", () => {
    renderTab("anulados", [ANULADO]);

    expect(screen.getByRole("columnheader", { name: "Anulado" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Motivo" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Liquidación" })).not.toBeInTheDocument();
  });

  it("Historial mezcla entregados y anulados con su estado y la fecha de cierre", () => {
    renderTab("historial", [ANULADO, ENTREGADO]);

    expect(screen.getByRole("columnheader", { name: "Fecha de cierre" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Estado" })).toBeInTheDocument();
    expect(screen.getByText("PED-003")).toBeInTheDocument();
    expect(screen.getByText("PED-005")).toBeInTheDocument();
    // El anulado no muestra liquidación.
    const anuladoRow = screen.getByText("PED-005").closest("tr") as HTMLElement;
    expect(within(anuladoRow).queryByText("Pendiente")).not.toBeInTheDocument();
    expect(within(anuladoRow).queryByText("Liquidado")).not.toBeInTheDocument();
  });
});

describe("ClosedTab — Historial pide los filtros al servidor", () => {
  it("los chips de estado y 'Con saldo pendiente' cambian el filtro y traen su contador", () => {
    const { onState } = renderTab("historial", [ENTREGADO]);

    expect(screen.getByRole("button", { name: "Todos (16)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entregados (12)" }));
    expect(onState).toHaveBeenLastCalledWith({ filters: expect.objectContaining({ status: "ENTREGADO" }) });
    fireEvent.click(screen.getByRole("button", { name: "Anulados (4)" }));
    expect(onState).toHaveBeenLastCalledWith({ filters: expect.objectContaining({ status: "ANULADO" }) });
    fireEvent.click(screen.getByRole("button", { name: "Con saldo pendiente" }));
    expect(onState).toHaveBeenLastCalledWith({ filters: expect.objectContaining({ hasPendingBalance: "yes" }) });
  });

  it("el filtro por producto del panel viaja al servidor en vez de filtrarse en el navegador", () => {
    const { onState } = renderTab("entregados", [ENTREGADO], {
      data: { metadata: { couriers: [], channels: [], products: [{ value: "var-mochila", label: "Mochila" }] } },
    });

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "var-mochila" } });

    expect(onState).toHaveBeenCalledWith({ filters: expect.objectContaining({ product: "var-mochila" }) });
  });

  it("pagina en servidor: la página elegida se pide con onState", () => {
    const { onState } = renderTab("entregados", [ENTREGADO], { data: { total: 45, totalPages: 3 } });

    expect(screen.getByText(/mostrando 1 – 15 de 45 pedidos/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    expect(onState).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("sin datos muestra un mensaje del período y no una tabla vacía", () => {
    renderTab("entregados", []);
    expect(screen.getByText(/sin pedidos entregados en este período/i)).toBeInTheDocument();
  });
});
