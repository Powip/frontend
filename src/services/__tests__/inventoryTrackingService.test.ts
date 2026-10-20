import {
  parseUnitCodes,
  purchaseLinePayload,
  validateUnitCodes,
} from "../inventoryTrackingService";

describe("unit identifiers and purchase payload compatibility", () => {
  it("keeps leading zeroes as text and accepts only one IMEI per unit", () => {
    const codes = parseUnitCodes(" 001234567890123 \r\n001234567890124\n");
    expect(codes).toEqual(["001234567890123", "001234567890124"]);
    expect(validateUnitCodes([{ trackingMode: "IMEI", quantity: 2, codes }])).toBeNull();
    expect(validateUnitCodes([{ trackingMode: "IMEI", quantity: 1, codes }])).toContain(
      "registra 1 códigos",
    );
    expect(validateUnitCodes([{ trackingMode: "IMEI", quantity: 1, codes: ["123"] }])).toContain(
      "15 dígitos",
    );
  });
  it("rejects normalized duplicates within a row and across different variants", () => {
    expect(
      validateUnitCodes([{ trackingMode: "SERIAL", quantity: 2, codes: [" ab-001 ", "AB-001"] }]),
    ).toContain("duplicado");
    expect(
      validateUnitCodes([
        { trackingMode: "SERIAL", quantity: 1, codes: ["ab-001"] },
        { trackingMode: "SERIAL", quantity: 1, codes: ["AB-001"] },
      ]),
    ).toContain("duplicado");
  });
  it("preserves the original quantity-only payload and adds codes only for tracked lines", () => {
    const normal = {
      variantId: "normal",
      supplierId: "supplier",
      supplierName: "Proveedor",
      sku: "SKU",
      productName: "Normal",
      quantity: 2,
      unitCost: 10,
      attributes: {},
    };
    expect(purchaseLinePayload({ ...normal, trackingMode: "NONE", codes: ["stray"] })).toEqual(
      normal,
    );
    expect(
      purchaseLinePayload({ ...normal, trackingMode: "IMEI", codes: ["001234567890123"] }),
    ).toEqual({ ...normal, codes: ["001234567890123"] });
  });
});
