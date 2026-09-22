import { getCustomerReceiptBalance } from "../customerReceiptBalance";

describe("getCustomerReceiptBalance", () => {
  it("descuenta un adelanto pendiente del monto comunicado al cliente", () => {
    expect(
      getCustomerReceiptBalance({
        grandTotal: 89,
        totalPaid: 0,
        totalPendingApproval: 20,
      }),
    ).toEqual({
      grandTotal: 89,
      confirmedAdvance: 0,
      pendingAdvance: 20,
      registeredAdvance: 20,
      amountToCollect: 69,
    });
  });

  it("descuenta un adelanto aprobado", () => {
    expect(
      getCustomerReceiptBalance({
        grandTotal: "89",
        totalPaid: "20",
        totalPendingApproval: 0,
      }).amountToCollect,
    ).toBe(69);
  });

  it("deriva el adelanto pendiente desde payments para respuestas antiguas", () => {
    expect(
      getCustomerReceiptBalance(
        { grandTotal: 89, totalPaid: 0 },
        [{ amount: 20, status: "PENDING" }],
      ).amountToCollect,
    ).toBe(69);
  });

  it("no descuenta pagos rechazados", () => {
    expect(
      getCustomerReceiptBalance(
        { grandTotal: 89, totalPaid: 0 },
        [{ amount: 20, status: "LOST" }],
      ).amountToCollect,
    ).toBe(89);
  });

  it("mantiene el total completo cuando no hay adelanto", () => {
    expect(
      getCustomerReceiptBalance({ grandTotal: 89, totalPaid: 0 })
        .amountToCollect,
    ).toBe(89);
  });

  it("nunca produce un monto por cobrar negativo", () => {
    expect(
      getCustomerReceiptBalance({
        grandTotal: 89,
        totalPaid: 80,
        totalPendingApproval: 20,
      }).amountToCollect,
    ).toBe(0);
  });
});
