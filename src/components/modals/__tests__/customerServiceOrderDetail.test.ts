import type { OrderHeader } from "@/interfaces/IOrder";
import { buildPendingOrderDetail } from "../customerServiceOrderDetail";

const payment = (
  amount: string,
  status: "PENDING" | "PAID" | "LOST",
  externalReference: string | null = null,
): OrderHeader["payments"][number] => ({
  id: `${status}-${amount}`,
  amount,
  status,
  paymentMethod: "TRANSFERENCIA",
  externalReference,
  paymentDate: "2026-10-22T22:00:00.000Z",
  paymentProofUrl: null,
  notes: null,
  created_at: "2026-10-22T22:00:00.000Z",
  updated_at: "2026-10-22T22:00:00.000Z",
});

const order = (overrides: Partial<OrderHeader> = {}): OrderHeader =>
  ({
    id: "shopify-order-1",
    orderNumber: "#1801",
    commercialStage: "LEAD",
    externalSource: "shopify",
    currency: "PEN",
    status: "PENDIENTE",
    customer: {
      id: "customer-1",
      fullName: "María Pérez",
      documentNumber: "12345678",
      reference: "Portón azul",
    },
    items: [
      { productName: "Producto A", quantity: 1, unitPrice: "59.90", subtotal: "59.90" },
      { productName: "Producto B", quantity: 2, unitPrice: "10.00", subtotal: "20.00" },
    ],
    subtotal: "67.71",
    taxTotal: "12.19",
    shippingTotal: "10.00",
    discountTotal: "0.00",
    grandTotal: "89.90",
    payments: [],
    created_at: "2026-10-22T22:00:00.000Z",
    ...overrides,
  }) as OrderHeader;

describe("pending order detail", () => {
  it("keeps pending and rejected Shopify advances out of the collected total", () => {
    const source = order({
      payments: [payment("20.00", "PENDING"), payment("15.00", "LOST")],
    });

    const detail = buildPendingOrderDetail(source);

    expect(detail.totals).toEqual({
      productsTotal: 79.9,
      taxTotal: 12.19,
      shippingTotal: 10,
      discountTotal: 0,
      grandTotal: 89.9,
      totalPaid: 0,
      pendingAmount: 89.9,
    });
    expect(detail.payments.map(({ status }) => status)).toEqual(["PENDING", "LOST"]);
    expect(source.payments[0]).toMatchObject({ amount: "20.00", status: "PENDING" });
    expect(source.grandTotal).toBe("89.90");
  });

  it("deducts only approved advances and rounds the remaining collection to cents", () => {
    const detail = buildPendingOrderDetail(order({
      grandTotal: "100.10",
      payments: [payment("20.20", "PAID"), payment("0.10", "PAID"), payment("10", "PENDING")],
    }));

    expect(detail.totals.totalPaid).toBe(20.3);
    expect(detail.totals.pendingAmount).toBe(79.8);
    expect(detail.totals.grandTotal).toBe(100.1);
  });

  it("never shows a negative collection after an approved overpayment", () => {
    const detail = buildPendingOrderDetail(order({ payments: [payment("100", "PAID")] }));

    expect(detail.totals.totalPaid).toBe(100);
    expect(detail.totals.pendingAmount).toBe(0);
  });

  it("preserves the existing collection rule for a transferred quotation advance", () => {
    const detail = buildPendingOrderDetail(order({
      externalSource: "quotation",
      payments: [payment("20", "PENDING", "quotation:advance-1")],
    }));

    expect(detail.totals.totalPaid).toBe(0);
    expect(detail.totals.pendingAmount).toBe(69.9);
    expect(detail.payments[0].status).toBe("PENDING");
  });

  it("uses saved CC customer fields and omits courier data from the pending detail", () => {
    const detail = buildPendingOrderDetail(order({
      dniCliente: "87654321",
      referenciaEntrega: "Entrada lateral",
      shippingKey: "sensitive-key",
      shippingCode: "sensitive-code",
      externalTrackingNumber: "tracking-1",
      shippingOffice: "Oficina courier",
    }));

    expect(detail.customer).toMatchObject({ dni: "87654321", reference: "Entrada lateral" });
    expect(detail).not.toHaveProperty("shippingKey");
    expect(detail).not.toHaveProperty("shippingCode");
    expect(detail).not.toHaveProperty("externalTrackingNumber");
    expect(detail).not.toHaveProperty("shippingOffice");
    expect(buildPendingOrderDetail(order()).customer).toMatchObject({
      dni: "12345678", reference: "Portón azul",
    });
  });

  it("renders incomplete numeric fields as zero without NaN in the detail", () => {
    const detail = buildPendingOrderDetail(order({
      grandTotal: "invalid",
      taxTotal: undefined,
      shippingTotal: "",
      discountTotal: undefined,
      items: [{ productName: "Producto incompleto", quantity: 1, subtotal: "bad" }] as OrderHeader["items"],
      payments: [payment("invalid", "PAID")],
    }));

    expect(Object.values(detail.totals)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(detail.items[0]).toMatchObject({ unitPrice: 0, subtotal: 0, discountAmount: 0 });
    expect(detail.payments[0].amount).toBe(0);
  });
});
