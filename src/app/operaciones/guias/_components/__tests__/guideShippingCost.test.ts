import { guideShippingCost } from "../guideShippingCost";

const orders = new Map([
  ["o1", { carrierShippingCost: "12.50" }],
  ["o2", { carrierShippingCost: 10 }],
  ["o3", { carrierShippingCost: null }],
]);

it("usa quotedAmount si está (aunque venga como string)", () => {
  expect(guideShippingCost({ quotedAmount: "30.00", orderIds: ["o1"] }, orders)).toBe(30);
});

it("sin quotedAmount suma el costo de sus pedidos", () => {
  expect(guideShippingCost({ quotedAmount: null, orderIds: ["o1", "o2", "o3", "o-no-cargado"] }, orders)).toBe(22.5);
});

it("quotedAmount en 0 cae a la suma de los pedidos", () => {
  expect(guideShippingCost({ quotedAmount: "0.00", orderIds: ["o2"] }, orders)).toBe(10);
});

it("sin costos devuelve null", () => {
  expect(guideShippingCost({ orderIds: ["o3"] }, orders)).toBeNull();
  expect(guideShippingCost({}, orders)).toBeNull();
});

it("redondea la suma a centavos", () => {
  const floaty = new Map([
    ["a", { carrierShippingCost: 0.1 }],
    ["b", { carrierShippingCost: 0.2 }],
  ]);
  expect(guideShippingCost({ orderIds: ["a", "b"] }, floaty)).toBe(0.3);
});
