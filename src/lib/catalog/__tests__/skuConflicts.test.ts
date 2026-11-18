import { skuConflictRows } from "@/lib/catalog/skuConflicts";
import { hasSkuConflict } from "@/lib/catalog/catalogProducts";

describe("skuConflictRows (FEAT-24 H4)", () => {
  const products = [
    {
      id: "p2", name: "Zapatilla", companySku: "ZAP", skuConflict: false,
      variants: [
        { id: "v3", companySku: "ZAP-40", skuConflict: true, attributeValues: { Talla: "40" } },
        { id: "v4", companySku: "ZAP-41", skuConflict: true, attributeValues: { Talla: "41" }, mergedInto: "v3" },
        { id: "v5", companySku: "ZAP-42", skuConflict: true, attributeValues: { Talla: "42" }, isActive: false },
      ],
    },
    {
      id: "p1", name: "Polo", companySku: " POL ", skuConflict: true,
      variants: [
        { id: "v1", companySku: "POL-1", skuConflict: true, attributeValues: { Title: "Default Title" } },
        { id: "v2", companySku: "POL-2", skuConflict: false, attributeValues: { Talla: "M" } },
      ],
    },
    { id: "p3", name: "Gorra", companySku: "GOR", variants: [{ id: "v6", companySku: "GOR-1" }] },
  ];

  it("lista el SKU base y las variantes vivas en cuarentena, ordenadas por producto", () => {
    expect(skuConflictRows(products)).toEqual([
      { kind: "product", id: "p1", productId: "p1", productName: "Polo", label: "SKU base", sku: "POL" },
      { kind: "variant", id: "v1", productId: "p1", productName: "Polo", label: "Única", sku: "POL-1" },
      { kind: "variant", id: "v3", productId: "p2", productName: "Zapatilla", label: "Talla: 40", sku: "ZAP-40" },
    ]);
  });

  it("hasSkuConflict también mira el SKU base del producto", () => {
    expect(hasSkuConflict({ id: "p", name: "P", skuConflict: true, variants: [] })).toBe(true);
    expect(hasSkuConflict(products[2])).toBe(false);
  });
});
