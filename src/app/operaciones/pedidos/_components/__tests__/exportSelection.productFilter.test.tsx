/**
 * Por Despachar / En Camino — exportar seleccionados con filtros activos.
 *
 * 1. La selección persiste al cambiar filtros (sigue disponible para acciones masivas).
 * 2. "Exportar Excel" solo manda los seleccionados que cumplen los filtros actuales.
 * 3. Se avisa cuántos seleccionados quedan ocultos por los filtros; el aviso se va al limpiar.
 * 4. Con filtro por producto se pasa su clave para la columna de unidades.
 * 5. buildPedidosExportRows suma las unidades del producto por pedido sin tocar Total ni Productos.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));

import { PorDespacharTab } from "../PorDespacharTab";
import { EnCaminoTab } from "../EnCaminoTab";
import { buildPedidosExportRows, type PedidosActions, type Sale, type SaleItem } from "../types";
import type { OrderStatus } from "@/interfaces/IOrder";

function item(productVariantId: string, productName: string, quantity: number): SaleItem {
  return { productVariantId, productName, sku: productVariantId.toUpperCase(), attributes: {}, quantity, subtotal: 10 * quantity };
}

const CAFE = (q: number) => item("var-cafe", "Café", q);
const TE = (q: number) => item("var-te", "Té", q);

function makeSale(n: number, status: OrderStatus, date: string, items: SaleItem[]): Sale {
  const now = new Date().toISOString();
  return {
    id: `s-${n}`,
    customerId: `c-${n}`,
    orderNumber: `PED-${n}`,
    clientName: `Cliente ${n}`,
    phoneNumber: "999111222",
    date,
    total: 100 + n,
    status,
    paymentMethod: "EFECTIVO",
    deliveryType: "DOMICILIO",
    salesRegion: "LIMA",
    district: "Miraflores",
    address: "Av. Test 123",
    advancePayment: 0,
    pendingPayment: 0,
    notes: "",
    guideNumber: null,
    hasPendingApprovalPayments: false,
    sellerName: null,
    courier: "Olva",
    createdAt: now,
    updatedAt: now,
    callbackAt: null,
    items,
  };
}

function makeActions(onExportExcel = jest.fn()): PedidosActions {
  const noop = jest.fn();
  return new Proxy(
    { can: () => true, apiCouriers: [], salesChannels: [], isBulkLoading: false, onExportExcel },
    { get: (target, prop) => (prop in target ? target[prop as keyof typeof target] : noop) },
  ) as unknown as PedidosActions;
}

const exportButton = () => screen.getByRole("button", { name: /Exportar Excel \(/ });
const hiddenNotice = () => screen.queryByRole("status");

function selectAllOnPage() {
  // El primero es el "seleccionar todo" de la cabecera.
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
}

function openFilters() {
  fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
}

function chooseProduct(value: string) {
  fireEvent.change(screen.getByLabelText("Producto"), { target: { value } });
}

describe.each([
  { name: "PorDespacharTab", Tab: PorDespacharTab, status: "PREPARADO" as OrderStatus, tabKey: "por_despachar" },
  { name: "EnCaminoTab", Tab: EnCaminoTab, status: "EN_ENVIO" as OrderStatus, tabKey: "en_camino" },
])("$name — exportar seleccionados", ({ Tab, status, tabKey }) => {
  const SALES = [
    makeSale(1, status, "01/09/2026", [CAFE(2), TE(1)]),
    makeSale(2, status, "02/09/2026", [TE(4)]),
    makeSale(3, status, "02/09/2026", [CAFE(1), CAFE(3)]),
  ];

  function setup() {
    const onExportExcel = jest.fn();
    render(<Tab sales={SALES} actions={makeActions(onExportExcel)} />);
    selectAllOnPage();
    openFilters();
    return onExportExcel;
  }

  it("sin filtros exporta toda la selección y no muestra aviso", () => {
    const onExport = setup();
    expect(hiddenNotice()).not.toBeInTheDocument();

    fireEvent.click(exportButton());

    const [rows, tab, product] = onExport.mock.calls[0];
    expect(rows.map((s: Sale) => s.id)).toEqual(["s-1", "s-2", "s-3"]);
    expect(tab).toBe(tabKey);
    expect(product).toBe("");
  });

  it("con filtro por producto exporta solo lo visible, avisa lo oculto y conserva la selección", () => {
    const onExport = setup();
    chooseProduct("var-cafe");

    expect(screen.getByText(/3 seleccionados/)).toBeInTheDocument();
    expect(hiddenNotice()).toHaveTextContent("1 seleccionado(s) oculto(s) por los filtros — no se exportan");
    expect(exportButton()).toHaveTextContent("Exportar Excel (2)");

    fireEvent.click(exportButton());
    const [rows, , product] = onExport.mock.calls[0];
    expect(rows.map((s: Sale) => s.id)).toEqual(["s-1", "s-3"]);
    expect(product).toBe("var-cafe");

    // Al quitar el filtro, el pedido oculto sigue seleccionado y vuelve al export.
    chooseProduct("");
    expect(hiddenNotice()).not.toBeInTheDocument();
    fireEvent.click(exportButton());
    expect(onExport.mock.calls[1][0].map((s: Sale) => s.id)).toEqual(["s-1", "s-2", "s-3"]);
  });

  it("producto + fecha: la selección que no cumple ambos queda fuera", () => {
    const onExport = setup();
    chooseProduct("var-cafe");
    const [from, to] = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    fireEvent.change(from, { target: { value: "2026-09-02" } });
    fireEvent.change(to, { target: { value: "2026-09-02" } });

    expect(hiddenNotice()).toHaveTextContent("2 seleccionado(s) oculto(s)");
    fireEvent.click(exportButton());
    expect(onExport.mock.calls[0][0].map((s: Sale) => s.id)).toEqual(["s-3"]);
  });

  it("si ningún seleccionado cumple los filtros, el export queda deshabilitado", () => {
    const onExport = setup();
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "no-existe" } });

    expect(hiddenNotice()).toHaveTextContent("3 seleccionado(s) oculto(s)");
    expect(exportButton()).toBeDisabled();
    fireEvent.click(exportButton());
    expect(onExport).not.toHaveBeenCalled();
  });
});

describe("buildPedidosExportRows — unidades del producto filtrado", () => {
  const SALES = [
    makeSale(1, "PREPARADO", "01/09/2026", [CAFE(2), TE(1)]),
    makeSale(3, "PREPARADO", "02/09/2026", [CAFE(1), CAFE(3)]),
  ];

  it("suma la quantity del producto por pedido (incluye ítems repetidos)", () => {
    const rows = buildPedidosExportRows(SALES, "var-cafe");
    expect(rows.map((r) => r.filteredProductUnits)).toEqual([2, 4]);
  });

  it("conserva todos los productos y el total de la orden", () => {
    const [row] = buildPedidosExportRows(SALES, "var-te");
    expect(row).toMatchObject({ products: "Café x2; Té x1", total: 101, filteredProductUnits: 1 });
  });

  it("sin filtro por producto no agrega el campo", () => {
    expect(buildPedidosExportRows(SALES, "")[0]).not.toHaveProperty("filteredProductUnits");
    expect(buildPedidosExportRows(SALES)[0]).not.toHaveProperty("filteredProductUnits");
  });
});
