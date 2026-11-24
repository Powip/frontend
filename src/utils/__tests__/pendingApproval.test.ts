import { paymentAttention, pendingApprovalSummary } from "../pendingApproval";

// FEAT-33 A4/D5: un pago enviado y sin validar no es «saldo»: se muestra aparte, con su método.
describe("pendingApprovalSummary", () => {
  test("a Yape proof under review reads «Yape por validar»", () => {
    expect(
      pendingApprovalSummary([
        { status: "PENDING", amount: "199.00", paymentMethod: "YAPE" },
        { status: "LOST", amount: "199.00", paymentMethod: "YAPE" },
      ]),
    ).toEqual({ amount: 199, label: "Yape por validar" });
  });

  test.each([
    ["TRANSFERENCIA", "Transferencia por validar"],
    ["BANCO_NACION", "Banco de la Nación por validar"],
    ["MERCADO_PAGO", "Mercado Pago por validar"],
    ["RARO", "Pago por validar"],
  ])("%s reads «%s»", (paymentMethod, label) => {
    expect(
      pendingApprovalSummary([{ status: "PENDING", amount: 50, paymentMethod }])
        .label,
    ).toBe(label);
  });

  test("several methods add up under «Pagos por validar»", () => {
    expect(
      pendingApprovalSummary([
        { status: "PENDING", amount: "50.10", paymentMethod: "YAPE" },
        { status: "PENDING", amount: "20.20", paymentMethod: "PLIN" },
      ]),
    ).toEqual({ amount: 70.3, label: "Pagos por validar" });
  });

  test("nothing pending, nothing to show", () => {
    expect(
      pendingApprovalSummary([
        { status: "PAID", amount: 10, paymentMethod: "YAPE" },
      ]),
    ).toEqual({ amount: 0, label: null });
    expect(pendingApprovalSummary(undefined)).toEqual({
      amount: 0,
      label: null,
    });
  });
});

describe("paymentAttention (red dot on the $ button)", () => {
  test.each([
    [{ awaitingApproval: 199, debt: 199 }, "review"],
    [{ awaitingApproval: 0, debt: 40 }, "balance"],
    [{ awaitingApproval: 0, debt: 0 }, null],
  ] as const)("%p → %p", (amounts, expected) => {
    expect(paymentAttention(amounts)).toBe(expected);
  });
});
