/**
 * Tests: reglas del pedido sugerido y la cobertura (FEAT-24 H13).
 *
 * 1. Filtros desde la URL o la acción de una alerta (lo inválido se ignora) y el enlace al pedido sugerido.
 * 2. Cobertura: «N días» / «—» y su color contra los días objetivo.
 * 3. Edición: cantidad en unidades de compra → unidades de stock, problemas y monto.
 * 4. Generar: líneas marcadas con el proveedor del grupo, unidades de stock, sin unitCost; qué falta.
 * 5. Precio por proveedor: «Mejor precio», orden y búsqueda.
 */

import {
  coverageText,
  coverageTone,
  generateSelection,
  groupSelection,
  groupSupplierOf,
  lineAmount,
  lineProblem,
  lineUnits,
  NO_SUPPLIER,
  purchaseOrderHref,
  suggestedFiltersFrom,
  suggestedPurchaseHref,
} from "../suggestedPurchase";
import { bestPriceSupplierId, filterSupplierPrices, sortBySupplierPrice } from "../supplierPrices";
import type { SuggestedPurchase, SuggestedPurchaseItem, SupplierPrice } from "@/services/suggestedPurchaseService";

const W1 = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";

function suggestionItem(overrides: Partial<SuggestedPurchaseItem> = {}): SuggestedPurchaseItem {
  return {
    variantId: "v-1",
    sku: "POL-M",
    productName: "Polo",
    attributes: { Talla: "M" },
    unitsSold: 60,
    vd: 2,
    coverageDays: 5,
    physical: 10,
    reserved: 0,
    available: 10,
    minStock: 5,
    incomingTransfer: 0,
    pendingPurchase: 0,
    draftQuantity: 0,
    targetDays: 30,
    needed: 55,
    purchaseUnit: "Caja",
    purchaseFactor: 12,
    purchaseQuantity: 5,
    suggested: 60,
    supplierId: S1,
    supplierName: "Textiles",
    supplierActive: true,
    lastUnitCost: 10,
    lastPurchaseDate: "2026-11-01",
    lastPurchaseNumber: "OC-0001",
    lastPurchaseOrderId: "oc-1",
    estimatedAmount: 600,
    ...overrides,
  };
}

function data(groups: SuggestedPurchase["groups"]): SuggestedPurchase {
  return {
    inventoryId: null,
    warehouseIds: [W1],
    days: 30,
    targetDays: 30,
    includeWithoutSales: false,
    supplierId: null,
    generatedAt: "2026-11-18T15:00:00Z",
    groups,
    totals: { variants: 0, units: 0, purchaseQuantity: 0, withoutPrice: 0 },
    skipped: { notInCatalog: 0 },
  };
}

const totals = { variants: 1, units: 0, purchaseQuantity: 0, withoutPrice: 0 };

describe("filtros y enlaces del pedido sugerido", () => {
  it("toma solo los filtros válidos (uuid, días 1..365 y includeWithoutSales=true)", () => {
    expect(
      suggestedFiltersFrom({ inventoryId: W1, days: "15", targetDays: "400", supplierId: "x", includeWithoutSales: "true", otro: "1" }),
    ).toEqual({ inventoryId: W1, days: 15, includeWithoutSales: true });
    expect(suggestedFiltersFrom({ includeWithoutSales: true, days: 0 })).toEqual({ includeWithoutSales: true });
    expect(suggestedFiltersFrom(null)).toEqual({});
  });

  it("arma el enlace del atajo de la alerta y el de una OC", () => {
    expect(suggestedPurchaseHref({ includeWithoutSales: true })).toBe("/compras/sugerido?includeWithoutSales=true");
    expect(suggestedPurchaseHref({ supplierId: S1, days: 7 })).toBe(`/compras/sugerido?days=7&supplierId=${S1}`);
    expect(suggestedPurchaseHref()).toBe("/compras/sugerido");
    expect(purchaseOrderHref("oc 1")).toBe("/compras?oc=oc%201");
  });
});

describe("cobertura", () => {
  it("muestra días o «—» si no hubo ventas", () => {
    expect(coverageText(null)).toBe("—");
    expect(coverageText(undefined)).toBe("—");
    expect(coverageText(1)).toBe("1 día");
    expect(coverageText(12)).toBe("12 días");
  });

  it("colorea bajo los días objetivo y en 0", () => {
    expect(coverageTone(null, 30)).toBe("none");
    expect(coverageTone(0, 30)).toBe("out");
    expect(coverageTone(29, 30)).toBe("low");
    expect(coverageTone(30, 30)).toBe("ok");
  });
});

describe("edición de cantidades", () => {
  it("pasa de unidades de compra a unidades de stock y valida el tope", () => {
    const item = suggestionItem();
    expect(lineUnits(item, "3")).toBe(36);
    expect(lineUnits(item, "abc")).toBeNull();
    expect(lineProblem(item, "2.5")).toBe("Escribe un número entero.");
    expect(lineProblem(item, "834")).toMatch(/^Hasta 10.000 unidades por producto\.$/);
    expect(lineProblem(item, "833")).toBeNull();
  });

  it("monto = unidades × último costo; sin costo null; sin permiso undefined («••••»)", () => {
    expect(lineAmount(suggestionItem(), 36)).toBe(360);
    expect(lineAmount(suggestionItem({ lastUnitCost: null }), 36)).toBeNull();
    const masked = suggestionItem();
    delete masked.lastUnitCost;
    expect(lineAmount(masked, 36)).toBeUndefined();
  });

  it("totales del grupo con lo marcado", () => {
    const group = { supplierId: S1, supplierName: "Textiles", supplierActive: true, totals, items: [suggestionItem(), suggestionItem({ variantId: "v-2", purchaseQuantity: 1 })] };
    expect(groupSelection(group, {})).toEqual({ products: 2, units: 72, amount: 720 });
    expect(groupSelection(group, { "v-2": { selected: false }, "v-1": { quantity: "1" } })).toEqual({ products: 1, units: 12, amount: 120 });
  });
});

