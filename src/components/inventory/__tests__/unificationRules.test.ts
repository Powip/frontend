import {
  attributeSignature,
  isSerializedTracking,
  pickFromSkuConflict,
  unificationWarnings,
  validateUnificationStock,
  type UnificationPick,
} from "../unificationRules";
import type { MergeStockSides } from "../mergeStockCost";

const pick = (overrides: Partial<UnificationPick> = {}): UnificationPick => ({
  variant_id: "v-1",
  product_name: "Polo Azul",
  sku: "POL-1",
  company_sku: "POL-M",
  attribute_values: { Talla: "M", Color: "Azul" },
  ...overrides,
});

const sides = (overrides: Partial<MergeStockSides> = {}): MergeStockSides => ({
  winnerQuantity: 5,
  winnerReserved: 0,
  loserQuantity: 3,
  loserReserved: 0,
  warehouseCount: 1,
  ...overrides,
});

describe("unificationRules (FEAT-24 H11)", () => {
  it("la firma de atributos ignora claves, mayúsculas, tildes, orden y «Default Title» (igual que ms-products)", () => {
    expect(attributeSignature({ Talla: "M", Color: "Azúl " })).toBe(attributeSignature({ color: "azul", size: "m" }));
    expect(attributeSignature({ Title: "Default Title" })).toBe("");
    expect(attributeSignature({ Talla: "M" })).not.toBe(attributeSignature({ Talla: "L" }));
  });

  it("IMEI y serie cuentan como serializados; NONE o sin dato no", () => {
    expect(isSerializedTracking("IMEI")).toBe(true);
    expect(isSerializedTracking("serial")).toBe(true);
    expect(isSerializedTracking("NONE")).toBe(false);
    expect(isSerializedTracking(undefined)).toBe(false);
  });

  it("avisa de la misma variante y no sigue con otros avisos", () => {
    expect(unificationWarnings(pick(), pick())).toEqual(["Elegiste la misma variante en los dos lados: elige otra para unir."]);
  });

  it("avisa de atributos distintos, IMEI o serie y madre desactivada, solo con los datos que hay", () => {
    const target = pick({ variant_id: "v-2", attribute_values: { Talla: "L" }, tracking_mode: "IMEI", is_active: false });
    const warnings = unificationWarnings(pick(), target);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/Los atributos no coinciden/);
    expect(warnings[1]).toMatch(/IMEI o serie/);
    expect(warnings[2]).toMatch(/madre está desactivada/);
    // Sin el modo de seguimiento todavía (buscador) no se avisa de IMEI.
    expect(unificationWarnings(pick(), pick({ variant_id: "v-2" }))).toEqual([]);
  });

  describe("validación del modo de stock", () => {
    it("sin modo no se puede seguir", () => {
      expect(validateUnificationStock(null, "", null)).toEqual({ finalQuantity: null, error: null, valid: false });
    });

    it("«Contar ahora» sin cantidad no se puede seguir (sin error a la vista) y con una inválida avisa", () => {
      expect(validateUnificationStock("count", "  ", null)).toEqual({ finalQuantity: null, error: null, valid: false });
      expect(validateUnificationStock("count", "2.5", null).error).toBe("Ingresa un número entero entre 0 y 10,000");
      expect(validateUnificationStock("count", "10001", null).valid).toBe(false);
    });

    it("«Contar ahora» con cantidad es válido, también sin el stock leído (el servidor valida el resto)", () => {
      expect(validateUnificationStock("count", "7", null)).toEqual({ finalQuantity: 7, error: null, valid: true });
      expect(validateUnificationStock("count", "0", { sides: sides(), rows: [] })).toMatchObject({ finalQuantity: 0, valid: true });
    });

    it("con el stock leído aplica el piso de reservas y calcula el resultado de cada modo", () => {
      expect(validateUnificationStock("sum", "", { sides: sides(), rows: [] })).toMatchObject({ finalQuantity: 8, valid: true });
      expect(validateUnificationStock("winner", "", { sides: sides(), rows: [] })).toMatchObject({ finalQuantity: 5, valid: true });
      const reserved = validateUnificationStock("count", "1", { sides: sides({ winnerReserved: 2, loserReserved: 1 }), rows: [] });
      expect(reserved.valid).toBe(false);
      expect(reserved.error).toMatch(/3 unidades reservadas/);
    });
  });

  it("«Unir a…» arma la variante elegida con todo lo que trae el grupo de SKU repetido", () => {
    expect(pickFromSkuConflict({
      variant_id: "v-9", product_id: "p-9", product_name: "Gorra", product_type: "simple", sku: "INT-9", company_sku: "GOR",
      attribute_values: {}, image_url: null, price: 30, cost: 12, sku_conflict: true, tracking_mode: "NONE", external_source: "shopify",
      created_at: "2026-11-01T00:00:00.000Z",
    })).toEqual({
      variant_id: "v-9", product_name: "Gorra", sku: "INT-9", company_sku: "GOR", attribute_values: {}, product_id: "p-9",
      product_type: "simple", image_url: null, external_source: "shopify", tracking_mode: "NONE", is_active: true, merged_into: null, cost: 12,
    });
  });
});
