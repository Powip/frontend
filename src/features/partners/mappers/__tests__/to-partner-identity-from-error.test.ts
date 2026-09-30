import { buildAxiosError } from "../../test-utils/axios-error";
import {
  getHttpStatus,
  toPartnerIdentityFromError,
  toPartnersApiError,
} from "../to-partner-identity-from-error";

const NOT_ACTIVE_BODY = {
  code: "PARTNER_NOT_ACTIVE",
  message: "Partner is not active.",
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  details: { status: "SUSPENDED" },
};

describe("toPartnerIdentityFromError", () => {
  it("404 significa que la cuenta no tiene perfil de partner", () => {
    expect(toPartnerIdentityFromError(buildAxiosError(404))).toEqual({ kind: "not_partner" });
  });

  it("403 PARTNER_NOT_ACTIVE usa el estado de details", () => {
    expect(toPartnerIdentityFromError(buildAxiosError(403, NOT_ACTIVE_BODY))).toEqual({
      kind: "not_active",
      status: "suspended",
    });
  });

  it("403 PARTNER_NOT_ACTIVE acepta el estado en la vista limitada de primer nivel", () => {
    const body = { ...NOT_ACTIVE_BODY, details: {}, status: "APPLIED" };

    expect(toPartnerIdentityFromError(buildAxiosError(403, body))).toEqual({
      kind: "not_active",
      status: "pending",
    });
  });

  it("403 PARTNER_NOT_ACTIVE sin estado informado queda como unknown", () => {
    const body = { ...NOT_ACTIVE_BODY, details: {} };

    expect(toPartnerIdentityFromError(buildAxiosError(403, body))).toEqual({
      kind: "not_active",
      status: "unknown",
    });
  });

  it("otro 403 no concede acceso y se trata como cuenta sin perfil de partner", () => {
    const body = { code: "FORBIDDEN", message: "", correlationId: null, details: {} };

    expect(toPartnerIdentityFromError(buildAxiosError(403, body))).toEqual({ kind: "not_partner" });
    expect(toPartnerIdentityFromError(buildAxiosError(403))).toEqual({ kind: "not_partner" });
  });

  it.each([
    ["401", buildAxiosError(401)],
    ["500", buildAxiosError(500)],
    ["503", buildAxiosError(503)],
    ["error de red", buildAxiosError()],
    ["error no HTTP", new Error("boom")],
  ])("%s no se convierte en identidad: sigue siendo un error", (_label, error) => {
    expect(toPartnerIdentityFromError(error)).toBeNull();
  });
});

describe("toPartnersApiError", () => {
  it("lee el sobre de error común del contrato", () => {
    expect(toPartnersApiError(buildAxiosError(403, NOT_ACTIVE_BODY))).toEqual(NOT_ACTIVE_BODY);
  });

  it("devuelve null si el cuerpo no trae code", () => {
    expect(toPartnersApiError(buildAxiosError(502, "<html>Bad gateway</html>"))).toBeNull();
    expect(toPartnersApiError(buildAxiosError())).toBeNull();
    expect(toPartnersApiError(new Error("boom"))).toBeNull();
  });

  it("normaliza campos opcionales ausentes", () => {
    expect(toPartnersApiError(buildAxiosError(500, { code: "INTERNAL" }))).toEqual({
      code: "INTERNAL",
      message: "",
      correlationId: null,
      details: {},
    });
  });
});

describe("getHttpStatus", () => {
  it("devuelve el status de la respuesta o null si no hubo respuesta", () => {
    expect(getHttpStatus(buildAxiosError(401))).toBe(401);
    expect(getHttpStatus(buildAxiosError())).toBeNull();
    expect(getHttpStatus(new Error("boom"))).toBeNull();
  });
});
