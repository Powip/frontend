import { advanceRowsFromSales, advancesAwaitingApproval, guideOrderBalance } from "../guideOrderBalance";

describe("guideOrderBalance", () => {
  it("resta del total solo los adelantos aprobados (PAID)", () => {
    const balance = guideOrderBalance({
      grandTotal: 179,
      payments: [{ amount: 20, status: "PAID" }],
    });

    expect(balance).toEqual({
      total: 179,
      paid: 20,
      awaitingApproval: 0,
      pending: 159,
      pendingAfterApproval: 159,
    });
  });

  it("un adelanto sin aprobar (PENDING) NO reduce lo que cobra el courier, pero se informa aparte", () => {
    const balance = guideOrderBalance({
      grandTotal: 179,
      payments: [{ amount: 20, status: "PENDING" }],
    });

    expect(balance.paid).toBe(0);
    expect(balance.pending).toBe(179);
    expect(balance.awaitingApproval).toBe(20);
    expect(balance.pendingAfterApproval).toBe(159);
  });

  it("combina aprobados y sin aprobar sin contarlos dos veces", () => {
    const balance = guideOrderBalance({
      grandTotal: 100,
      payments: [
        { amount: 20, status: "PAID" },
        { amount: 10, status: "PENDING" },
      ],
    });

    expect(balance.pending).toBe(80);
    expect(balance.awaitingApproval).toBe(10);
    expect(balance.pendingAfterApproval).toBe(70);
  });

  it("ignora pagos perdidos (LOST)", () => {
    const balance = guideOrderBalance({
      grandTotal: 100,
      payments: [{ amount: 30, status: "LOST" }],
    });

    expect(balance).toMatchObject({ paid: 0, awaitingApproval: 0, pending: 100 });
  });

  it("acepta montos decimales como texto (así los entrega el backend) y prefiere totals.grandTotal", () => {
    const balance = guideOrderBalance({
      grandTotal: 999,
      totals: { grandTotal: "279.00" },
      payments: [{ amount: "20.00", status: "PAID" }],
    });

    expect(balance.total).toBe(279);
    expect(balance.pending).toBe(259);
  });

  it("nunca devuelve saldos negativos ni un 'por aprobar' mayor al saldo", () => {
    const sobrepagado = guideOrderBalance({
      grandTotal: 50,
      payments: [{ amount: 80, status: "PAID" }],
    });
    expect(sobrepagado.pending).toBe(0);

    const cubierto = guideOrderBalance({
      grandTotal: 50,
      payments: [{ amount: 90, status: "PENDING" }],
    });
    expect(cubierto.awaitingApproval).toBe(50);
    expect(cubierto.pendingAfterApproval).toBe(0);
  });

  it("no deja residuos de coma flotante: S/ 100.01 pagado con 29.94 + 70.07 queda en 0 exacto", () => {
    const balance = guideOrderBalance({
      grandTotal: 100.01,
      payments: [
        { amount: 29.94, status: "PAID" },
        { amount: 70.07, status: "PAID" },
      ],
    });

    expect(balance.pending).toBe(0);
    expect(balance.paid).toBe(100.01);
    expect(balance.pendingAfterApproval).toBe(0);
  });

  it("tolera pedidos sin pagos ni total", () => {
    expect(guideOrderBalance({})).toEqual({
      total: 0,
      paid: 0,
      awaitingApproval: 0,
      pending: 0,
      pendingAfterApproval: 0,
    });
    expect(guideOrderBalance({ grandTotal: 40, payments: null }).pending).toBe(40);
  });
});

describe("advancesAwaitingApproval", () => {
  const order = (id: string, grandTotal: number, payments: Array<{ amount: number; status: string }>) =>
    ({ id, orderNumber: `ORD-${id}`, grandTotal, payments });

  it("lista solo los pedidos con un adelanto sin aprobar, con lo que cobraría el courier", () => {
    const rows = advancesAwaitingApproval([
      order("1", 179, [{ amount: 20, status: "PENDING" }]),
      order("2", 100, [{ amount: 100, status: "PAID" }]),
      order("3", 279, [{ amount: 20, status: "PAID" }, { amount: 30, status: "PENDING" }]),
      order("4", 50, []),
    ]);

    expect(rows).toEqual([
      { id: "1", orderNumber: "ORD-1", awaitingApproval: 20, pending: 179 },
      { id: "3", orderNumber: "ORD-3", awaitingApproval: 30, pending: 259 },
    ]);
  });

  it("devuelve vacío cuando nadie tiene adelantos pendientes", () => {
    expect(advancesAwaitingApproval([order("1", 50, [{ amount: 50, status: "PAID" }])])).toEqual([]);
    expect(advancesAwaitingApproval([])).toEqual([]);
  });
});

describe("advanceRowsFromSales", () => {
  it("arma las filas desde los montos que ya trae cada venta y descarta las que no tienen adelanto pendiente", () => {
    const rows = advanceRowsFromSales([
      { id: "1", orderNumber: "ORD-1", awaitingApprovalAmount: 20, collectAmount: 179 },
      { id: "2", orderNumber: "ORD-2", awaitingApprovalAmount: 0, collectAmount: 100 },
      { id: "3", orderNumber: "ORD-3" },
    ]);

    expect(rows).toEqual([{ id: "1", orderNumber: "ORD-1", awaitingApproval: 20, pending: 179 }]);
  });

  it("no inventa montos si falta el cobro: queda en 0 en vez de NaN", () => {
    const [row] = advanceRowsFromSales([{ id: "1", orderNumber: "ORD-1", awaitingApprovalAmount: 20 }]);

    expect(row.pending).toBe(0);
  });
});
