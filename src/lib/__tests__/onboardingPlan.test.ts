import { resolveOnboardingPlanName } from "../onboardingPlan";
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
