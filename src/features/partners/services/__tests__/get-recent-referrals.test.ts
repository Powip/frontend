/**
 * Tests: getRecentReferrals
 *
 * Comportamiento verificado:
 * 1. Pide la primera página real de GET /me/referrals con el `limit` recibido.
 * 2. Mapea los items del contrato al modelo de referido.
 * 3. Nunca devuelve más de `limit` referidos aunque el backend envíe más.
 * 4. Propaga el error HTTP sin reemplazarlo por un mock.
 */

import { getPartnerReferralsApi } from "../../api/partner-referrals.api";
import { getRecentReferrals } from "../get-recent-referrals";

jest.mock("../../api/partner-referrals.api", () => ({
  getPartnerReferralsApi: jest.fn(),
}));

const mockGetPartnerReferralsApi = jest.mocked(getPartnerReferralsApi);

function buildItem(id: string) {
  return {
    id,
    businessLabel: `Negocio ${id}`,
    origin: "MANUAL" as const,
    state: "UNDER_REVIEW",
    capturedAt: "2026-09-24T15:00:00Z",
    planLabel: "Standard",
  };
}

describe("getRecentReferrals", () => {
  beforeEach(() => {
    mockGetPartnerReferralsApi.mockReset();
  });

  it("pide la primera página con el limit recibido", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({ items: [], nextCursor: null });

    await getRecentReferrals(5);

    expect(mockGetPartnerReferralsApi).toHaveBeenCalledWith(null, 5);
  });

  it("mapea los items del contrato al modelo de referido", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({ items: [buildItem("r1")], nextCursor: null });

    const result = await getRecentReferrals(5);

    expect(result).toEqual([
      expect.objectContaining({
        id: "r1",
        businessName: "Negocio r1",
        origin: "manual",
        status: "en_revision",
        planName: "Standard",
      }),
    ]);
  });

  it("nunca devuelve más de limit referidos", async () => {
    mockGetPartnerReferralsApi.mockResolvedValue({
      items: [buildItem("r1"), buildItem("r2"), buildItem("r3")],
      nextCursor: "next",
    });

    const result = await getRecentReferrals(2);

    expect(result.map((referral) => referral.id)).toEqual(["r1", "r2"]);
  });

  it("propaga el error HTTP", async () => {
    const error = new Error("Request failed with status code 500");
    mockGetPartnerReferralsApi.mockRejectedValue(error);

    await expect(getRecentReferrals(5)).rejects.toBe(error);
  });
});
