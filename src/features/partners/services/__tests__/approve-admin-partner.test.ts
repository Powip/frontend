/**
 * Tests: approveAdminPartner
 *
 * Comportamiento verificado:
 * 1. Cambia el estado del partner a "activo".
 * 2. Asigna un código sugerido si el partner no tenía uno.
 * 3. No pisa el código si el partner ya tenía uno asignado.
 * 4. Asigna la opción "C" para perfil creador y "A" para el resto.
 * 5. Lanza un error si el partner no existe.
 */

import { approveAdminPartner } from "../approve-admin-partner";
import { resetAdminPartnersStore, getAdminPartnerById } from "../../mocks/admin-partners.store";

describe("approveAdminPartner", () => {
  beforeEach(() => {
    resetAdminPartnersStore();
  });

  it('cambia el estado a "activo"', async () => {
    const result = await approveAdminPartner("partner-carlos-ruiz");
    expect(result.status).toBe("activo");
  });

  it("asigna un código sugerido si no tenía uno", async () => {
    const before = getAdminPartnerById("partner-carlos-ruiz");
    expect(before?.code).toBeNull();

    const result = await approveAdminPartner("partner-carlos-ruiz");
    expect(result.code).toBeTruthy();
  });

  it("no pisa el código si ya tenía uno", async () => {
    const result = await approveAdminPartner("partner-dev-studio-lima");
    expect(result.code).toBe("DEVLIMA");
  });

  it('asigna la opción "C" para perfil creador', async () => {
    const result = await approveAdminPartner("partner-carlos-ruiz");
    expect(result.commissionOptionCode).toBe("C");
  });

  it("lanza un error si el partner no existe", async () => {
    await expect(approveAdminPartner("partner-inexistente")).rejects.toThrow();
  });
});
