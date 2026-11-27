import { describe, expect, it } from "vitest";
import {
  assertAllowedApiUrl,
  assertRealShipmentsAllowed,
  assertTenant,
  isAllowedApiUrl,
  resolveFrontendUrl,
} from "../environment-guard";
import { getProfile } from "../environments";
import { EnvironmentGuardError } from "../errors";

const profile = getProfile("hybrid");

describe("isAllowedApiUrl", () => {
  it.each([
    "http://localhost:3007/olva/shipments/bulk",
    "https://ms-company-production.up.railway.app/companies/1",
    "https://ms-auth-production-71c9.up.railway.app/api/v1/auth/login",
  ])("allows %s", (url) => {
    expect(isAllowedApiUrl(url, profile)).toBe(true);
  });

  it.each([
    "https://www.powip.tech/api/anything",
    "http://localhost:3008/olva/shipments",
    "https://evil.example.com/ms-company-production.up.railway.app",
    "https://ms-company-production.up.railway.app.evil.com/x",
    "not a url",
  ])("blocks %s", (url) => {
    expect(isAllowedApiUrl(url, profile)).toBe(false);
  });
});

describe("assertAllowedApiUrl", () => {
  it("passes for an allowed API", () => {
    expect(() => assertAllowedApiUrl("http://localhost:3007/olva/quotes", profile)).not.toThrow();
  });

  it("throws, and keeps the query string out of the message", () => {
    const attempt = () => assertAllowedApiUrl("https://example.com/path?token=abc123", profile);

    expect(attempt).toThrow(EnvironmentGuardError);
    expect(attempt).toThrow(/https:\/\/example\.com\/path/);
    expect(attempt).not.toThrow(/abc123/);
  });
});

describe("resolveFrontendUrl", () => {
  it("uses the profile's frontend by default", () => {
    expect(resolveFrontendUrl({ E2E_BASE_URL: undefined }, profile)).toBe("http://localhost:3000");
  });

  it("accepts an override on an allowed host and returns only its origin", () => {
    expect(resolveFrontendUrl({ E2E_BASE_URL: "http://localhost:3000/login?x=1" }, profile)).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects hosts the profile does not allow, such as the production site", () => {
    expect(() => resolveFrontendUrl({ E2E_BASE_URL: "https://www.powip.tech" }, profile)).toThrow(
      EnvironmentGuardError,
    );
    expect(() => resolveFrontendUrl({ E2E_BASE_URL: "http://localhost:3001" }, profile)).toThrow(
      /not allowed/,
    );
  });
});

describe("assertTenant", () => {
  it("passes when the company matches", () => {
    expect(() => assertTenant("company-1", "company-1")).not.toThrow();
  });

  it.each([["company-2"], [null], [undefined]])("aborts for %s", (actual) => {
    expect(() => assertTenant(actual, "company-1")).toThrow(EnvironmentGuardError);
    expect(() => assertTenant(actual, "company-1")).toThrow(/Aborting before any write/);
  });
});

describe("assertRealShipmentsAllowed", () => {
  it("passes only when explicitly enabled", () => {
    expect(() => assertRealShipmentsAllowed({ E2E_ALLOW_REAL_SHIPMENTS: true })).not.toThrow();
    expect(() => assertRealShipmentsAllowed({ E2E_ALLOW_REAL_SHIPMENTS: false })).toThrow(
      /E2E_ALLOW_REAL_SHIPMENTS=true/,
    );
  });
});
