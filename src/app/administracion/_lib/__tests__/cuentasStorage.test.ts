import { saldoEnCallePorCourier, totalCuentas } from "../cuentasStorage";

describe("cuentas por cobrar", () => {
  it("agrupa el saldo en calle por courier sin distinguir mayúsculas ni espacios", () => {
    const grupos = saldoEnCallePorCourier([
      { courier: "Shalom", grandTotal: 100, payments: [] },
      { courier: "  SHALOM ", grandTotal: 50, payments: [{ status: "PAID", amount: 20 }] },
      { courier: "Shalom", grandTotal: 10, payments: [{ status: "PENDING", amount: 10 }] },
      { courier: "Olva", grandTotal: 80, payments: [{ status: "PAID", amount: 80 }] },
      { courier: null, grandTotal: 40 },
    ]);
    expect(grupos).toEqual([
      { clave: "SHALOM", courier: "Shalom", pedidos: 3, conSaldo: 3, saldo: 140 },
      { clave: "SIN_COURIER", courier: "Sin courier", pedidos: 1, conSaldo: 1, saldo: 40 },
      { clave: "OLVA", courier: "Olva", pedidos: 1, conSaldo: 0, saldo: 0 },
    ]);
  });

  it("suma montos y tolera listas vacías", () => {
    expect(totalCuentas([{ monto: 10 }, { monto: 2.5 }])).toBe(12.5);
    expect(totalCuentas(undefined)).toBe(0);
    expect(saldoEnCallePorCourier(null)).toEqual([]);
  });
});
