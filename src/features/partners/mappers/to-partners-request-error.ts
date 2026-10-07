import { AxiosHeaders, isAxiosError } from "axios";
import type {
  PartnersRequestError,
  PartnersRequestErrorKind,
} from "../models/partners-request-error";
import { getHttpStatus, toPartnersApiError } from "./to-partner-identity-from-error";

export const DEFAULT_RETRY_AFTER_MS = 30_000;

export function parseRetryAfter(value: unknown, now: number = Date.now()): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (raw === "") return null;

  if (/^\d+$/.test(raw)) {
    return Number(raw) * 1000;
  }

  const date = Date.parse(raw);
  if (Number.isNaN(date)) return null;

  return Math.max(0, date - now);
}

function readHeader(error: unknown, name: string): unknown {
  if (!isAxiosError(error)) return undefined;
  const headers = error.response?.headers;
  if (!headers) return undefined;
  if (headers instanceof AxiosHeaders) return headers.get(name);

  const record = headers as Record<string, unknown>;
  const match = Object.keys(record).find((key) => key.toLowerCase() === name);
  return match ? record[match] : undefined;
}

function readCorrelationIdHeader(error: unknown): string | null {
  const value = readHeader(error, "x-correlation-id");
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function toErrorKind(status: number | null): PartnersRequestErrorKind {
  if (status === null) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "unavailable";
  return "unknown";
}

export function toPartnersRequestError(
  error: unknown,
  now: number = Date.now(),
): PartnersRequestError {
  const status = isAxiosError(error) ? getHttpStatus(error) : null;
  const kind = isAxiosError(error) ? toErrorKind(status) : "unknown";
  const apiError = toPartnersApiError(error);
  const retryAfterMs =
    kind === "rate_limited"
      ? (parseRetryAfter(readHeader(error, "retry-after"), now) ?? DEFAULT_RETRY_AFTER_MS)
      : null;

  return {
    kind,
    status,
    code: apiError?.code ?? null,
    message: apiError?.message || null,
    details: apiError?.details ?? {},
    correlationId: apiError?.correlationId ?? readCorrelationIdHeader(error),
    retryAfterMs,
  };
}
