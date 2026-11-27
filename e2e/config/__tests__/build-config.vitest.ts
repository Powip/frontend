import { describe, expect, it } from "vitest";
import { buildE2EConfig, E2EConfigError, EnvironmentGuardError } from "..";

const RAW = {
  E2E_USER_EMAIL: "e2e@example.com",
  E2E_USER_PASSWORD: "s3cret-pass",
  E2E_COMPANY_ID: "company-1",
};

describe("buildE2EConfig", () => {
  it("resolves env, profile and frontend URL together", () => {
    const config = buildE2EConfig(RAW);

    expect(config.profile.name).toBe("hybrid");
    expect(config.frontendUrl).toBe("http://localhost:3000");
    expect(config.env.E2E_COMPANY_ID).toBe("company-1");
  });

  it("fails with a config error for an invalid env", () => {
    expect(() => buildE2EConfig({})).toThrow(E2EConfigError);
  });

  it("fails with a guard error when the frontend override is not allowed", () => {
    expect(() => buildE2EConfig({ ...RAW, E2E_BASE_URL: "https://www.powip.tech" })).toThrow(
      EnvironmentGuardError,
    );
  });
});
