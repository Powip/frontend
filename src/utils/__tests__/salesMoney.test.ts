import { formatSalesMoney, groupSaleBalances } from "../salesMoney";

test("sales balance cards preserve PEN, USD and unknown as separate totals", () => {
  expect(
    groupSaleBalances([
      { currency: "PEN", pendingPayment: 30, advancePayment: 20 },
      { currency: "USD", pendingPayment: 8, advancePayment: 2 },
      { currency: null, pendingPayment: 9, advancePayment: 1 },
      { currency: "PEN", pendingPayment: 10, advancePayment: 5 },
    ]),
  ).toEqual([
    { currency: "PEN", pending: 40, paid: 25 },
    { currency: "USD", pending: 8, paid: 2 },
    { currency: null, pending: 9, paid: 1 },
  ]);
  expect(formatSalesMoney(2, "USD")).toBe("USD 2.00");
  expect(formatSalesMoney(2, "PEN")).toBe("S/ 2.00");
  expect(formatSalesMoney(2, null)).toBe("Moneda no informada 2.00");
});
