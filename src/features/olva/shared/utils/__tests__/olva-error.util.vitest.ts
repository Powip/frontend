import { describe, expect, it } from "vitest";
import { buildOlvaAxiosError } from "../../test-utils/axios-error";
import {
  getOlvaErrorCode,
  getOlvaErrorMessage,
  getOlvaErrorStatus,
  getOlvaFieldErrors,
  getOlvaRetryAfterSeconds,
  isOlvaNotFoundError,
  OLVA_FALLBACK_ERROR_MESSAGE,
  OLVA_OUTCOME_UNKNOWN_ERROR_MESSAGE,
  OLVA_PLAN_NOT_INCLUDED_ERROR_MESSAGE,
  OLVA_RATE_LIMIT_ERROR_MESSAGE,
  OLVA_UNAVAILABLE_ERROR_MESSAGE,
} from "../olva-error.util";

describe("olva-error.util", () => {
  it("reads status, code and field errors", () => {
    const error = buildOlvaAxiosError(409, {
      error: "x",
      details: { code: "SOME_CODE" },
      errors: [{ field: "a", message: "m" }],
    });

    expect(getOlvaErrorStatus(error)).toBe(409);
    expect(getOlvaErrorCode(error)).toBe("SOME_CODE");
    expect(getOlvaFieldErrors(error)).toEqual([{ field: "a", message: "m" }]);
  });

  it("returns neutral values for non-axios errors", () => {
    const error = new Error("boom");

    expect(getOlvaErrorStatus(error)).toBeUndefined();
    expect(getOlvaErrorCode(error)).toBeUndefined();
    expect(getOlvaFieldErrors(error)).toEqual([]);
    expect(getOlvaErrorMessage(error)).toBe(OLVA_FALLBACK_ERROR_MESSAGE);
  });

  it("detects 404", () => {
    expect(isOlvaNotFoundError(buildOlvaAxiosError(404))).toBe(true);
    expect(isOlvaNotFoundError(buildOlvaAxiosError(500))).toBe(false);
  });

  it("prefers the message registered for the code", () => {
    const error = buildOlvaAxiosError(409, { error: "raw", details: { code: "C" } });

    expect(getOlvaErrorMessage(error, { C: "Friendly" })).toBe("Friendly");
  });

  it("then the first field error", () => {
    const error = buildOlvaAxiosError(400, { errors: [{ field: "q", message: "Inválido" }] });

    expect(getOlvaErrorMessage(error)).toBe("Inválido");
  });

  it("maps 429 and 500/501 to friendly messages", () => {
    expect(getOlvaErrorMessage(buildOlvaAxiosError(429, { error: "quota" }))).toBe(
      OLVA_RATE_LIMIT_ERROR_MESSAGE,
    );
    expect(getOlvaErrorMessage(buildOlvaAxiosError(500, { error: "oops" }))).toBe(
      OLVA_UNAVAILABLE_ERROR_MESSAGE,
    );
    expect(getOlvaErrorMessage(buildOlvaAxiosError(501, {}))).toBe(OLVA_UNAVAILABLE_ERROR_MESSAGE);
  });

  it("hides backend configuration details when the credentials are rejected", () => {
    const leaked = buildOlvaAxiosError(502, {
      error: "Olva rechazó las credenciales del servicio (revisar OLVA_API_KEY / plan)",
      details: { code: "OLVA_CREDENTIALS_REJECTED" },
    });

    expect(getOlvaErrorMessage(leaked)).toBe(OLVA_UNAVAILABLE_ERROR_MESSAGE);
  });

  it("explains a plan without the shipments module and an unknown outcome", () => {
    const plan = buildOlvaAxiosError(502, { details: { code: "OLVA_PLAN_NOT_INCLUDED" } });
    const unknown = buildOlvaAxiosError(502, { details: { code: "OLVA_OUTCOME_UNKNOWN" } });

    expect(getOlvaErrorMessage(plan)).toBe(OLVA_PLAN_NOT_INCLUDED_ERROR_MESSAGE);
    expect(getOlvaErrorMessage(unknown)).toBe(OLVA_OUTCOME_UNKNOWN_ERROR_MESSAGE);
  });

  it("adds the wait time to a rate limit when it is known", () => {
    const withBody = buildOlvaAxiosError(429, {
      details: { code: "OLVA_RATE_LIMITED" },
      retryAfter: 30,
    });
    const withoutHint = buildOlvaAxiosError(429, { details: { code: "OLVA_RATE_LIMITED" } });

    expect(getOlvaRetryAfterSeconds(withBody)).toBe(30);
    expect(getOlvaErrorMessage(withBody)).toBe(
      `${OLVA_RATE_LIMIT_ERROR_MESSAGE} Puedes reintentar en 30 segundos.`,
    );
    expect(getOlvaErrorMessage(withoutHint)).toBe(OLVA_RATE_LIMIT_ERROR_MESSAGE);
  });

  it("reads Retry-After from the header when the body has none", () => {
    const error = buildOlvaAxiosError(429, {});
    error.response = { ...(error.response as object), headers: { "retry-after": "120" } } as never;

    expect(getOlvaRetryAfterSeconds(error)).toBe(120);
    expect(getOlvaErrorMessage(error)).toContain("2 minutos");
  });

  it("the domain message wins over the generic one", () => {
    const error = buildOlvaAxiosError(502, { details: { code: "OLVA_OUTCOME_UNKNOWN" } });

    expect(getOlvaErrorMessage(error, { OLVA_OUTCOME_UNKNOWN: "Custom" })).toBe("Custom");
  });

  it("shows the backend message for other business errors", () => {
    expect(getOlvaErrorMessage(buildOlvaAxiosError(404, { error: "Persona no encontrada" }))).toBe(
      "Persona no encontrada",
    );
    expect(getOlvaErrorMessage(buildOlvaAxiosError(422, {}))).toBe(OLVA_FALLBACK_ERROR_MESSAGE);
  });
});
