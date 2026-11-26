import { OLVA_ERROR_CODES } from "../constants/olva-error-codes.constants";
import { getOlvaErrorCode, getOlvaErrorStatus } from "./olva-error.util";

const MAX_RETRIES = 2;

/** Failures that will fail the same way again, even if the status is 5xx/502. */
const NON_RETRYABLE_CODES: readonly string[] = [
  OLVA_ERROR_CODES.PLAN_NOT_INCLUDED,
  OLVA_ERROR_CODES.CREDENTIALS_REJECTED,
  OLVA_ERROR_CODES.NOT_IMPLEMENTED,
];

/**
 * `retry` option for Olva queries. A 4xx (validation, not found, quota) fails the same way
 * every time, and every call spends Olva quota, so only network and 5xx failures are retried,
 * except those the backend marks as permanent (plan not included, rejected credentials).
 */
export function shouldRetryOlvaRequest(failureCount: number, error: unknown): boolean {
  const status = getOlvaErrorStatus(error);

  if (status !== undefined && status >= 400 && status < 500) return false;

  const code = getOlvaErrorCode(error);

  if (code && NON_RETRYABLE_CODES.includes(code)) return false;

  return failureCount < MAX_RETRIES;
}
