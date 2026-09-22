/**
 * Tests: getRecentReferrals
 *
 * Comportamiento verificado:
 * 1. Respeta el `limit` recibido, devolviendo como máximo esa cantidad de referidos.
 * 2. Con un `limit` mayor al total de mocks disponibles, devuelve todos sin repetir ni fallar.
 * 3. Con `limit` 0, devuelve un array vacío.
 * 4. Cada referido devuelto tiene un `id` único.
 */

import { getRecentReferrals } from "../get-recent-referrals";
import { PARTNER_REFERRALS_MOCK } from "../../mocks/partner-referrals.mock";

describe("getRecentReferrals", () => {
  it("devuelve como máximo `limit` referidos", async () => {
    const result = await getRecentReferrals(2);
    expect(result).toHaveLength(2);
  });

  it("devuelve todos los referidos disponibles si el límite es mayor al total", async () => {
    const result = await getRecentReferrals(999);
    expect(result).toHaveLength(PARTNER_REFERRALS_MOCK.length);
  });

  it("devuelve un array vacío si el límite es 0", async () => {
    const result = await getRecentReferrals(0);
    expect(result).toEqual([]);
  });

  it("cada referido tiene un id único", async () => {
    const result = await getRecentReferrals(PARTNER_REFERRALS_MOCK.length);
    const ids = result.map((referral) => referral.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
