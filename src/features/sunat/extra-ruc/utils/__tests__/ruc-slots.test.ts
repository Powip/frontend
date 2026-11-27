import type { ExtraRucSummary } from "@/features/sunat/extra-ruc/models/extra-ruc";
import {
  countActiveIssuers,
  formatSoles,
  hasFreeRucSlot,
} from "@/features/sunat/extra-ruc/utils/ruc-slots";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

function profile(isActive: boolean): SunatProfile {
  return { id: `p-${Math.random()}`, isActive } as SunatProfile;
}

function summary(overrides: Partial<ExtraRucSummary>): ExtraRucSummary {
  return {
    includedRucs: 1,
    extraRucsPaid: 0,
    renewingRucs: 0,
    maxRucs: 1,
    unlimited: false,
    pricePerRuc: 30,
    monthlyExtraTotal: 0,
    currency: "PEN",
    purchases: [],
    ...overrides,
  };
}

describe("ruc-slots", () => {
  it("los RUC desactivados no gastan cupo", () => {
    expect(countActiveIssuers([profile(true), profile(false), profile(false)])).toBe(1);
  });

  it("con 1 RUC activo y cupo 1 no hay lugar libre; con cupo 2 sí", () => {
    const profiles = [profile(true)];

    expect(hasFreeRucSlot(summary({ maxRucs: 1 }), profiles)).toBe(false);
    expect(hasFreeRucSlot(summary({ maxRucs: 2, extraRucsPaid: 1 }), profiles)).toBe(true);
  });

  it("4 RUC guardados pero solo 1 activo y cupo 2: hay lugar para activar uno", () => {
    const profiles = [profile(true), profile(false), profile(false), profile(false)];

    expect(hasFreeRucSlot(summary({ maxRucs: 2, extraRucsPaid: 1 }), profiles)).toBe(true);
  });

  it("una empresa sin límite siempre tiene lugar", () => {
    expect(hasFreeRucSlot(summary({ unlimited: true }), [profile(true), profile(true)])).toBe(true);
  });

  it("sin resumen no se sabe (lo decide el servidor)", () => {
    expect(hasFreeRucSlot(undefined, [profile(true)])).toBeNull();
  });

  it("formatea los soles sin decimales cuando son enteros", () => {
    expect(formatSoles(30)).toBe("30");
    expect(formatSoles(29.5)).toBe("29.50");
  });
});
