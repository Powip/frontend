import type { ValueOf } from "../types/value-of.type";

/**
 * Codes for failures of the Olva API itself. They travel in `details.code` of every error
 * response. Mirrors ms-integrations: src/olva/domain/exceptions/olva-error-codes.ts
 */
export const OLVA_ERROR_CODES = {
  /** The service's Olva account does not include the shipments module (Business plan). */
  PLAN_NOT_INCLUDED: "OLVA_PLAN_NOT_INCLUDED",
  /** Rate limit or monthly quota reached; `retryAfter` says when to try again, if known. */
  RATE_LIMITED: "OLVA_RATE_LIMITED",
  /**
   * A write got no usable answer (timeout, network, malformed body): Olva may or may not have
   * created the shipments. Check before retrying.
   */
  OUTCOME_UNKNOWN: "OLVA_OUTCOME_UNKNOWN",
  /** Olva rejected the SERVICE's credentials: a server problem, not the caller's. */
  CREDENTIALS_REJECTED: "OLVA_CREDENTIALS_REJECTED",
  BAD_REQUEST: "OLVA_BAD_REQUEST",
  NOT_FOUND: "OLVA_NOT_FOUND",
  CONFLICT: "OLVA_CONFLICT",
  UNPROCESSABLE: "OLVA_UNPROCESSABLE",
  UPSTREAM_ERROR: "OLVA_UPSTREAM_ERROR",
  NOT_IMPLEMENTED: "OLVA_NOT_IMPLEMENTED",
  INTERNAL_ERROR: "OLVA_INTERNAL_ERROR",
  /** A domain rule that only a bug or corrupt data can break (empty id, empty companyId...). */
  INVARIANT_VIOLATION: "OLVA_INVARIANT_VIOLATION",
} as const;

export type OlvaErrorCode = ValueOf<typeof OLVA_ERROR_CODES>;
