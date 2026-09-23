/**
 * Tests: inviteAdminPartner
 *
 * Comportamiento verificado:
 * 1. Crea un partner nuevo en estado "por_aprobar".
 * 2. El partner nuevo no tiene código, opción ni MRR todavía.
 * 3. El partner nuevo queda disponible en el store (listAdminPartners lo incluye).
 * 4. Cada invitación genera un id distinto.
 */

import { inviteAdminPartner } from "../invite-admin-partner";
import { listAdminPartners, resetAdminPartnersStore } from "../../mocks/admin-partners.store";

describe("inviteAdminPartner", () => {
  beforeEach(() => {
    resetAdminPartnersStore();
  });

  it('crea un partner en estado "por_aprobar"', async () => {
    const result = await inviteAdminPartner({
      name: "Nuevo Partner",
      email: "nuevo@partner.com",
      profile: "dev",
      suggestedOptionCode: "B",
    });

    expect(result.status).toBe("por_aprobar");
  });

  it("el partner nuevo no tiene código ni opción todavía", async () => {
    const result = await inviteAdminPartner({
      name: "Nuevo Partner",
      email: "nuevo@partner.com",
      profile: "dev",
      suggestedOptionCode: "B",
    });

    expect(result.code).toBeNull();
    expect(result.commissionOptionCode).toBeNull();
    expect(result.mrr).toBe(0);
  });

  it("el partner nuevo queda en el store", async () => {
    const before = listAdminPartners().length;
    await inviteAdminPartner({
      name: "Nuevo Partner",
      email: "nuevo@partner.com",
      profile: "agencia",
      suggestedOptionCode: "A",
    });

    expect(listAdminPartners().length).toBe(before + 1);
  });

  it("cada invitación genera un id distinto", async () => {
    const first = await inviteAdminPartner({
      name: "Partner A",
      email: "a@partner.com",
      profile: "agencia",
      suggestedOptionCode: "A",
    });
    const second = await inviteAdminPartner({
      name: "Partner B",
      email: "b@partner.com",
      profile: "agencia",
      suggestedOptionCode: "A",
    });

    expect(first.id).not.toBe(second.id);
  });
});
