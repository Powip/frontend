import type { OrderHeader } from "@/interfaces/IOrder";
import type { Courier } from "@/services/courierService";
import type { CourierCollection } from "@/services/courierSettlementsService";
import {
  allocateDeposit,
  buildPendingCollections,
  collectionDate,
  localDay,
  resolveOrderCourier,
  toCents,
} from "../pendingCollections";

const NOW = new Date("2026-11-27T12:00:00.000Z").getTime();
const couriers = [
  { id: "shalom", name: "Shalom", companyId: "c", isActive: true },
  { id: "olva", name: "Olva Courier", companyId: "c", isActive: true },
  { id: "old", name: "Viejo", companyId: "c", isActive: false },
  { id: "dup1", name: "Moto", companyId: "c", isActive: true },
  { id: "dup2", name: " moto ", companyId: "c", isActive: true },
] as Courier[];

function order(overrides: Partial<OrderHeader> & Record<string, unknown> = {}): OrderHeader {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    status: "ENTREGADO",
    courierId: "shalom",
    courier: "Shalom",
    currency: "PEN",
    grandTotal: "100.00",
    payments: [],
    customer: { fullName: "Ana" },
    updated_at: "2026-11-20T15:00:00.000Z",
    created_at: "2026-11-18T15:00:00.000Z",
    ...overrides,
  } as unknown as OrderHeader;
}
const payment = (paymentMethod: string, amount: string, status = "PAID") =>
  ({ id: `${paymentMethod}-${amount}-${status}`, paymentMethod, amount, status }) as unknown as OrderHeader["payments"][number];
const collection = (orderId: string, amount: number) => ({ id: `c-${orderId}-${amount}`, orderId, amount }) as CourierCollection;

