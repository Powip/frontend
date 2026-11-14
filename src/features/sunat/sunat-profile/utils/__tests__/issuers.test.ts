import type { SunatProfile } from "../../models/sunat-profile";
import {
  findIssuerByRuc,
  getActiveIssuers,
  getDefaultIssuer,
  getIssuerBlockReason,
  getIssuerColor,
  getIssuerShortName,
  ISSUER_COLORS,
} from "../issuers";

const DAY = 24 * 60 * 60 * 1000;

function profile(overrides: Partial<SunatProfile>): SunatProfile {
  return {
    id: "p1",
    companyId: "c1",
    name: "Perfil",
    description: null,
    ruc: "20123456789",
    razonSocial: "EMPRESA S.A.C.",
    countryCode: "PE",
    ubigeo: "150101",
    address: "AV. 1",
    establishmentCode: "0000",
    logoUrl: null,
    certificateSubject: null,
    certificateSerial: null,
    certificateValidFrom: new Date(Date.now() - DAY),
    certificateValidUntil: new Date(Date.now() + 365 * DAY),
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("issuers (multi-RUC)", () => {
  const aranni = profile({
    id: "a",
    ruc: "20609605601",
    razonSocial: "CORPORACIÓN ARANNI S.A.C.",
    isDefault: true,
    createdAt: new Date("2026-01-01"),
  });
  const kunca = profile({
    id: "k",
    ruc: "20611223344",
    razonSocial: "KUNCA BEAUTY E.I.R.L.",
    createdAt: new Date("2026-02-01"),
  });
  const off = profile({
    id: "o",
    ruc: "20618887766",
    razonSocial: "APAGADA S.A.",
    isActive: false,
    createdAt: new Date("2026-03-01"),
  });

  it("lista sólo los RUC activos, con el predeterminado primero", () => {
    expect(getActiveIssuers([kunca, off, aranni]).map((p) => p.id)).toEqual(["a", "k"]);
  });

  it("toma el predeterminado; si no hay, el primer activo", () => {
    expect(getDefaultIssuer([kunca, aranni])?.id).toBe("a");
    expect(getDefaultIssuer([kunca, { ...aranni, isDefault: false }])?.id).toBe("a");
    expect(getDefaultIssuer([off])).toBeUndefined();
  });

  it("busca el emisor por RUC", () => {
    expect(findIssuerByRuc([aranni, kunca], "20611223344")?.id).toBe("k");
    expect(findIssuerByRuc([aranni], "20000000000")).toBeUndefined();
    expect(findIssuerByRuc([aranni], null)).toBeUndefined();
  });

  it("quita la forma societaria del nombre corto", () => {
    expect(getIssuerShortName(aranni)).toBe("CORPORACIÓN ARANNI");
    expect(getIssuerShortName(kunca)).toBe("KUNCA BEAUTY");
  });

  it("asigna un color estable por orden de creación", () => {
    expect(getIssuerColor([kunca, aranni], "a")).toBe(ISSUER_COLORS[0]);
    expect(getIssuerColor([kunca, aranni], "k")).toBe(ISSUER_COLORS[1]);
  });

  it("bloquea RUC inactivos o con certificado vencido", () => {
    expect(getIssuerBlockReason(aranni)).toBeNull();
    expect(getIssuerBlockReason(off)).toBe("inactive");
    expect(
      getIssuerBlockReason(profile({ certificateValidUntil: new Date(Date.now() - DAY) })),
    ).toBe("certificate-expired");
  });
});