describe("generar órdenes de compra", () => {
  it("manda las líneas marcadas en unidades de stock con el proveedor de su grupo y sin unitCost", () => {
    const result = generateSelection(
      data([
        { supplierId: S1, supplierName: "Textiles", supplierActive: true, totals, items: [suggestionItem(), suggestionItem({ variantId: "v-2", purchaseQuantity: 2 })] },
        { supplierId: S2, supplierName: "Hilos", supplierActive: true, totals, items: [suggestionItem({ variantId: "v-3", purchaseFactor: 1, purchaseQuantity: 4, supplierId: S2 })] },
      ]),
      { "v-2": { selected: false }, "v-1": { quantity: "2" } },
      {},
    );
    expect(result.problem).toBeNull();
    expect(result.lines).toEqual([
      { variantId: "v-1", quantity: 24, supplierId: S1 },
      { variantId: "v-3", quantity: 4, supplierId: S2 },
    ]);
    expect(result).toMatchObject({ orders: 2, products: 2, units: 28, amount: 280 });
  });

  it("el grupo sin proveedor o con el proveedor inactivo pide elegir a quién comprarle", () => {
    const orphan = { supplierId: null, supplierName: null, supplierActive: null, totals, items: [suggestionItem({ variantId: "v-9", supplierId: null })] };
    const inactive = { supplierId: S2, supplierName: "Hilos", supplierActive: false, totals, items: [suggestionItem({ variantId: "v-8" })] };
    expect(groupSupplierOf(orphan, {})).toBe("");
    expect(groupSupplierOf(inactive, {})).toBe("");
    expect(generateSelection(data([orphan]), {}, {}).problem).toBe("Elige a quién comprarle los productos sin proveedor o desmárcalos.");
    expect(generateSelection(data([inactive]), {}, {}).problem).toBe("Elige a quién comprarle en lugar de Hilos (inactivo) o desmárcalos.");
    const chosen = generateSelection(data([orphan]), {}, { [NO_SUPPLIER]: S1 });
    expect(chosen.problem).toBeNull();
    expect(chosen.lines).toEqual([{ variantId: "v-9", quantity: 60, supplierId: S1 }]);
  });

  it("sin nada marcado o con una cantidad inválida no deja generar", () => {
    const group = { supplierId: S1, supplierName: "Textiles", supplierActive: true, totals, items: [suggestionItem()] };
    expect(generateSelection(data([group]), { "v-1": { selected: false } }, {}).problem).toBe("Marca al menos un producto con cantidad mayor a 0.");
    expect(generateSelection(data([group]), { "v-1": { quantity: "0" } }, {}).problem).toBe("Marca al menos un producto con cantidad mayor a 0.");
    expect(generateSelection(data([group]), { "v-1": { quantity: "x" } }, {}).problem).toBe("Polo · Talla: M: Escribe un número entero.");
    expect(generateSelection(undefined, {}, {}).problem).toBe("Marca al menos un producto con cantidad mayor a 0.");
  });

  it("sin rol de costos el monto queda oculto (undefined)", () => {
    const masked = suggestionItem();
    delete masked.lastUnitCost;
    delete masked.estimatedAmount;
    const result = generateSelection(data([{ supplierId: S1, supplierName: "Textiles", supplierActive: true, totals, items: [masked] }]), {}, {});
    expect(result.amount).toBeUndefined();
    expect(result.lines).toHaveLength(1);
  });
});

describe("precio por proveedor", () => {
  const price = (overrides: Partial<SupplierPrice>): SupplierPrice => ({
    variantId: "v-1",
    sku: "POL-M",
    productName: "Polo",
    supplierId: S1,
    supplierName: "Textiles",
    supplierActive: true,
    purchases: 2,
    units: 24,
    lastUnitCost: 10,
    averageUnitCost: 9.5,
    minUnitCost: 9,
    maxUnitCost: 10,
    lastPurchaseUnit: null,
    lastPurchaseFactor: 1,
    lastPurchaseNumber: "OC-0002",
    lastPurchaseOrderId: "oc-2",
    firstDate: "2026-09-01",
    lastDate: "2026-11-01",
    ...overrides,
  });

  it("marca el mejor último precio solo con dos o más proveedores con costo", () => {
    expect(bestPriceSupplierId([price({}), price({ supplierId: S2, lastUnitCost: 8 })])).toBe(S2);
    expect(bestPriceSupplierId([price({})])).toBeNull();
    const masked = price({});
    delete masked.lastUnitCost;
    expect(bestPriceSupplierId([masked, { ...masked, supplierId: S2 }])).toBeNull();
  });

  it("ordena por último precio y busca por nombre o SKU sin tildes", () => {
    const rows = [price({ supplierId: S1, lastUnitCost: 12 }), price({ supplierId: S2, lastUnitCost: 8 })];
    expect(sortBySupplierPrice(rows).map((row) => row.supplierId)).toEqual([S2, S1]);
    expect(filterSupplierPrices([price({ productName: "Polo algodón" }), price({ variantId: "v-2", productName: "Gorra", sku: "GOR" })], "ALGODON")).toHaveLength(1);
    expect(filterSupplierPrices([price({})], "gor")).toHaveLength(0);
  });
});
