import {
  groupLiveProducts,
  groupReservations,
  reservationTab,
  variantMatrix,
} from "../liveGroups";
import type { LiveProduct, LiveReservation } from "../types";

const variant = (
  variantId: string,
  attributes: Record<string, string>,
  extra: Partial<LiveProduct> = {},
): LiveProduct => ({
  variantId,
  productId: "short",
  name: "Short Sastre Luisa",
  sku: `SSL-${variantId}`,
  attributes,
  variantLabel: Object.values(attributes).join(" / "),
  regularPrice: 149,
  livePrice: 149,
  availableStock: 3,
  maxPerCustomer: null,
  enabled: false,
  ...extra,
});

describe("catalog grouped by product (FEAT-33 B2)", () => {
  test("one group per product, keeping the catalog order and the total stock", () => {
    const groups = groupLiveProducts([
      variant("1", { Color: "Gris", Talla: "S" }, { availableStock: 4 }),
      variant("x", {}, { productId: "polo", name: "Polo", availableStock: 2 }),
      variant("2", { Color: "Gris", Talla: "M" }, { availableStock: 6 }),
    ]);
    expect(
      groups.map((group) => [
        group.name,
        group.variants.length,
        group.totalStock,
      ]),
    ).toEqual([
      ["Short Sastre Luisa", 2, 10],
      ["Polo", 1, 2],
    ]);
  });

  test("a negative stock never lowers the product total", () => {
    const [group] = groupLiveProducts([
      variant("1", { Talla: "S" }, { availableStock: -2 }),
      variant("2", { Talla: "M" }, { availableStock: 5 }),
    ]);
    expect(group.totalStock).toBe(5);
  });

  test("builds a Color × Talla matrix and leaves missing combinations empty", () => {
    const matrix = variantMatrix([
      variant("1", { Color: "Gris", Talla: "S" }),
      variant("2", { Color: "Gris", Talla: "M" }),
      variant("3", { Color: "Negro", Talla: "M" }),
    ]);
    expect(matrix.rowLabel).toBe("Color");
    expect(matrix.colLabel).toBe("Talla");
    expect(matrix.rows).toEqual(["Gris", "Negro"]);
    expect(matrix.cols).toEqual(["S", "M"]);
    expect(matrix.cell("Negro", "S")).toBeUndefined();
    expect(matrix.cell("Negro", "M")?.variantId).toBe("3");
  });

  test("puts the size in the columns whatever the attribute order", () => {
    const matrix = variantMatrix([variant("1", { talla: "S", color: "Gris" })]);
    expect(matrix.colLabel).toBe("talla");
    expect(matrix.rowLabel).toBe("color");
  });

  test("a product with one attribute is a single row", () => {
    const matrix = variantMatrix([
      variant("1", { Talla: "S" }),
      variant("2", { Talla: "M" }),
    ]);
    expect(matrix.rows).toEqual([""]);
    expect(matrix.cols).toEqual(["S", "M"]);
    expect(matrix.cell("", "M")?.variantId).toBe("2");
  });

  test("a product without attributes is one cell", () => {
    const matrix = variantMatrix([variant("1", {})]);
    expect(matrix.cell(matrix.rows[0], matrix.cols[0])?.variantId).toBe("1");
  });
});

const reservation = (
  id: string,
  extra: Partial<LiveReservation> = {},
): LiveReservation => ({
  id,
  variantId: "v",
  productName: "Short",
  quantity: 1,
  unitPrice: 50,
  customer: { id: "ana", name: "Ana", phone: "912345678" },
  status: "ACTIVE",
  expiresAt: "2026-11-24T12:10:00Z",
  createdAt: "2026-11-24T12:00:00Z",
  type: "TIMED",
  ...extra,
});

describe("reservation tabs (FEAT-33 A3)", () => {
  test.each([
    ["TIMED", reservation("1")],
    ["TRUSTED", reservation("2", { type: "ACCUMULATED", expiresAt: null })],
    ["REVIEW", reservation("3", { checkoutId: "c", reviewHold: true })],
    ["PAID", reservation("4", { status: "PAID" })],
    [null, reservation("5", { status: "RELEASED" })],
    [null, reservation("6", { status: "EXPIRED" })],
  ] as const)("classifies into %s", (tab, row) => {
    expect(reservationTab(row)).toBe(tab);
  });

  test("one card per customer with the earliest timer and the total", () => {
    const groups = groupReservations(
      [
        reservation("1", { expiresAt: "2026-11-24T12:10:00Z", quantity: 2 }),
        reservation("2", { expiresAt: "2026-11-24T12:05:00Z" }),
        reservation("3", {
          customer: { id: "bea", name: "Bea", phone: "923456789" },
        }),
        reservation("4", { status: "PAID" }),
      ],
      "TIMED",
    );
    expect(
      groups.map((group) => [group.customer.name, group.units, group.total]),
    ).toEqual([
      ["Ana", 3, 150],
      ["Bea", 1, 50],
    ]);
    expect(groups[0].timer?.id).toBe("2");
  });
});
