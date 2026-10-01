import { fireEvent, render, screen } from "@testing-library/react";
import type { OrderHeader, OrderItem } from "@/interfaces/IOrder";
import { formatProductsForExport } from "@/utils/exportSalesExcel";
import { HistorialTab } from "../HistorialTab";
import { mapOrderToSale, type PedidosActions } from "../types";

/**
 * Pedidos › Historial — filtro por producto + lo que se exporta.
 *
 * 1. mapOrderToSale conserva productVariantId/atributos (clave del filtro y texto de "Productos").
 * 2. El filtro abarca todos los pedidos de la pestaña, no solo la página de 15.
 * 3. Se combina con fecha y se mantiene al paginar.
 * 4. "Exportar Excel" recibe exactamente los pedidos filtrados.
 */

function item(productVariantId: string, productName: string, quantity: number): OrderItem {
  return {
    id: `${productVariantId}-${quantity}`,
    productVariantId,
    sku: productVariantId.toUpperCase(),
    productName,
    attributes: { Color: "Negro" },
    quantity,
    unitPrice: "10.00",
    subtotal: String(10 * quantity),
    discountType: "NONE",
    discountAmount: "0",
    created_at: "",
    updated_at: "",
  };
}

function makeOrder(n: number, day: number, items: OrderItem[]): OrderHeader {
  const createdAt = `2026-09-${String(day).padStart(2, "0")}T15:00:00.000Z`;
  return {
    id: `o-${n}`,
    orderNumber: `PED-${String(n).padStart(3, "0")}`,
    customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
    deliveryType: "DOMICILIO",
    grandTotal: "50.00",
    status: "ENTREGADO",
    salesRegion: "LIMA",
    items,
    payments: [],
    created_at: createdAt,
    updated_at: createdAt,
  } as unknown as OrderHeader;
}

// 20 pedidos (2 páginas de 15). Mochila en 3, 10 y 18 — el 18 queda en la página 2.
const MOCHILA_IN = new Set([3, 10, 18]);
const SALES = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return mapOrderToSale(
    makeOrder(n, n, MOCHILA_IN.has(n) ? [item("var-mochila", "Mochila", 1), item("var-taza", "Taza", 3)] : [item("var-taza", "Taza", 1)]),
  );
});

function makeActions(onExportExcel = jest.fn()): PedidosActions {
  return {
    can: () => true,
    apiCouriers: [],
    salesChannels: [],
    isBulkLoading: false,
    onExportExcel,
    onView: jest.fn(),
  } as unknown as PedidosActions;
}

function renderTab(onExportExcel = jest.fn()) {
  render(<HistorialTab sales={SALES} actions={makeActions(onExportExcel)} />);
  fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
  return onExportExcel;
}

const visibleOrders = () => screen.queryAllByText(/^PED-\d{3}$/).map((el) => el.textContent);

describe("mapOrderToSale — ítems", () => {
  it("conserva productVariantId y atributos, que alimentan filtro y columna Productos", () => {
    const sale = SALES[2];
    expect(sale.items[0]).toMatchObject({ productVariantId: "var-mochila", attributes: { Color: "Negro" } });
    expect(formatProductsForExport(sale.items)).toBe("Mochila (Negro) x1; Taza (Negro) x3");
  });
});

describe("HistorialTab — filtro por producto", () => {
  it("encuentra pedidos fuera de la primera página", () => {
    renderTab();
    expect(visibleOrders()).not.toContain("PED-018");

    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "var-mochila" } });

    expect(visibleOrders()).toEqual(["PED-003", "PED-010", "PED-018"]);
  });

  it("se mantiene al paginar", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "var-taza" } });
    fireEvent.click(screen.getByRole("button", { name: "2" }));

    expect(visibleOrders()).toEqual(["PED-016", "PED-017", "PED-018", "PED-019", "PED-020"]);
    expect((screen.getByLabelText("Producto") as HTMLSelectElement).value).toBe("var-taza");
  });

  it("combinado con fecha, exporta solo los pedidos filtrados", () => {
    const onExport = renderTab();
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "var-mochila" } });
    const [from, to] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(from, { target: { value: "2026-09-10" } });
    fireEvent.change(to, { target: { value: "2026-09-20" } });

    expect(visibleOrders()).toEqual(["PED-010", "PED-018"]);

    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const [exported, tab, product] = onExport.mock.calls[0];
    expect(tab).toBe("historial");
    expect(product).toBe("var-mochila");
    expect(exported.map((s: { orderNumber: string }) => s.orderNumber)).toEqual(["PED-010", "PED-018"]);
  });
});

