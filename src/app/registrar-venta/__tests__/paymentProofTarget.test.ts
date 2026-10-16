import { resolvePaymentProofTarget } from "../paymentProofTarget";

describe("resolvePaymentProofTarget", () => {
  it("recupera el pago de una venta nueva aunque Finanzas ya lo aprobó", () => {
    expect(resolvePaymentProofTarget(
      [{ id: "new-payment", status: "PAID" }],
      { orderId: "order-1", previousPaymentIds: [] },
    )).toBe("new-payment");
  });

  it("no reutiliza los pagos anteriores cuando se guarda un nuevo adelanto", () => {
    expect(resolvePaymentProofTarget(
      [{ id: "old-payment", status: "PAID" }, { id: "new-payment", status: "PENDING" }],
      { orderId: "order-1", previousPaymentIds: ["old-payment"] },
    )).toBe("new-payment");
  });

  it("no adivina el pago cuando hay varios candidatos nuevos", () => {
    expect(resolvePaymentProofTarget(
      [{ id: "payment-1", status: "PENDING" }, { id: "payment-2", status: "PENDING" }],
      { orderId: "order-1", previousPaymentIds: [] },
    )).toBeUndefined();
  });

  it("conserva el destino elegido y rechaza pagos perdidos", () => {
    const context = { orderId: "order-1", paymentId: "chosen", previousPaymentIds: ["chosen"] };
    expect(resolvePaymentProofTarget(
      [{ id: "other", status: "PENDING" }, { id: "chosen", status: "PAID" }], context,
    )).toBe("chosen");
    expect(resolvePaymentProofTarget([{ id: "chosen", status: "LOST" }], context)).toBeUndefined();
  });
});
