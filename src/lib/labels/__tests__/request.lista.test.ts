import { buildAddedRequest, buildLabelsRequest, mergeLabelLines } from "../request";
import { SAMPLE_LABEL_LINE, type LabelLine } from "../types";

// Correcciones 11-20 (B2): buscador para agregar, quitar líneas y filtro por almacén en «Imprimir etiquetas».

const line = (variantId: string, productId: string, quantity: number): LabelLine => ({ ...SAMPLE_LABEL_LINE, variantId, productId, sku: variantId, quantity });
const pairs = (lines: LabelLine[]) => lines.map((l) => [l.variantId, l.quantity]);

describe("filtro por almacén", () => {
  it("con almacén y «1 de cada una» pide lo de ese almacén (productos o catálogo)", () => {
    expect(buildLabelsRequest({ kind: "products", productIds: ["p1"] }, "fixed", { inventoryId: "w1" })).toEqual({ origin: "stock", inventoryId: "w1", ids: ["p1"] });
    expect(buildLabelsRequest({ kind: "catalog" }, "fixed", { inventoryId: "w1", filter: { brandId: "b1" } })).toEqual({ origin: "stock", inventoryId: "w1", brandId: "b1" });
    // Sin almacén, lo de siempre.
    expect(buildLabelsRequest({ kind: "catalog" }, "fixed")).toEqual({ origin: "products" });
  });

  it("con almacén y «1 de cada una»: solo lo que hay ahí, una etiqueta por variante", () => {
    const base = [line("v1", "p1", 7), line("v2", "p1", 0)];
    expect(pairs(mergeLabelLines({ base, warehouseFilter: true }))).toEqual([["v1", 1]]);
    // «Según stock»: la cantidad es el disponible y las de 0 quedan para que el usuario elija.
    expect(pairs(mergeLabelLines({ base, warehouseFilter: false }))).toEqual([["v1", 7], ["v2", 0]]);
  });
});

describe("lo agregado con el buscador", () => {
  it("se pide por producto: «según stock» con almacén trae su disponible; si no, 1", () => {
    const added = [{ productId: "p2", variantId: null }, { productId: "p3", variantId: "v9" }, { productId: "p2", variantId: null }];
    expect(buildAddedRequest(added, "fixed", "")).toEqual({ origin: "products", ids: ["p2", "p3"] });
    expect(buildAddedRequest(added, "fixed", "w1")).toEqual({ origin: "products", ids: ["p2", "p3"] });
    expect(buildAddedRequest(added, "stock", "w1")).toEqual({ origin: "stock", inventoryId: "w1", ids: ["p2", "p3"] });
    expect(buildAddedRequest(added, "stock", "")).toBeNull();
    expect(buildAddedRequest([], "fixed", "")).toBeNull();
  });

  it("entra el producto entero o solo la variante escaneada, sin repetir lo que ya está, y sin lo quitado", () => {
    const base = [line("v1", "p1", 1)];
    const addedLines = [line("v1", "p1", 1), line("v3", "p2", 1), line("v4", "p2", 1), line("v8", "p3", 1), line("v9", "p3", 1)];
    const added = [{ productId: "p1", variantId: null }, { productId: "p2", variantId: null }, { productId: "p3", variantId: "v9" }];
    expect(pairs(mergeLabelLines({ base, added, addedLines }))).toEqual([["v1", 1], ["v3", 1], ["v4", 1], ["v9", 1]]);
    expect(pairs(mergeLabelLines({ base, added, addedLines, removed: ["v1", "v4"] }))).toEqual([["v3", 1], ["v9", 1]]);
  });
});
