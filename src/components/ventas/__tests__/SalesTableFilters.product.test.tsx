import { fireEvent, render, screen } from "@testing-library/react";
import {
  SalesTableFilters,
  applyFilters,
  buildProductFilterOptions,
  countProductUnits,
  emptySalesFilters,
  getProductFilterKey,
  type SalesFilters,
} from "../SalesTableFilters";

/**
 * Filtro "Producto" de SalesTableFilters / applyFilters (Ventas y Pedidos).
 *
 * 1. La clave es el productVariantId (SKU solo como respaldo).
 * 2. Las opciones distinguen variantes con el mismo nombre.
 * 3. applyFilters se queda con las órdenes que tienen el producto en algún ítem.
 * 4. Se combina con rango de fechas y búsqueda.
 * 5. Filtra la lista completa, no la página visible.
 * 6. El <select> emite la clave sin pisar los demás filtros.
 */

type Item = {
  productVariantId?: string | null;
  sku?: string | null;
  productName: string;
  attributes?: Record<string, string>;
};

const POLO_M: Item = { productVariantId: "var-polo-m", sku: "POLO-M", productName: "Polo", attributes: { Talla: "M" } };
const POLO_L: Item = { productVariantId: "var-polo-l", sku: "POLO-L", productName: "Polo", attributes: { Talla: "L" } };
const GORRA: Item = { productVariantId: "var-gorra", sku: "GOR-01", productName: "Gorra" };

function order(orderNumber: string, date: string, items: Item[], clientName = "Cliente") {
  return {
    orderNumber,
    clientName,
    phoneNumber: "999111222",
    date,
    paymentMethod: "YAPE",
    pendingPayment: 0,
    salesRegion: "LIMA" as const,
    deliveryType: "DOMICILIO",
    items,
  };
}

const withProduct = (product: string, extra: Partial<SalesFilters> = {}): SalesFilters => ({
  ...emptySalesFilters,
  product,
  ...extra,
});

describe("getProductFilterKey", () => {
  it("usa el productVariantId", () => {
    expect(getProductFilterKey(POLO_M)).toBe("var-polo-m");
  });

  it("sin variante cae al SKU con prefijo", () => {
    expect(getProductFilterKey({ productName: "X", sku: "ABC" })).toBe("sku:ABC");
  });

  it("sin variante ni SKU no es filtrable", () => {
    expect(getProductFilterKey({ productName: "X" })).toBeNull();
  });
});

describe("buildProductFilterOptions", () => {
  it("una opción por variante, ordenadas, con atributos y SKU para distinguirlas", () => {
    const options = buildProductFilterOptions([
      order("1", "01/09/2026", [POLO_M, GORRA]),
      order("2", "02/09/2026", [POLO_L, POLO_M]),
    ]);

    expect(options).toEqual([
      { value: "var-gorra", label: "Gorra · SKU GOR-01" },
      { value: "var-polo-l", label: "Polo (L) · SKU POLO-L" },
      { value: "var-polo-m", label: "Polo (M) · SKU POLO-M" },
    ]);
  });

  it("si dos variantes quedan con el mismo texto, agrega un sufijo del id", () => {
    const options = buildProductFilterOptions([
      order("1", "01/09/2026", [{ productVariantId: "aaaa-111111", sku: "S", productName: "Polo" }]),
      order("2", "01/09/2026", [{ productVariantId: "bbbb-222222", sku: "S", productName: "Polo" }]),
    ]);

    expect(options.map((o) => o.label)).toEqual(["Polo · SKU S [111111]", "Polo · SKU S [222222]"]);
  });

  it("órdenes sin ítems no aportan opciones", () => {
    expect(buildProductFilterOptions([order("1", "01/09/2026", []), { items: null }])).toEqual([]);
  });
});

