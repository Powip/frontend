import type { BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import type { PackView } from "@/services/packsService";
import { filterStockVariants, groupByProduct, packStockRows, stockStatus, stockTotals, storesOf, variantPositionsFlat, visibleInventories } from "../stockView";

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

describe("packs en la tabla de Stock (FEAT-24 H9)", () => {
  const columns = [{ id: "a", name: "Principal", storeId: "s1", storeName: "Tienda Uno" }, { id: "b", name: "Lince", storeId: "s2", storeName: "Tienda Dos" }];
  const pack = (id: string, over: Partial<PackView> = {}): PackView => ({
    id, variantId: `${id}-v`, name: "Pack Verano", description: null, sku: "PK-1", productSku: null, powipEan: null, barcode: null,
    imageUrl: null, price: 50, active: true, categoryId: null, brandId: null, components: [],
    available: { total: 9, byWarehouse: [
      { inventoryId: "a", inventoryName: "Principal", storeId: "s1", available: 3 },
      { inventoryId: "b", inventoryName: "Lince", storeId: "s2", available: 0 },
      { inventoryId: "ajeno", inventoryName: "Otro", storeId: "s9", available: 6 },
    ] },
    ...over,
  });

  it("toma el disponible por almacén de ms-products y suma solo los almacenes visibles", () => {
    const [row] = packStockRows([pack("k1")], columns, ALL);
    expect([...row.byInventory.entries()]).toEqual([["a", 3], ["b", 0]]);
    expect(row.total).toBe(3); // el almacén que el usuario no ve no entra
    expect(row.sku).toBe("PK-1");
    expect(packStockRows([pack("k1")], [columns[1]], ALL)[0].total).toBe(0);
  });

  it("deja afuera los inactivos, los que no matchean la búsqueda y los que no tienen componentes en los almacenes visibles", () => {
    const packs = [pack("k1"), pack("k2", { active: false }), pack("k3", { name: "Combo Gorra", sku: "CG-2" }), pack("k4", { available: { total: 6, byWarehouse: [{ inventoryId: "ajeno", inventoryName: null, storeId: null, available: 6 }] } })];
    expect(packStockRows(packs, columns, ALL).map((row) => row.id)).toEqual(["k1", "k3"]);
    expect(packStockRows(packs, columns, { ...ALL, search: "cg-2" }).map((row) => row.id)).toEqual(["k3"]);
  });

  it("sin datos de logística el pack se muestra igual con el total desconocido", () => {
    const [row] = packStockRows([pack("k1", { available: null })], columns, ALL);
    expect(row.byInventory.size).toBe(0);
    expect(row.total).toBeNull();
  });

  it("con filtro de estado: «Agotado» si no alcanza para ninguno, «Normal» si alcanza; nunca «Bajo mínimo»", () => {
    const packs = [pack("k1"), pack("k2", { available: { total: 0, byWarehouse: [{ inventoryId: "a", inventoryName: null, storeId: null, available: 0 }] } }), pack("k3", { available: null })];
    expect(packStockRows(packs, columns, { ...ALL, status: "agotado" }).map((row) => row.id)).toEqual(["k2"]);
    expect(packStockRows(packs, columns, { ...ALL, status: "normal" }).map((row) => row.id)).toEqual(["k1"]);
    expect(packStockRows(packs, columns, { ...ALL, status: "bajo" })).toEqual([]);
  });
});
