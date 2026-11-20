import { buildFichaStock, type StockPositionLike } from "../fichaStock";

const pos = (over: Partial<StockPositionLike> & Record<string, unknown>): StockPositionLike => ({
  inventoryItemId: "ii", variantId: "v1", productId: "p1", inventoryId: "inv-1", inventoryName: "Principal",
  physicalStock: 10, availableStock: 8, reservedStock: 2, ...over,
});

describe("fichaStock (FEAT-24 H4)", () => {
  const variants = [
    { id: "v1", attributeValues: { Talla: "S" }, companySku: "POL-S" },
    { id: "v2", attributeValues: { Title: "Default Title" }, companySku: null, sku: "INT-2" },
  ];

  it("arma una fila por variante y almacén, en el orden de las variantes, con totales", () => {
    const view = buildFichaStock([
      pos({ inventoryItemId: "a", variantId: "v2", inventoryName: "Tienda" }),
      pos({ inventoryItemId: "b", variantId: "v1", inventoryName: "Principal" }),
      pos({ inventoryItemId: "c", variantId: "otra", productId: "p9" }),
    ], "p1", variants);
    expect(view.rows.map((r) => [r.variantLabel, r.sku, r.inventoryName])).toEqual([["Talla: S", "POL-S", "Principal"], ["Única", "INT-2", "Tienda"]]);
    expect(view.totals).toEqual({ physical: 20, reserved: 4, available: 16, inTransit: 0, incoming: 0 });
  });

  it("tránsito y por recibir solo se muestran si el backend los informa", () => {
    expect(buildFichaStock([pos({})], "p1", variants)).toMatchObject({ showTransit: false, showIncoming: false });
    const view = buildFichaStock([pos({ in_transit_quantity: 3 }), pos({ inventoryItemId: "z", pendingReturnStock: "2" })], "p1", variants);
    expect(view).toMatchObject({ showTransit: true, showIncoming: true });
    expect(view.rows.map((r) => [r.inTransit, r.incoming])).toEqual([[3, null], [null, 2]]);
    expect(view.totals.inTransit).toBe(3);
    expect(view.totals.incoming).toBe(2);
  });
});
