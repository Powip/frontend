import {
  DEFAULT_CATALOG_FILTERS,
  filterCatalogProducts,
  hasActiveCatalogFilters,
  hasSkuConflict,
  liveVariants,
  productChannel,
  productKind,
  visibleProductSku,
  type CatalogFilters,
  type CatalogProductLike,
} from "../catalogProducts";
import type { CatalogCategoryNode } from "../categoryTree";

const TREE: CatalogCategoryNode[] = [
  { id: "ropa", name: "Ropa", parentId: null, active: true, level: 1, children: [{ id: "pol", name: "Polos", parentId: "ropa", active: true, level: 2, children: [] }] },
  { id: "acc", name: "Accesorios", parentId: null, active: true, level: 1, children: [] },
];

const polo: CatalogProductLike = {
  id: "p1", name: "Polo básico", companySku: "POL0001", sku: "ROPPOL-AAA", status: true, brandId: "nike", categoryId: "pol", type: "variantes",
  variants: [
    { id: "v1", attributeValues: { Talla: "S" }, companySku: "POL0001-S", isActive: true },
    { id: "v2", attributeValues: { Talla: "M" }, companySku: "POL0001-M", isActive: true, skuConflict: true },
  ],
};
const gorra: CatalogProductLike = {
  id: "p2", name: "Gorra", companySku: null, sku: "ACCGOR-BBB", status: false, brandId: null, categoryId: "acc", externalSource: "shopify",
  variants: [{ id: "v3", attributeValues: { Title: "Default Title" }, isActive: true }],
};
const taza: CatalogProductLike = {
  id: "p3", name: "Taza", companySku: "TAZ0001", status: true, brandId: null, categoryId: null, externalSource: "yavendio", type: "simple",
  variants: [{ id: "v4", attributeValues: {}, isActive: true }],
};
const ALL = [polo, gorra, taza];
const f = (overrides: Partial<CatalogFilters>): CatalogFilters => ({ ...DEFAULT_CATALOG_FILTERS, ...overrides });
const ids = (list: CatalogProductLike[]) => list.map((p) => p.id);

describe("catalogProducts (FEAT-24 H4)", () => {
  it("canal desde external_source; sin él, manual", () => {
    expect(productChannel("shopify")).toBe("shopify");
    expect(productChannel("YaVendio")).toBe("yavendio");
    expect(productChannel("aliclik")).toBe("aliclik");
    expect(productChannel(null)).toBe("manual");
    expect(productChannel("otro")).toBe("manual");
  });

  it("tipo: el del backend o, si no viene, una sola variante sin opciones (o Default Title) es simple", () => {
    expect(productKind(polo)).toBe("variantes");
    expect(productKind(gorra)).toBe("simple");
    expect(productKind({ ...polo, type: undefined })).toBe("variantes");
    expect(productKind({ id: "x", name: "x", variants: [{ id: "a", attributeValues: { Color: "Rojo" } }] })).toBe("variantes");
  });

  it("variantes vivas: sin desactivadas ni unificadas", () => {
    expect(liveVariants([{ id: "a" }, { id: "b", isActive: false }, { id: "c", mergedInto: "a" }, { id: "d", status: false }]).map((v) => v.id)).toEqual(["a"]);
  });

  it("SKU visible y aviso de SKU repetido", () => {
    expect(visibleProductSku(polo)).toBe("POL0001");
    expect(visibleProductSku(gorra)).toBe("ACCGOR-BBB");
    expect(hasSkuConflict(polo)).toBe(true);
    expect(hasSkuConflict(taza)).toBe(false);
  });

  it("busca por nombre o SKU (también el de las variantes), sin tildes", () => {
    expect(ids(filterCatalogProducts(ALL, f({ search: "polo basico" })))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ search: "pol0001-m" })))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ search: "accgor" })))).toEqual(["p2"]);
  });

  it("filtra por marca, sin marca, categoría con su rama y sin categoría", () => {
    expect(ids(filterCatalogProducts(ALL, f({ brandId: "nike" })))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ brandId: "none" })))).toEqual(["p2", "p3"]);
    expect(ids(filterCatalogProducts(ALL, f({ categoryId: "ropa" }), { categoryTree: TREE }))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ categoryId: "pol" }), { categoryTree: TREE }))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ categoryId: "none" })))).toEqual(["p3"]);
  });

  it("filtra por canal, tipo, estado y con/sin stock", () => {
    expect(ids(filterCatalogProducts(ALL, f({ channel: "manual" })))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ channel: "shopify" })))).toEqual(["p2"]);
    expect(ids(filterCatalogProducts(ALL, f({ type: "simple" })))).toEqual(["p2", "p3"]);
    expect(ids(filterCatalogProducts(ALL, f({ status: "inactivo" })))).toEqual(["p2"]);
    expect(ids(filterCatalogProducts(ALL, f({ status: "activo" })))).toEqual(["p1", "p3"]);
    const availableByProduct = new Map([["p1", 5], ["p2", 0]]);
    expect(ids(filterCatalogProducts(ALL, f({ stock: "con" }), { availableByProduct }))).toEqual(["p1"]);
    expect(ids(filterCatalogProducts(ALL, f({ stock: "sin" }), { availableByProduct }))).toEqual(["p2", "p3"]);
  });

  it("sabe si hay filtros activos", () => {
    expect(hasActiveCatalogFilters(DEFAULT_CATALOG_FILTERS)).toBe(false);
    expect(hasActiveCatalogFilters(f({ channel: "aliclik" }))).toBe(true);
  });
});
