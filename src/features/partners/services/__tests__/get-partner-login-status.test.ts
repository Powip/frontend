/**
 * Tests: getPartnerLoginStatus
 *
 * Comportamiento verificado:
 * 1. Consulta GET /me con el token recién emitido, sin depender de Company.
 * 2. Un perfil activo, o uno inactivo o suspendido (403 PARTNER_NOT_ACTIVE), es "partner".
 * 3. 404, o un 403 sin PARTNER_NOT_ACTIVE, es "not_partner".
 * 4. 401, 429, 5xx y errores de red son "unknown": no se interpretan como "no es partner".
 */

import { getPartnerMeWithTokenApi } from "../../api/partner-me.api";
import { buildAxiosError } from "../../test-utils/axios-error";
import { getPartnerLoginStatus } from "../get-partner-login-status";

jest.mock("../../api/partner-me.api", () => ({
  getPartnerMeWithTokenApi: jest.fn(),
}));

const mockGetPartnerMeWithTokenApi = jest.mocked(getPartnerMeWithTokenApi);

function notActive(status: string) {
  return buildAxiosError(403, {
    code: "PARTNER_NOT_ACTIVE",
    message: "Partner is not active.",
    correlationId: "corr-1",
    details: { status },
  });
}

describe("getPartnerLoginStatus", () => {
  beforeEach(() => {
    mockGetPartnerMeWithTokenApi.mockReset();
  });

  it("consulta /me con el token recibido y reconoce a un partner activo", async () => {
    mockGetPartnerMeWithTokenApi.mockResolvedValue({
      id: "p",
      status: "ACTIVE",
      displayName: "Partner Demo",
      country: "PE",
      currency: "PEN",
      referralLink: null,
      referralCode: null,
      permissions: [],
    });

    await expect(getPartnerLoginStatus("token-123")).resolves.toBe("partner");
    expect(mockGetPartnerMeWithTokenApi).toHaveBeenCalledWith("token-123");
  });

  it.each(["SUSPENDED", "APPLIED", "REJECTED"])(
    "un partner con estado %s cuenta como partner para ver su estado en el portal",
    async (status) => {
      mockGetPartnerMeWithTokenApi.mockRejectedValue(notActive(status));

      await expect(getPartnerLoginStatus("token")).resolves.toBe("partner");
    },
  );

  it.each([
    ["404 sin perfil", buildAxiosError(404)],
    ["403 sin código de partner", buildAxiosError(403)],
  ])("%s es not_partner", async (_label, error) => {
    mockGetPartnerMeWithTokenApi.mockRejectedValue(error);

    await expect(getPartnerLoginStatus("token")).resolves.toBe("not_partner");
  });

  it.each([
    ["401", buildAxiosError(401)],
    ["401 con body vacío", buildAxiosError(401, "")],
    ["429", buildAxiosError(429, undefined, { "Retry-After": "30" })],
    ["500", buildAxiosError(500)],
    ["503", buildAxiosError(503)],
    ["error de red", buildAxiosError()],
  ])("%s es unknown, no not_partner", async (_label, error) => {
    mockGetPartnerMeWithTokenApi.mockRejectedValue(error);

    await expect(getPartnerLoginStatus("token")).resolves.toBe("unknown");
  });
});
