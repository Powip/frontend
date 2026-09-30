import type { PartnerProfile } from "../../models/partner-profile";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  getRequiredPartnerPermission,
  hasPartnerPermission,
  isPartnerAdminPath,
  resolvePartnerAccess,
} from "../partner-access";

const ACTIVE_PROFILE: PartnerProfile = {
  id: "p",
  status: "active",
  displayName: "Partner Demo",
  country: "PE",
  currency: "PEN",
  referralLink: null,
  referralCode: null,
  permissions: ["REFERRALS_READ"],
};

describe("resolvePartnerAccess", () => {
  it("sin datos ni error está cargando", () => {
    expect(resolvePartnerAccess({ data: undefined, error: null })).toEqual({ kind: "loading" });
  });

  it("un perfil activo habilita el portal", () => {
    expect(
      resolvePartnerAccess({ data: { kind: "partner", profile: ACTIVE_PROFILE }, error: null }),
    ).toEqual({ kind: "active", profile: ACTIVE_PROFILE });
  });

  it("not_partner muestra ausencia de perfil", () => {
    expect(resolvePartnerAccess({ data: { kind: "not_partner" }, error: null })).toEqual({
      kind: "no_profile",
    });
  });

  it("un perfil 200 con status suspended bloquea el portal", () => {
    expect(
      resolvePartnerAccess({
        data: { kind: "partner", profile: { ...ACTIVE_PROFILE, status: "suspended" } },
        error: null,
      }),
    ).toEqual({ kind: "suspended" });
  });

  it("403 PARTNER_NOT_ACTIVE con status suspended bloquea el portal", () => {
    expect(
      resolvePartnerAccess({ data: { kind: "not_active", status: "suspended" }, error: null }),
    ).toEqual({ kind: "suspended" });
  });

  it.each(["pending", "rejected", "unknown"] as const)(
    "un estado no activo %s se muestra como inactive",
    (status) => {
      expect(resolvePartnerAccess({ data: { kind: "not_active", status }, error: null })).toEqual({
        kind: "inactive",
        status,
      });
    },
  );

  it('un 403 PARTNER_NOT_ACTIVE que dice "active" no se trata como activo', () => {
    expect(
      resolvePartnerAccess({ data: { kind: "not_active", status: "active" }, error: null }),
    ).toEqual({ kind: "inactive", status: "unknown" });
  });

  it("un error de red es error recuperable, con correlationId si vino", () => {
    expect(resolvePartnerAccess({ data: undefined, error: buildAxiosError() })).toEqual({
      kind: "error",
      correlationId: null,
    });
    expect(
      resolvePartnerAccess({
        data: undefined,
        error: buildAxiosError(503, { code: "UNAVAILABLE", correlationId: "corr-1" }),
      }),
    ).toEqual({ kind: "error", correlationId: "corr-1" });
  });

  it("un 401 se distingue del error de red", () => {
    expect(resolvePartnerAccess({ data: undefined, error: buildAxiosError(401) })).toEqual({
      kind: "unauthorized",
    });
  });

  it("si un refetch falla conserva la última identidad conocida", () => {
    expect(
      resolvePartnerAccess({
        data: { kind: "partner", profile: ACTIVE_PROFILE },
        error: buildAxiosError(),
      }),
    ).toEqual({ kind: "active", profile: ACTIVE_PROFILE });
  });
});

describe("hasPartnerPermission", () => {
  it("solo concede los permisos presentes en el perfil", () => {
    expect(hasPartnerPermission(ACTIVE_PROFILE, "REFERRALS_READ")).toBe(true);
    expect(hasPartnerPermission(ACTIVE_PROFILE, "REFERRALS_CREATE")).toBe(false);
  });
});

describe("getRequiredPartnerPermission", () => {
  test.each([
    ["/partners/referidos", "REFERRALS_READ"],
    ["/partners/referidos/123", "REFERRALS_READ"],
    ["/partners/comisiones", "COMMISSIONS_READ"],
    ["/partners/pagos", "PAYOUTS_READ"],
    ["/partners", null],
    ["/partners/link", null],
    ["/partners/plan", null],
    ["/partners/referidos-otros", null],
  ])("%s requiere %s", (pathname, expected) => {
    expect(getRequiredPartnerPermission(pathname)).toBe(expected);
  });
});

describe("isPartnerAdminPath", () => {
  test.each([
    ["/partners/admin", true],
    ["/partners/admin/partners/1", true],
    ["/partners/administrador", false],
    ["/partners", false],
  ])("%s → %s", (pathname, expected) => {
    expect(isPartnerAdminPath(pathname)).toBe(expected);
  });
});
