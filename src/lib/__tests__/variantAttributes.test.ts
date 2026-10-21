import { formatVariantLabel, isDefaultTitleValue, visibleVariantAttributes } from "@/lib/variantAttributes";

describe("variantAttributes (FEAT-24 H0)", () => {
  it.each(["Default Title", " default  TITLE ", "Default Títle"])("%p es el título por defecto de Shopify", (value) => {
    expect(isDefaultTitleValue(value)).toBe(true);
  });

  it("no confunde otros valores", () => {
    expect(isDefaultTitleValue("Rojo")).toBe(false);
    expect(isDefaultTitleValue(null)).toBe(false);
  });

  it("oculta Default Title y deja los atributos reales", () => {
    expect(formatVariantLabel({ Title: "Default Title" })).toBe("");
    expect(formatVariantLabel({ Color: "Rojo", Title: " default title " })).toBe("Color: Rojo");
    expect(formatVariantLabel({ Color: "Rojo", Talla: "M" })).toBe("Color: Rojo · Talla: M");
    expect(formatVariantLabel(null)).toBe("");
  });

  it("visibleVariantAttributes devuelve pares sin vacíos", () => {
    expect(visibleVariantAttributes({ Color: "Rojo", Vacio: "", Title: "Default Title" })).toEqual([["Color", "Rojo"]]);
  });
});
