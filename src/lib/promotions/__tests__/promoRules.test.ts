import { promoRuleText, volumeSkusText, volumeUnitText } from "@/lib/promotions/promoRules";
import { toPromotion, type Promotion } from "@/services/promotionsService";

const SKUS: Record<string, string> = { "v-acl": "ACL0356", "v-polo": "POL-M", "v-a": "SOF-S-CRE", "v-b": "SOF-M-CRE" };
const names = {
  product: (id: string | null) => (id === "p-polo" ? "Polo" : "un producto"),
  variant: (id: string | null) => (id ? `Variante ${id}` : "un producto"),
  sku: (id: string | null) => (id ? SKUS[id] ?? null : null),
};
const promo = (over: Partial<Promotion>) => ({ ...toPromotion({ id: "x", name: "P", type: "GIFT" }), ...over }) as Promotion;

describe("textos de volumen y regalo en la tabla (FEAT-32 M4, spec §7.12)", () => {
  it("volumen: «3 por S/ 210.00», con tope «· hasta N u.» y el precio por unidad", () => {
    expect(promoRuleText(promo({ type: "VOLUME", minQty: 3, packPrice: 210 }), names)).toBe("3 por S/ 210.00");
    expect(promoRuleText(promo({ type: "VOLUME", minQty: 3, maxQty: 6, packPrice: 210 }), names)).toBe("3 por S/ 210.00 · hasta 6 u.");
    expect(volumeUnitText({ minQty: 3, packPrice: 210 })).toBe("S/ 70.00 c/u");
    expect(volumeUnitText({ minQty: null, packPrice: 210 })).toBe("");
  });

  it("regalo: el SKU y el monto; por producto o variante, y con varias unidades", () => {
    expect(promoRuleText(promo({ giftCondition: "AMOUNT", minAmount: 300, giftVariantId: "v-acl", giftQuantity: 1 }), names)).toBe("Regalo ACL0356 desde S/ 300.00");
    expect(promoRuleText(promo({ giftCondition: "AMOUNT", minAmount: 300, giftVariantId: "v-acl", giftQuantity: 2 }), names)).toBe("Regalo 2 × ACL0356 desde S/ 300.00");
    expect(promoRuleText(promo({ giftCondition: "PRODUCT", productId: "p-polo", minQty: 2, giftVariantId: "v-acl" }), names)).toBe("Regalo ACL0356 al comprar 2 de Polo");
    expect(promoRuleText(promo({ giftCondition: "VARIANT", triggerVariantId: "v-polo", minQty: 1, giftVariantId: "v-acl" }), names)).toBe("Regalo ACL0356 al comprar 1 × POL-M");
    // Mientras no se conoce el SKU.
    expect(promoRuleText(promo({ giftCondition: "AMOUNT", minAmount: 150, giftVariantId: "v-x" }), names)).toBe("Regalo un SKU desde S/ 150.00");
  });

  it("SKUs del volumen: los 2 primeros y «y N más», más el conteo", () => {
    expect(volumeSkusText(["v-a", "v-b", "v-c", "v-d"], (id) => SKUS[id] ?? null)).toEqual({ first: "SOF-S-CRE, SOF-M-CRE y 2 más", count: "4 SKUs" });
    expect(volumeSkusText(["v-a"], (id) => SKUS[id] ?? null)).toEqual({ first: "SOF-S-CRE", count: "1 SKU" });
    expect(volumeSkusText(["v-z", "v-y"], () => null)).toEqual({ first: "", count: "2 SKUs" });
  });

  it("una fila de /promos sin variantIds queda con la lista vacía", () => {
    expect(toPromotion({ id: "v", type: "VOLUME" }).variantIds).toEqual([]);
    expect(toPromotion({ id: "v", type: "VOLUME", variantIds: ["a", 3, "", "b"] }).variantIds).toEqual(["a", "b"]);
  });
});
