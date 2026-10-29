import { deliveryPaymentBlockReason, operationalStatus, orderFinancialState, receiptFinancialState } from "../orderState";

it("normalizes legacy payment status without inferring preparation", () => {
  expect(operationalStatus("PAGADO")).toBe("PENDIENTE");
  expect(operationalStatus("PREPARADO")).toBe("PREPARADO");
  expect(operationalStatus("EN_ENVIO")).toBe("EN_ENVIO");
});

it("only approved PAID payments remove debt, including quotations", () => {
  const state = orderFinancialState({ grandTotal: "100", payments: [
    { status: "PAID", amount: "20" }, { status: "PENDING", amount: "80" }, { status: "REJECTED", amount: "100" },
  ] });
  expect(state).toMatchObject({ label: "Con saldo", totalPaid: 20, pendingAmount: 80, isPaid: false });
  expect(receiptFinancialState({ totals: { grandTotal: 100, totalPaid: 20 }, payments: [{ status: "PENDING", amount: 80 }] }).pendingAmount).toBe(80);
});

it("uses cents, keeps one real cent as debt and allows a valid zero-total order", () => {
  expect(orderFinancialState({ grandTotal: "99", payments: [{ status: "PAID", amount: "98.99" }] })).toMatchObject({ label: "Con saldo", pendingAmount: 0.01, isPaid: false });
  expect(orderFinancialState({ grandTotal: "0.3", payments: [{ status: "PAID", amount: "0.1" }, { status: "PAID", amount: "0.2" }] })).toMatchObject({ label: "Pagado", pendingAmount: 0, isPaid: true });
  expect(orderFinancialState({ grandTotal: "0", payments: [] }).isPaid).toBe(true);
  expect(orderFinancialState({ grandTotal: "90071992547409.91", payments: [{ status: "PAID", amount: "90071992547409.90" }] })).toMatchObject({ pendingAmount: 0.01, isPaid: false });
});

it.each([
  { grandTotal: "invalid", payments: [] }, { grandTotal: "100" },
  { grandTotal: "100", payments: [{ status: "PAID", amount: "invalid" }] },
  { grandTotal: " ", payments: [] }, { grandTotal: "100.001", payments: [] },
  { grandTotal: "100", payments: [{ status: "PAID", amount: "100.001" }] },
  { grandTotal: "1e2", payments: [{ status: "PAID", amount: "100" }] },
])("fails closed for unavailable financial data %#", (order) => {
  const state = orderFinancialState(order);
  expect(state).toMatchObject({ label: "Pago por verificar", isPaid: false });
  expect(deliveryPaymentBlockReason(state.pendingAmount, "ENTREGADO")).toBeTruthy();
});

it.each(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO"])("allows %s with debt, blocking only delivery", (status) => {
  expect(deliveryPaymentBlockReason(100, status)).toBeNull();
  expect(deliveryPaymentBlockReason(0.01, "ENTREGADO")).toBeTruthy();
  expect(deliveryPaymentBlockReason(0, "ENTREGADO")).toBeNull();
});
