/**
 * Tests: registerReferral
 *
 * Comportamiento verificado:
 * 1. Resuelve con un PartnerReferral nuevo, origen "manual" y status "correo_enviado".
 * 2. El nombre del negocio y el plan elegido quedan reflejados en el resultado.
 * 3. Las comisiones del referido nuevo son null (todavía no generó ninguna).
 * 4. Cada referido registrado tiene un id distinto.
 */

import { registerReferral } from "../register-referral";
import { resetPartnerReferralsStore } from "../../mocks/partner-referrals.store";

describe("registerReferral", () => {
  beforeEach(() => {
    resetPartnerReferralsStore();
  });

  it("crea un referido con origen manual y status correo_enviado", async () => {
    const result = await registerReferral({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "standard",
    });

    expect(result.origin).toBe("manual");
    expect(result.status).toBe("correo_enviado");
  });

  it("refleja el nombre del negocio y la etiqueta del plan elegido", async () => {
    const result = await registerReferral({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "full",
    });

    expect(result.businessName).toBe("Café Norte");
    expect(result.planName).toBe("Full");
  });

  it("las comisiones del referido nuevo son null", async () => {
    const result = await registerReferral({
      businessName: "Café Norte",
      email: "cafe@norte.com",
      phone: "",
      planValue: "basic",
    });

    expect(result.firstMonthCommission).toBeNull();
    expect(result.recurringCommission).toBeNull();
  });

  it("cada referido registrado tiene un id distinto", async () => {
    const first = await registerReferral({
      businessName: "Negocio A",
      email: "a@negocio.com",
      phone: "",
      planValue: "basic",
    });
    const second = await registerReferral({
      businessName: "Negocio B",
      email: "b@negocio.com",
      phone: "",
      planValue: "basic",
    });

    expect(first.id).not.toBe(second.id);
  });
});
