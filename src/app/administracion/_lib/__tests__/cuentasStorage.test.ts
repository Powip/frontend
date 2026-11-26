import { saldoEnCallePorCourier, totalCuentas } from "../cuentasStorage";

describe("cuentas por cobrar", () => {
  it("junta las grafías de un courier sin distinguir mayúsculas ni espacios y muestra la más usada", () => {
    const grupos = saldoEnCallePorCourier([
      { courier: "Shalom", pedidos: 2, saldo: 100.1, conSaldo: 2 },
      { courier: "SHALOM  ", pedidos: 1, saldo: 30.2, conSaldo: 1 },
      { courier: "Olva", pedidos: 1, saldo: 0, conSaldo: 0 },
      { courier: null, pedidos: 1, saldo: 40, conSaldo: 1 },
    ]);
    expect(grupos).toEqual([
      { clave: "SHALOM", courier: "Shalom", pedidos: 3, conSaldo: 3, saldo: 130.3 },
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
