import {
  resolveEvaShippingCost,
  evaSkuKey,
  codesFromMappings,
  findUnlinkedVariants,
  itemsHaveEvaSku,
  buildEvaItemsPayload,
  isValidEvaSkuCode,
  isValidShippingCostInput,
  roundToCents,
} from "../evaModalHelpers";

const RATES = { defaultCost: 10, districts: { MIRAFLORES: 12.5 } };

describe("resolveEvaShippingCost", () => {
  it("usa el precio del distrito si existe", () => expect(resolveEvaShippingCost(RATES, "MIRAFLORES")).toBe(12.5));
  it("cae al precio por defecto", () => expect(resolveEvaShippingCost(RATES, "SURCO")).toBe(10));
  it("sin tarifa devuelve null", () => {
    expect(resolveEvaShippingCost(null, "SURCO")).toBeNull();
    expect(resolveEvaShippingCost({ defaultCost: null, districts: {} }, "SURCO")).toBeNull();
  });
  it("un precio 0 del distrito gana sobre el por defecto", () => {
    expect(resolveEvaShippingCost({ defaultCost: 10, districts: { MIRAFLORES: 0 } }, "MIRAFLORES")).toBe(0);
  });
});

const V1 = { productVariantId: "v1", sku: "SINSIN-1", productName: "Billetera", quantity: 2 };
const V2 = { productVariantId: "v2", sku: "SINSIN-2", productName: "Monedero", quantity: 1 };
const NOVAR = { productVariantId: null, sku: "S/SKU", productName: "Suelto", quantity: 1 };

describe("findUnlinkedVariants", () => {
  it("lista sin repetir variantes sin código, suma cantidades y cuenta pedidos", () => {
    const codes = codesFromMappings([{ variantId: "v2", evaSku: "FEMI070" }]);
    expect(findUnlinkedVariants([{ items: [V1, V2, NOVAR] }, { items: [V1, { ...V1 }] }], codes)).toEqual([
      { variantId: "v1", productName: "Billetera", powipSku: "SINSIN-1", attributes: undefined, totalQuantity: 6, orderCount: 2 },
    ]);
  });

  it("pedidos sin items no rompen", () => {
    expect(findUnlinkedVariants([{}, { items: [] }], {})).toEqual([]);
  });
});

describe("códigos por ítem", () => {
  it("la clave es por variante, o por fila si no hay variante", () => {
    expect(evaSkuKey("o1", 0, V1)).toBe("v:v1");
    expect(evaSkuKey("o1", 2, NOVAR)).toBe("o:o1:2");
  });

  it("itemsHaveEvaSku exige código válido en todos los ítems", () => {
    const items = [V1, NOVAR];
    expect(itemsHaveEvaSku("o1", items, { "v:v1": "FEMI064" })).toBe(false);
    expect(itemsHaveEvaSku("o1", items, { "v:v1": "FEMI064", "o:o1:1": "FEMI099" })).toBe(true);
    expect(itemsHaveEvaSku("o1", items, { "v:v1": "FEMI(1)", "o:o1:1": "X" })).toBe(false);
    expect(itemsHaveEvaSku("o1", [], {})).toBe(false);
  });

  it("buildEvaItemsPayload manda variantId solo si existe", () => {
    expect(buildEvaItemsPayload("o1", [V1, NOVAR], { "v:v1": " FEMI064 ", "o:o1:1": "FEMI099" })).toEqual([
      { variantId: "v1", evaSku: "FEMI064", quantity: 2, powipSku: "SINSIN-1", productName: "Billetera" },
      { evaSku: "FEMI099", quantity: 1, powipSku: "S/SKU", productName: "Suelto" },
    ]);
  });

  it("buildEvaItemsPayload recorta nombre y SKU de Powip a lo que acepta el backend", () => {
    const long = { productVariantId: "v9", sku: "S".repeat(150), productName: "N".repeat(250), quantity: 1 };
    const [payload] = buildEvaItemsPayload("o1", [long], { "v:v9": "FEMI064" });
    expect(payload.powipSku).toHaveLength(100);
    expect(payload.productName).toHaveLength(200);
  });

  it("isValidEvaSkuCode", () => {
    expect(isValidEvaSkuCode("FEMI064")).toBe(true);
    expect(isValidEvaSkuCode(" ")).toBe(false);
    expect(isValidEvaSkuCode("A,B")).toBe(false);
    expect(isValidEvaSkuCode("X".repeat(61))).toBe(false);
  });
});

describe("isValidShippingCostInput", () => {
  it.each(["", " ", "0", "12.5", "12.50", "9999.99", "0.07"])("acepta %p", (v) => {
    expect(isValidShippingCostInput(v)).toBe(true);
  });
  it.each(["-1", "10000", "12.555", "abc"])("rechaza %p", (v) => {
    expect(isValidShippingCostInput(v)).toBe(false);
  });
});

describe("roundToCents", () => {
  it("limpia los residuos de punto flotante", () => {
    expect(roundToCents(12.3 - 12.1 - 0.2)).toBe(0);
    expect(roundToCents(89.9 - 30 - 29.9)).toBe(30);
    expect(roundToCents(25.299999999999997)).toBe(25.3);
  });
});
