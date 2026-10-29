import { getPartnerMeApi } from "../../api/partner-me.api";
import { buildAxiosError } from "../../test-utils/axios-error";
import { getPartnerIdentity } from "../get-partner-identity";

jest.mock("../../api/partner-me.api", () => ({
  getPartnerMeApi: jest.fn(),
}));

const mockGetPartnerMeApi = jest.mocked(getPartnerMeApi);

describe("getPartnerIdentity", () => {
  beforeEach(() => {
    mockGetPartnerMeApi.mockReset();
  });

  it("devuelve el perfil mapeado cuando /me responde 200", async () => {
    mockGetPartnerMeApi.mockResolvedValue({
      id: "p",
      status: "ACTIVE",
      displayName: "Partner Demo",
      country: "PE",
      currency: "PEN",
      referralLink: null,
      referralCode: null,
      permissions: ["REFERRALS_READ"],
    });

    await expect(getPartnerIdentity()).resolves.toEqual({
      kind: "partner",
      profile: expect.objectContaining({
        id: "p",
        status: "active",
        permissions: ["REFERRALS_READ"],
      }),
    });
  });

  it("404 se resuelve como cuenta sin perfil de partner", async () => {
    mockGetPartnerMeApi.mockRejectedValue(buildAxiosError(404));

    await expect(getPartnerIdentity()).resolves.toEqual({ kind: "not_partner" });
  });

  it("403 PARTNER_NOT_ACTIVE se resuelve como cuenta no activa", async () => {
    mockGetPartnerMeApi.mockRejectedValue(
      buildAxiosError(403, {
        code: "PARTNER_NOT_ACTIVE",
        message: "",
        correlationId: null,
        details: { status: "SUSPENDED" },
      }),
    );

    await expect(getPartnerIdentity()).resolves.toEqual({
      kind: "not_active",
      status: "suspended",
    });
  });

  it.each([
    ["401", buildAxiosError(401)],
    ["500", buildAxiosError(500)],
    ["error de red", buildAxiosError()],
  ])("%s se relanza tal cual, sin datos de reemplazo", async (_label, error) => {
    mockGetPartnerMeApi.mockRejectedValue(error);

    await expect(getPartnerIdentity()).rejects.toBe(error);
  });
});
