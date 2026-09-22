/**
 * Tests: getPartnerResources
 *
 * Comportamiento verificado:
 * 1. Resuelve con la lista completa de recursos del mock.
 * 2. Cada recurso tiene un id único.
 */

import { getPartnerResources } from "../get-partner-resources";
import { PARTNER_RESOURCES_MOCK } from "../../mocks/partner-resources.mock";

describe("getPartnerResources", () => {
  it("resuelve con la lista completa del mock", async () => {
    const result = await getPartnerResources();
    expect(result).toHaveLength(PARTNER_RESOURCES_MOCK.length);
  });

  it("cada recurso tiene un id único", async () => {
    const result = await getPartnerResources();
    const ids = result.map((resource) => resource.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
