import { buildAxiosError } from "../../test-utils/axios-error";
import {
  DEFAULT_RETRY_AFTER_MS,
  parseRetryAfter,
  toPartnersRequestError,
} from "../to-partners-request-error";

const NOW = Date.parse("2026-10-07T12:00:00Z");

describe("parseRetryAfter", () => {
  it("interpreta segundos", () => {
    expect(parseRetryAfter("120", NOW)).toBe(120_000);
  });

  it("interpreta una fecha HTTP como tiempo restante", () => {
    expect(parseRetryAfter("Wed, 07 Oct 2026 12:00:45 GMT", NOW)).toBe(45_000);
  });

  it("una fecha HTTP pasada no genera espera negativa", () => {
    expect(parseRetryAfter("Wed, 07 Oct 2026 11:59:00 GMT", NOW)).toBe(0);
  });

  it.each([undefined, null, "", "pronto"])("devuelve null para %p", (value) => {
    expect(parseRetryAfter(value, NOW)).toBeNull();
  });
});

describe("toPartnersRequestError", () => {
  it("401 con body vacío se clasifica como sesión inválida", () => {
    expect(toPartnersRequestError(buildAxiosError(401, ""), NOW)).toEqual({
      kind: "unauthorized",
      status: 401,
      code: null,
      message: null,
      details: {},
      correlationId: null,
      retryAfterMs: null,
    });
  });

  it("sin body conserva el correlationId del header X-Correlation-Id", () => {
    const error = buildAxiosError(401, "", { "X-Correlation-Id": "corr-header" });

    expect(toPartnersRequestError(error, NOW).correlationId).toBe("corr-header");
  });

  it("prefiere el correlationId del body sobre el del header", () => {
    const error = buildAxiosError(
      409,
      { code: "VERSION_CONFLICT", message: "", correlationId: "corr-body", details: {} },
      { "X-Correlation-Id": "corr-header" },
    );

    expect(toPartnersRequestError(error, NOW).correlationId).toBe("corr-body");
  });

  it("401 sin body también se clasifica como sesión inválida", () => {
    expect(toPartnersRequestError(buildAxiosError(401), NOW).kind).toBe("unauthorized");
  });

  it("403 se clasifica como falta de permisos", () => {
    expect(toPartnersRequestError(buildAxiosError(403), NOW).kind).toBe("forbidden");
  });

  it("429 usa Retry-After en segundos", () => {
    const error = buildAxiosError(429, undefined, { "Retry-After": "30" });

    expect(toPartnersRequestError(error, NOW)).toMatchObject({
      kind: "rate_limited",
      retryAfterMs: 30_000,
    });
  });

  it("429 usa Retry-After como fecha HTTP", () => {
    const error = buildAxiosError(429, undefined, {
      "Retry-After": "Wed, 07 Oct 2026 12:02:00 GMT",
    });

    expect(toPartnersRequestError(error, NOW)).toMatchObject({
      kind: "rate_limited",
      retryAfterMs: 120_000,
    });
  });

  it("429 sin Retry-After legible aplica una espera conservadora", () => {
    expect(toPartnersRequestError(buildAxiosError(429), NOW).retryAfterMs).toBe(
      DEFAULT_RETRY_AFTER_MS,
    );
  });

  it("conserva code y correlationId del error del contrato", () => {
    const error = buildAxiosError(409, {
      code: "APPLICATION_STATE_CONFLICT",
      message: "The application cannot be approved from its current state.",
      correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      details: {},
    });

    expect(toPartnersRequestError(error, NOW)).toEqual({
      kind: "conflict",
      status: 409,
      code: "APPLICATION_STATE_CONFLICT",
      message: "The application cannot be approved from its current state.",
      details: {},
      correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      retryAfterMs: null,
    });
  });

  it("conserva message y details de un error de validación", () => {
    const error = buildAxiosError(400, {
      code: "VALIDATION_FAILED",
      message: "phone must be a valid phone number",
      correlationId: "corr-400",
      details: { phone: "must be a valid phone number" },
    });

    expect(toPartnersRequestError(error, NOW)).toMatchObject({
      kind: "validation",
      message: "phone must be a valid phone number",
      details: { phone: "must be a valid phone number" },
      correlationId: "corr-400",
    });
  });

  it.each([
    [400, "validation"],
    [422, "validation"],
    [404, "not_found"],
    [503, "unavailable"],
  ])("clasifica %i como %s", (status, kind) => {
    expect(toPartnersRequestError(buildAxiosError(status), NOW).kind).toBe(kind);
  });

  it("un error sin respuesta se clasifica como problema de red", () => {
    expect(toPartnersRequestError(buildAxiosError(), NOW).kind).toBe("network");
  });

  it("un error que no es de axios queda como desconocido", () => {
    expect(toPartnersRequestError(new Error("boom"), NOW).kind).toBe("unknown");
  });
});
