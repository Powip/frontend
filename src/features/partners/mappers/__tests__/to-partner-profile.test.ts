import type { PartnerMeResponseDto } from "../../dto/partner-me-response.dto";
import { toPartnerPermissions, toPartnerProfile, toPartnerStatus } from "../to-partner-profile";

const ME_DTO: PartnerMeResponseDto = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "ACTIVE",
  displayName: "Partner Demo",
  country: "PE",
  currency: "PEN",
  referralLink: "https://www.powip.tech/r/partner-demo-code",
  referralCode: "PARTNERDEMO",
  permissions: ["REFERRALS_READ", "REFERRALS_CREATE", "COMMISSIONS_READ", "PAYOUTS_READ"],
};

describe("toPartnerStatus", () => {
  test.each([
    ["ACTIVE", "active"],
    ["SUSPENDED", "suspended"],
    ["APPLIED", "pending"],
    ["REJECTED", "rejected"],
  ])('mapea "%s" a "%s"', (status, expected) => {
    expect(toPartnerStatus(status)).toBe(expected);
  });

  it.each(["active", "DISABLED", "", "toString", undefined, null, 1])(
    "un valor no contemplado (%p) queda como unknown y nunca como active",
    (status) => {
      expect(toPartnerStatus(status)).toBe("unknown");
    },
  );
});

describe("toPartnerPermissions", () => {
  it("conserva solo los permisos conocidos del contrato, sin duplicados", () => {
    expect(
      toPartnerPermissions(["REFERRALS_READ", "ADMIN", "REFERRALS_READ", "payouts_read", 7]),
    ).toEqual(["REFERRALS_READ"]);
  });

  it.each([undefined, null, "REFERRALS_READ", {}])(
    "si permissions no es un array (%p) no concede ningún permiso",
    (permissions) => {
      expect(toPartnerPermissions(permissions)).toEqual([]);
    },
  );
});

describe("toPartnerProfile", () => {
  it("adapta la respuesta 200 del contrato al modelo del portal", () => {
    expect(toPartnerProfile(ME_DTO)).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      status: "active",
      displayName: "Partner Demo",
      country: "PE",
      currency: "PEN",
      referralLink: "https://www.powip.tech/r/partner-demo-code",
      referralCode: "PARTNERDEMO",
      permissions: ["REFERRALS_READ", "REFERRALS_CREATE", "COMMISSIONS_READ", "PAYOUTS_READ"],
    });
  });

  it("deja referralLink y referralCode en null cuando no vienen", () => {
    const profile = toPartnerProfile({
      ...ME_DTO,
      referralLink: undefined as unknown as null,
      referralCode: undefined as unknown as null,
    });

    expect(profile.referralLink).toBeNull();
    expect(profile.referralCode).toBeNull();
  });

  it("un perfil suspendido conserva su estado para que el portal lo bloquee", () => {
    expect(toPartnerProfile({ ...ME_DTO, status: "SUSPENDED" }).status).toBe("suspended");
  });
});