describe("applyFilters — producto", () => {
  const ORDERS = [
    order("A", "01/09/2026", [POLO_M]),
    order("B", "02/09/2026", [GORRA]),
    order("C", "02/09/2026", [GORRA, POLO_M], "María"),
    order("D", "03/09/2026", [POLO_L]),
    order("E", "05/09/2026", [POLO_M]),
  ];

  it("se queda con las órdenes que tienen la variante en algún ítem", () => {
    expect(applyFilters(ORDERS, withProduct("var-polo-m")).map((o) => o.orderNumber)).toEqual(["A", "C", "E"]);
  });

  it("no confunde variantes del mismo producto", () => {
    expect(applyFilters(ORDERS, withProduct("var-polo-l")).map((o) => o.orderNumber)).toEqual(["D"]);
  });

  it("filtra por SKU cuando el ítem no tiene variante", () => {
    const data = [order("X", "01/09/2026", [{ productName: "Importado", sku: "IMP-1" }]), order("Y", "01/09/2026", [GORRA])];
    expect(applyFilters(data, withProduct("sku:IMP-1")).map((o) => o.orderNumber)).toEqual(["X"]);
  });

  it("se combina con el rango de fechas (un día puntual)", () => {
    const result = applyFilters(ORDERS, withProduct("var-polo-m", { dateFrom: "2026-09-02", dateTo: "2026-09-02" }));
    expect(result.map((o) => o.orderNumber)).toEqual(["C"]);
  });

  it("se combina con fecha desde y la búsqueda", () => {
    expect(
      applyFilters(ORDERS, withProduct("var-polo-m", { dateFrom: "2026-09-02" })).map((o) => o.orderNumber),
    ).toEqual(["C", "E"]);
    expect(
      applyFilters(ORDERS, withProduct("var-polo-m", { dateFrom: "2026-09-02", search: "maría" })).map(
        (o) => o.orderNumber,
      ),
    ).toEqual(["C"]);
  });

  it("filtra la lista completa, no solo la primera página", () => {
    // 40 órdenes; el producto aparece en las posiciones 3, 22 y 39 (páginas 1, 3 y 4 de 10).
    const many = Array.from({ length: 40 }, (_, i) =>
      order(`N${i}`, "01/09/2026", [3, 22, 39].includes(i) ? [GORRA, POLO_L] : [POLO_M]),
    );
    expect(applyFilters(many, withProduct("var-polo-l")).map((o) => o.orderNumber)).toEqual(["N3", "N22", "N39"]);
  });

  it("sin producto elegido no filtra nada", () => {
    expect(applyFilters(ORDERS, emptySalesFilters)).toHaveLength(ORDERS.length);
  });
});

describe("SalesTableFilters — select Producto", () => {
  const OPTIONS = buildProductFilterOptions([order("1", "01/09/2026", [POLO_M, POLO_L, GORRA])]);

  it("no se muestra si no se pide showProductFilter", () => {
    render(<SalesTableFilters filters={emptySalesFilters} onFiltersChange={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.queryByLabelText("Producto")).not.toBeInTheDocument();
  });

  it("lista las opciones y al elegir conserva los demás filtros (fecha)", () => {
    const onChange = jest.fn();
    const filters = { ...emptySalesFilters, dateFrom: "2026-09-01", dateTo: "2026-09-01" };
    render(
      <SalesTableFilters
        filters={filters}
        onFiltersChange={onChange}
        showProductFilter
        availableProducts={OPTIONS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));

    const select = screen.getByLabelText("Producto") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      "Todos",
      "Gorra · SKU GOR-01",
      "Polo (L) · SKU POLO-L",
      "Polo (M) · SKU POLO-M",
    ]);

    fireEvent.change(select, { target: { value: "var-polo-l" } });
    expect(onChange).toHaveBeenCalledWith({ ...filters, product: "var-polo-l" });
  });

  it("el producto elegido cuenta como filtro activo y 'Limpiar' lo borra", () => {
    const onChange = jest.fn();
    render(
      <SalesTableFilters
        filters={withProduct("var-gorra")}
        onFiltersChange={onChange}
        showProductFilter
        availableProducts={OPTIONS}
      />,
    );
    expect(screen.getByRole("button", { name: /Filtros\s*1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Limpiar/ }));
    expect(onChange).toHaveBeenCalledWith(emptySalesFilters);
  });
});

describe("countProductUnits", () => {
  const items = [
    { ...POLO_M, quantity: 2 },
    { ...POLO_L, quantity: 5 },
    { ...POLO_M, quantity: 1 }, // misma variante en otra línea (p. ej. promo)
    { productName: "Importado", sku: "IMP-1", quantity: 4 },
  ];

  it("suma la quantity de todas las líneas de la variante", () => {
    expect(countProductUnits(items, "var-polo-m")).toBe(3);
    expect(countProductUnits(items, "var-polo-l")).toBe(5);
  });

  it("funciona con la clave por SKU y da 0 si la orden no tiene el producto", () => {
    expect(countProductUnits(items, "sku:IMP-1")).toBe(4);
    expect(countProductUnits(items, "var-gorra")).toBe(0);
    expect(countProductUnits(null, "var-gorra")).toBe(0);
  });
});
