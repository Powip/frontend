/**
 * Tests: getReferrals
 *
 * Comportamiento verificado:
 * 1. Resuelve con la lista completa de referidos del store mock.
 * 2. Refleja los referidos agregados por registerReferral (mismo store en memoria).
 */

import { getReferrals } from "../get-referrals";
import { registerReferral } from "../register-referral";
import { resetPartnerReferralsStore } from "../../mocks/partner-referrals.store";
import { PARTNER_REFERRALS_MOCK } from "../../mocks/partner-referrals.mock";

describe("getReferrals", () => {
  beforeEach(() => {
    resetPartnerReferralsStore();
  });

  it("resuelve con la lista completa de referidos", async () => {
    const result = await getReferrals();
    expect(result).toHaveLength(PARTNER_REFERRALS_MOCK.length);
  });

  it("incluye un referido recién registrado", async () => {
    await registerReferral({
      businessName: "Nuevo Negocio",
      email: "nuevo@negocio.com",
      phone: "",
      planValue: "standard",
    });

    const result = await getReferrals();
    expect(result).toHaveLength(PARTNER_REFERRALS_MOCK.length + 1);
    expect(result[0].businessName).toBe("Nuevo Negocio");
  });
});
