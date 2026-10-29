import { clientPurchaseAmounts } from "../clientPurchaseAmounts";

test("customer totals preserve separate currencies and unknown historical amounts", () => {
  expect(
    clientPurchaseAmounts({
      purchaseAmountsByCurrency: [
        { currency: "PEN", amount: "100.00" },
        { currency: "USD", amount: "20.00" },
        { currency: null, amount: "30.00" },
      ],
      totalPurchaseAmount: null,
    }),
  ).toBe("PEN 100.00 · USD 20.00 · Moneda no informada 30.00");
  expect(
    clientPurchaseAmounts({ totalPurchaseAmount: 55, purchaseCurrency: null }),
  ).toBe("Moneda no informada 55.00");
  expect(
    clientPurchaseAmounts({
      purchaseAmountsByCurrency: [],
      totalPurchaseAmount: 0,
    }),
  ).toBe("—");
});
