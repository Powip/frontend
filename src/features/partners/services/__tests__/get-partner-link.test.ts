/**
 * Tests: getPartnerLink
 *
 * Comportamiento verificado:
 * 1. Resuelve con los datos del link/código del mock.
 */

import { getPartnerLink } from "../get-partner-link";
import { PARTNER_LINK_MOCK } from "../../mocks/partner-link.mock";

describe("getPartnerLink", () => {
  it("resuelve con el PartnerLink mockeado", async () => {
    const result = await getPartnerLink();
    expect(result).toEqual(PARTNER_LINK_MOCK);
  });
});
