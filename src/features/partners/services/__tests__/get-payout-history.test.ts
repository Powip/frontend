/**
 * Tests: getPayoutHistory
 *
 * Comportamiento verificado:
 * 1. Resuelve con la lista completa del mock.
 * 2. Cada entrada tiene un id único.
 */

import { getPayoutHistory } from "../get-payout-history";
import { PAYOUT_HISTORY_MOCK } from "../../mocks/payout-history.mock";

describe("getPayoutHistory", () => {
  it("resuelve con la lista completa del mock", async () => {
    const result = await getPayoutHistory();
    expect(result).toHaveLength(PAYOUT_HISTORY_MOCK.length);
  });

  it("cada entrada tiene un id único", async () => {
    const result = await getPayoutHistory();
    const ids = result.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
