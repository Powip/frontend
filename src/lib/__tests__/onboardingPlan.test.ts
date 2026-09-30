import {
  counterpartPlan,
  isAnnualPlanName,
  isEnterprisePlan,
  plansForCycle,
  resolveOnboardingPlanName,
} from "../onboardingPlan";
import { addOnPrice } from "@/types/onboarding";

describe("resolveOnboardingPlanName", () => {
  it("mensual deja el nombre tal cual", () => {
    expect(resolveOnboardingPlanName(" Basic ", false)).toBe("Basic");
  });
  it("anual agrega ' Anual' una sola vez", () => {
    expect(resolveOnboardingPlanName("Basic", true)).toBe("Basic Anual");
    expect(resolveOnboardingPlanName("Basic Anual", true)).toBe("Basic Anual");
  });
  it("sin nombre devuelve undefined", () => {
    expect(resolveOnboardingPlanName(undefined, true)).toBeUndefined();
    expect(resolveOnboardingPlanName("  ", false)).toBeUndefined();
  });
});

describe("addOnPrice", () => {
  it("mensual usa amount; anual usa annualAmount (o 12 × amount si no viene)", () => {
    expect(addOnPrice({ amount: 30, annualAmount: 360 }, false)).toBe(30);
    expect(addOnPrice({ amount: 30, annualAmount: 360 }, true)).toBe(360);
    expect(addOnPrice({ amount: 30 }, true)).toBe(360);
  });
});

describe("ciclo de los planes", () => {
  const plans = [
    { id: "m2", name: "Medium", price: 149, durationInDays: 30 },
    { id: "a1", name: "Basic Anual", price: 799, durationInDays: 365 },
    { id: "m1", name: "Basic", price: 99, durationInDays: 30 },
    { id: "e", name: "Enterprise", price: 0, durationInDays: 30 },
    { id: "a2", name: "Medium Anual", price: 1399, durationInDays: 365 },
  ];

  it("isAnnualPlanName reconoce el sufijo 'Anual'", () => {
    expect(isAnnualPlanName("Basic Anual")).toBe(true);
    expect(isAnnualPlanName("basic anual")).toBe(true);
    expect(isAnnualPlanName("Basic")).toBe(false);
    expect(isAnnualPlanName("")).toBe(false);
  });

  it("plansForCycle filtra por ciclo, ordena por precio y deja Enterprise al final", () => {
    expect(plansForCycle(plans, false).map((p) => p.id)).toEqual(["m1", "m2", "e"]);
    expect(plansForCycle(plans, true).map((p) => p.id)).toEqual(["a1", "a2"]);
  });

  it("counterpartPlan busca el mismo plan en el otro ciclo", () => {
    expect(counterpartPlan(plans, "Basic", true)?.id).toBe("a1");
    expect(counterpartPlan(plans, "Medium Anual", false)?.id).toBe("m2");
    expect(counterpartPlan(plans, "Enterprise", true)).toBeUndefined();
  });

  it("isEnterprisePlan", () => {
    expect(isEnterprisePlan("Enterprise")).toBe(true);
    expect(isEnterprisePlan("Basic")).toBe(false);
  });
});
