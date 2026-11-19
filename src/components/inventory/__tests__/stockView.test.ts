import type { BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { filterStockVariants, groupByProduct, stockStatus, stockTotals, storesOf, variantPositionsFlat, visibleInventories } from "../stockView";

const pos = (id: string, over: Partial<BusinessInventoryItem> = {}): BusinessInventoryItem => ({
  inventoryItemId: id, productId: "p1", variantId: "v1", productName: "Polo", sku: "SKU-1", price: 10,
  physicalStock: 5, reservedStock: 1, availableStock: 4, min_stock: 1,
  inventoryId: "a", inventoryName: "Principal", storeId: "s1", storeName: "Tienda Uno", ...over,
});
const ALL = { search: "", storeId: "all", inventoryId: "all", status: "all" as const };

describe("stockView", () => {
  it("clasifica el estado: agotado, bajo mínimo y normal", () => {
    expect(stockStatus(0, 1)).toBe("agotado");
    expect(stockStatus(-3, 0)).toBe("agotado");
    expect(stockStatus(1, 1)).toBe("bajo");
    expect(stockStatus(2, 1)).toBe("normal");
  });

  it("junta las posiciones de una variante en varios almacenes y suma sus saldos", () => {
    const rows = [pos("i1"), pos("i2", { inventoryId: "b", inventoryName: "Lince", physicalStock: 3, reservedStock: 3, availableStock: 0 })];
    const [variant] = filterStockVariants(rows, ALL);
    expect(variant.positions).toHaveLength(2);
    expect([variant.physical, variant.reserved, variant.available, variant.minStock]).toEqual([8, 4, 4, 2]);
    expect(variant.byInventory.get("b")?.inventoryItemId).toBe("i2");
    expect(variant.status).toBe("normal");
    expect(stockTotals([variant])).toEqual({ physical: 8, reserved: 4, available: 4 });
  });

  it("no mezcla variantes distintas aunque compartan SKU, y agrupa por producto", () => {
    const rows = [pos("i1"), pos("i2", { variantId: "v2" }), pos("i3", { variantId: "v3", productId: "p2", productName: "Gorra" })];
    const groups = groupByProduct(filterStockVariants(rows, ALL));
    expect(groups.map((group) => [group.productName, group.variants.length])).toEqual([["Polo", 2], ["Gorra", 1]]);
  });

  it("filtra por tienda, almacén y texto; el estado se evalúa sobre lo filtrado", () => {
    const rows = [
      pos("i1"),
      pos("i2", { inventoryId: "b", storeId: "s2", storeName: "Tienda Dos", physicalStock: 0, reservedStock: 0, availableStock: 0 }),
      pos("i3", { variantId: "v2", sku: "GOR-9", productId: "p2", productName: "Gorra", attributes: { Color: "Rojo" } }),
    ];
    expect(variantPositionsFlat(filterStockVariants(rows, { ...ALL, storeId: "s2" })).map((row) => row.inventoryItemId)).toEqual(["i2"]);
    expect(filterStockVariants(rows, { ...ALL, inventoryId: "b", status: "agotado" })).toHaveLength(1);
    expect(filterStockVariants(rows, { ...ALL, status: "agotado" })).toHaveLength(0); // sumando sus dos almacenes, la variante tiene 4
    expect(filterStockVariants(rows, { ...ALL, search: "rojo" }).map((variant) => variant.variantId)).toEqual(["v2"]);
    expect(filterStockVariants(rows, { ...ALL, search: "gor-9" })).toHaveLength(1);
  });

  it("arma las tiendas y los almacenes visibles según los filtros", () => {
    const inventories = [{ id: "a", name: "Principal", storeId: "s1", storeName: "Tienda Uno" }, { id: "b", name: "Lince", storeId: "s2", storeName: "Tienda Dos" }, { id: "c", name: "Extra", storeId: "s1", storeName: "Tienda Uno" }];
    expect(storesOf(inventories)).toEqual([{ id: "s2", name: "Tienda Dos" }, { id: "s1", name: "Tienda Uno" }]);
    expect(visibleInventories(inventories, { storeId: "s1", inventoryId: "all" }).map((inv) => inv.id)).toEqual(["a", "c"]);
    expect(visibleInventories(inventories, { storeId: "all", inventoryId: "b" }).map((inv) => inv.id)).toEqual(["b"]);
  });
});
