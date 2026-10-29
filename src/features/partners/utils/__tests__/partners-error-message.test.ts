import type { PartnersRequestError } from "../../models/partners-request-error";
import { getPartnersErrorMessage } from "../partners-error-message";

function buildError(overrides: Partial<PartnersRequestError>): PartnersRequestError {
  return {
    kind: "unknown",
    status: null,
    code: null,
    message: null,
    details: {},
    correlationId: null,
    retryAfterMs: null,
    ...overrides,
  };
}

const FALLBACK = "Algo salió mal.";

describe("getPartnersErrorMessage", () => {
  it("401 pide volver a iniciar sesión", () => {
    expect(getPartnersErrorMessage(buildError({ kind: "unauthorized" }), FALLBACK)).toMatch(
      /volvé a iniciar sesión/i,
    );
  });

  it("403 explica que hay que volver a iniciar sesión para recibir permisos nuevos", () => {
    const message = getPartnersErrorMessage(buildError({ kind: "forbidden" }), FALLBACK);

    expect(message).toMatch(/permiso/i);
    expect(message).toMatch(/iniciarla para recibirlos/i);
  });

  it("429 informa el tiempo de espera", () => {
    expect(
      getPartnersErrorMessage(buildError({ kind: "rate_limited", retryAfterMs: 30_000 }), FALLBACK),
    ).toMatch(/30 s/);
    expect(
      getPartnersErrorMessage(
        buildError({ kind: "rate_limited", retryAfterMs: 120_000 }),
        FALLBACK,
      ),
    ).toMatch(/2 min/);
  });

  it.each([
    ["PARTNER_AUTH_ACCOUNT_NOT_FOUND", /registrarse primero/i],
    ["PARTNER_AUTH_ACCOUNT_INACTIVE", /inactiva/i],
    ["PARTNER_AUTH_ACCOUNT_AMBIGUOUS", /más de una cuenta/i],
    ["PARTNER_IDENTITY_CONFLICT", /ya está vinculada/i],
    ["APPLICATION_STATE_CONFLICT", /ya no está pendiente/i],
    ["IDEMPOTENCY_CONFLICT", /otros datos/i],
  ])("traduce el código %s", (code, expected) => {
    expect(getPartnersErrorMessage(buildError({ kind: "conflict", code }), FALLBACK)).toMatch(
      expected,
    );
  });

  it("503 del servicio de identidad aclara que la solicitud no se aprobó", () => {
    expect(
      getPartnersErrorMessage(
        buildError({ kind: "unavailable", code: "PARTNER_IDENTITY_SERVICE_UNAVAILABLE" }),
        FALLBACK,
      ),
    ).toMatch(/no se aprobó/i);
  });

  it("usa el fallback para errores desconocidos", () => {
    expect(getPartnersErrorMessage(buildError({}), FALLBACK)).toBe(FALLBACK);
  });
});
