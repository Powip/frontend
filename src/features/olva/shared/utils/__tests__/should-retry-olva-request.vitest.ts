import { describe, expect, it } from "vitest";
import { buildOlvaAxiosError } from "../../test-utils/axios-error";
import { shouldRetryOlvaRequest } from "../should-retry-olva-request";

describe("shouldRetryOlvaRequest", () => {
  it.each([400, 404, 429])("never retries a %i", (status) => {
    expect(shouldRetryOlvaRequest(0, buildOlvaAxiosError(status))).toBe(false);
  });

  it("retries 5xx and network errors up to twice", () => {
    expect(shouldRetryOlvaRequest(0, buildOlvaAxiosError(502))).toBe(true);
    expect(shouldRetryOlvaRequest(1, new Error("network"))).toBe(true);
    expect(shouldRetryOlvaRequest(2, buildOlvaAxiosError(502))).toBe(false);
  });

  it.each(["OLVA_PLAN_NOT_INCLUDED", "OLVA_CREDENTIALS_REJECTED"])(
    "does not retry a permanent failure (%s)",
    (code) => {
      expect(shouldRetryOlvaRequest(0, buildOlvaAxiosError(502, { details: { code } }))).toBe(
        false,
      );
    },
  );
});
