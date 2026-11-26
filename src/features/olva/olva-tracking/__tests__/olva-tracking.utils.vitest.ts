import { describe, expect, it } from "vitest";
import { OLVA_TRACKING_BATCH_MAX_SIZE } from "../constants/olva-tracking.constants";
import type { OlvaTrackingBatchItem } from "../models/olva-tracking-batch-item";
import { formatOlvaTrackingDate } from "../utils/format-olva-tracking-date";
import { isValidOlvaTrackingLookup } from "../utils/is-valid-olva-tracking-lookup";
import { normalizeOlvaTrackingLookups } from "../utils/normalize-olva-tracking-lookups";
import { splitOlvaTrackingBatch } from "../utils/split-olva-tracking-batch";

describe("isValidOlvaTrackingLookup", () => {
  it.each([
    [{ orderNumber: "123456" }, true],
    [{ orderNumber: "123456789012" }, true],
    [{ orderNumber: "12345" }, false],
    [{ orderNumber: "1234567890123" }, false],
    [{ orderNumber: "12345a" }, false],
    [{ orderNumber: "123456", orderCode: "26" }, true],
    [{ orderNumber: "123456", orderCode: "  " }, true],
    [{ orderNumber: "123456", orderCode: "2026" }, false],
  ])("%j -> %s", (lookup, expected) => {
    expect(isValidOlvaTrackingLookup(lookup)).toBe(expected);
  });
});

describe("normalizeOlvaTrackingLookups", () => {
  it("trims, dedupes keeping order, drops invalid ones", () => {
    expect(
      normalizeOlvaTrackingLookups([
        { orderNumber: " 111111 ", orderCode: "" },
        { orderNumber: "222222", orderCode: "26" },
        { orderNumber: "111111" },
        { orderNumber: "abc" },
        { orderNumber: "222222" },
      ]),
    ).toEqual([
      { orderNumber: "111111" },
      { orderNumber: "222222", orderCode: "26" },
      { orderNumber: "222222" },
    ]);
  });

  it("cuts the list at the backend maximum", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ orderNumber: String(100000 + i) }));

    expect(normalizeOlvaTrackingLookups(many)).toHaveLength(OLVA_TRACKING_BATCH_MAX_SIZE);
  });
});

describe("splitOlvaTrackingBatch", () => {
  it("separates found and failed, keeping order", () => {
    const items: OlvaTrackingBatchItem[] = [
      { success: false, orderNumber: "1", orderCode: null, error: "x" },
      {
        success: true,
        orderNumber: "2",
        orderCode: null,
        tracking: {
          trackingNumber: "2",
          status: "DELIVERED",
          statusDetail: null,
          origin: null,
          destination: null,
          estimatedDelivery: null,
          deliveredAt: "2026-10-22",
          events: [],
        },
      },
    ];

    const { found, failed } = splitOlvaTrackingBatch(items);

    expect(found.map((i) => i.orderNumber)).toEqual(["2"]);
    expect(failed.map((i) => i.orderNumber)).toEqual(["1"]);
  });
});

describe("formatOlvaTrackingDate", () => {
  it("shows the same calendar day in any time zone", () => {
    expect(formatOlvaTrackingDate("2026-10-20")).toMatch(/^20 oct\.? 2026$/);
    expect(formatOlvaTrackingDate("2026-01-01")).toMatch(/^1 ene\.? 2026$/);
  });

  it("returns an unexpected value untouched", () => {
    expect(formatOlvaTrackingDate("pronto")).toBe("pronto");
  });
});
