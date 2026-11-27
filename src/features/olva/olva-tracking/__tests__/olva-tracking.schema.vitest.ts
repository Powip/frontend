import { describe, expect, it } from "vitest";
import { olvaTrackingBatchSchema, olvaTrackingLookupSchema } from "../schemas/olva-tracking.schema";

describe("olvaTrackingLookupSchema", () => {
  it("accepts a guide and turns a blank orderCode into undefined", () => {
    const result = olvaTrackingLookupSchema.safeParse({ orderNumber: " 123456 ", orderCode: "" });

    expect(result.data).toEqual({ orderNumber: "123456", orderCode: undefined });
  });

  it("reports one message per problem", () => {
    const empty = olvaTrackingLookupSchema.safeParse({ orderNumber: "" });
    const bad = olvaTrackingLookupSchema.safeParse({ orderNumber: "12", orderCode: "2026" });

    expect(empty.error?.issues).toHaveLength(1);
    expect(bad.error?.issues.map((i) => i.message)).toEqual([
      "El número de guía debe tener entre 6 y 12 dígitos",
      "El año debe tener 2 dígitos (por ejemplo, 26)",
    ]);
  });
});

describe("olvaTrackingBatchSchema", () => {
  it("needs 1 to 50 guides", () => {
    expect(olvaTrackingBatchSchema.safeParse({ shipments: [] }).success).toBe(false);

    const tooMany = Array.from({ length: 51 }, (_, i) => ({ orderNumber: String(100000 + i) }));
    const result = olvaTrackingBatchSchema.safeParse({ shipments: tooMany });

    expect(result.error?.issues[0].message).toBe("Puedes consultar hasta 50 guías a la vez");
  });
});