describe("buildPendingCollections", () => {
  it("counts contraentrega payments as cash held by the courier, even when PAID", () => {
    const [row] = buildPendingCollections(
      [order({ payments: [payment("CONTRA_ENTREGA", "100.00")] })],
      [],
      couriers,
      NOW,
    );
    expect(row).toMatchObject({ expectedCents: 10000, pendingCents: 10000, courierHeldPaymentsCents: 10000, issue: null });
  });

  it("treats cash (EFECTIVO) as held by the courier and POS as paid to the business", () => {
    const [row] = buildPendingCollections(
      [order({ payments: [payment("EFECTIVO", "60.00"), payment("POS", "40.00")] })],
      [],
      couriers,
      NOW,
    );
    expect(row).toMatchObject({ courierHeldPaymentsCents: 6000, paidToBusinessCents: 4000, pendingCents: 6000 });
  });

  it("subtracts only PAID payments to the business: an unverified PENDING advance or a LOST one does not count", () => {
    const [row] = buildPendingCollections(
      [
        order({
          payments: [payment("YAPE", "30.00"), payment("PLIN", "20.00", "PENDING"), payment("YAPE", "50.00", "LOST")],
        }),
      ],
      [],
      couriers,
      NOW,
    );
    expect(row).toMatchObject({ paidToBusinessCents: 3000, expectedCents: 7000, pendingCents: 7000 });
  });

  it("keeps an order whose full total is a PENDING advance: the courier may still owe it", () => {
    const [row] = buildPendingCollections([order({ payments: [payment("YAPE", "100.00", "PENDING")] })], [], couriers, NOW);
    expect(row).toMatchObject({ paidToBusinessCents: 0, pendingCents: 10000, issue: null });
  });

  it("skips zero-total orders and does not block a row on a broken courier-held amount", () => {
    const rows = buildPendingCollections(
      [
        order({ id: "gift", orderNumber: "GIFT", grandTotal: "0.00" }),
        order({ id: "cod", orderNumber: "COD", payments: [payment("CONTRA_ENTREGA", "abc")] }),
      ],
      [],
      couriers,
      NOW,
    );
    expect(rows.map((row) => [row.orderNumber, row.issue, row.pendingCents])).toEqual([["COD", null, 10000]]);
  });

  it("drops fully prepaid orders and subtracts collections already confirmed", () => {
    const rows = buildPendingCollections(
      [
        order({ id: "prepaid", orderNumber: "ORD-P", payments: [payment("YAPE", "100.00")] }),
        order({ id: "partial", orderNumber: "ORD-2" }),
        order({ id: "done", orderNumber: "ORD-3" }),
      ],
      [collection("partial", 40), collection("done", 100)],
      couriers,
      NOW,
    );
    expect(rows.map((row) => [row.orderNumber, row.confirmedCents, row.pendingCents])).toEqual([["ORD-2", 4000, 6000]]);
  });

  it("only lists delivered orders that have a courier", () => {
    const rows = buildPendingCollections(
      [order({ status: "EN_ENVIO" }), order({ id: "pickup", courierId: null, courier: "  " })],
      [],
      couriers,
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it("flags orders ms-courier would reject instead of hiding them", () => {
    const rows = buildPendingCollections(
      [
        order({ id: "a", orderNumber: "A", courierId: null, courier: "Otros" }),
        order({ id: "b", orderNumber: "B", courierId: "old", courier: "Viejo" }),
        order({ id: "c", orderNumber: "C", courierId: null, courier: "MOTO" }),
        order({ id: "d", orderNumber: "D", currency: null }),
        order({ id: "e", orderNumber: "E", grandTotal: "abc" }),
        order({ id: "f", orderNumber: "F", payments: undefined }),
      ],
      [],
      couriers,
      NOW,
    );
    expect(Object.fromEntries(rows.map((row) => [row.orderNumber, row.issue]))).toEqual({
      A: "COURIER_NOT_REGISTERED",
      B: "COURIER_INACTIVE",
      C: "COURIER_AMBIGUOUS",
      D: "NO_CURRENCY",
      E: "INVALID_AMOUNT",
      F: "INVALID_AMOUNT",
    });
    expect(rows.find((row) => row.orderNumber === "A")?.courierId).toBeNull();
  });

  it("sorts the oldest first and computes days since the last update", () => {
    const rows = buildPendingCollections(
      [
        order({ id: "new", orderNumber: "NEW", updated_at: "2026-11-26T12:00:00.000Z" }),
        order({ id: "old", orderNumber: "OLD", updated_at: "2026-11-07T12:00:00.000Z" }),
      ],
      [],
      couriers,
      NOW,
    );
    expect(rows.map((row) => [row.orderNumber, row.days])).toEqual([
      ["OLD", 20],
      ["NEW", 1],
    ]);
  });
});

describe("resolveOrderCourier", () => {
  it("matches a legacy courier name case-insensitively against one active courier", () => {
    expect(resolveOrderCourier({ courierId: null, courier: " olva courier " }, couriers)).toEqual({
      courierId: "olva",
      label: "Olva Courier",
      issue: null,
    });
  });
  it("does not resolve a legacy name to an inactive courier", () => {
    expect(resolveOrderCourier({ courierId: null, courier: "Viejo" }, couriers)?.issue).toBe("COURIER_NOT_REGISTERED");
  });
});

describe("money helpers", () => {
  it("parses API amounts to cents", () => {
    expect(toCents("79.90")).toBe(7990);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("")).toBeNaN();
    expect(toCents(null)).toBeNaN();
  });
  it("allocates a short deposit in order and leaves the rest pending", () => {
    expect(allocateDeposit([5000, 3000, 2000], 6000)).toEqual([5000, 1000, 0]);
    expect(allocateDeposit([5000, 3000], 9000)).toEqual([5000, 3000]);
  });
  it("uses the order update day as collection date, never a future one", () => {
    expect(collectionDate("2026-11-20T15:00:00.000Z", "2026-11-27", "America/Lima")).toBe("2026-11-20");
    expect(collectionDate("2026-11-29T15:00:00.000Z", "2026-11-27", "America/Lima")).toBe("2026-11-27");
    expect(collectionDate(null, "2026-11-27")).toBe("2026-11-27");
    expect(collectionDate("basura", "2026-11-27")).toBe("2026-11-27");
  });
  it("reads timestamps as the local day, not the UTC day (Lima after 19:00 is already tomorrow in UTC)", () => {
    const lima = "America/Lima";
    // 20:30 del 27-11 en Lima = 01:30Z del 28-11.
    expect(localDay("2026-11-28T01:30:00.000Z", lima)).toBe("2026-11-27");
    expect(collectionDate("2026-11-28T01:30:00.000Z", "2026-11-27", lima)).toBe("2026-11-27");
    expect(collectionDate("2026-11-27T01:30:00.000Z", "2026-11-27", lima)).toBe("2026-11-26");
    expect(localDay("2026-11-27T15:00:00.000Z", "UTC")).toBe("2026-11-27");
    expect(localDay("2026-11-20")).toBe("2026-11-20");
    expect(localDay(null)).toBe("");
    expect(localDay("basura")).toBe("");
  });
  it("defaults to the runtime's local day", () => {
    const local = new Date(2026, 10, 27, 23, 30);
    expect(localDay(local.toISOString())).toBe("2026-11-27");
  });
});
