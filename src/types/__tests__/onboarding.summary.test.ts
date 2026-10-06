/**
 * Tests: summarizeSubscription (types/onboarding.ts)
 *
 * Comportamiento verificado:
 * 1. Sin add-ons: el total es el precio del plan.
 * 2. Con uno y con varios add-ons: suma sus precios del catálogo, en el orden
 *    del catálogo (no en el de selección).
 * 3. Plan anual: usa annualAmount del add-on (o 12 × amount si falta).
 * 4. Ignora ids que no están en el catálogo.
 */
import { summarizeSubscription, type BackendAddOn } from "../onboarding";

const addOn = (id: string, code: string, amount: number, annualAmount?: number): BackendAddOn => ({
  id,
  code,
  name: code,
  amount,
  annualAmount,
  currency: "PEN",
});

const catalog = [
  addOn("c", "courier", 29, 348),
  addOn("m", "marketplace", 29),
  addOn("s", "sunat", 29, 348),
];

describe("summarizeSubscription", () => {
  it("sin add-ons devuelve el precio del plan", () => {
    expect(summarizeSubscription(189, catalog, [], false)).toEqual({
      addOns: [],
      addOnsTotal: 0,
      total: 189,
    });
  });

  it("con un add-on: Medium S/189 + Courier S/29 = S/218", () => {
    const summary = summarizeSubscription(189, catalog, ["c"], false);

    expect(summary.addOns.map((a) => [a.addOn.code, a.price])).toEqual([["courier", 29]]);
    expect(summary.addOnsTotal).toBe(29);
    expect(summary.total).toBe(218);
  });

  it("con varios add-ons suma todos en el orden del catálogo", () => {
    const summary = summarizeSubscription(189, catalog, ["s", "c", "m"], false);

    expect(summary.addOns.map((a) => a.addOn.code)).toEqual(["courier", "marketplace", "sunat"]);
    expect(summary.addOnsTotal).toBe(87);
    expect(summary.total).toBe(276);
  });

  it("en plan anual usa el monto anual del add-on", () => {
    const summary = summarizeSubscription(1399, catalog, ["c", "m"], true);

    expect(summary.addOns.map((a) => a.price)).toEqual([348, 348]);
    expect(summary.total).toBe(1399 + 696);
  });

  it("ignora ids que no están en el catálogo", () => {
    expect(summarizeSubscription(99, catalog, ["x"], false).total).toBe(99);
  });
});
