export type PartnersRequestErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "network"
  | "unknown";

export interface PartnersRequestError {
  kind: PartnersRequestErrorKind;
  status: number | null;
  code: string | null;
  message: string | null;
  details: Record<string, unknown>;
  correlationId: string | null;
  retryAfterMs: number | null;
}
