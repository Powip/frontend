import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";
import { E2EConfigError } from "../errors";

const VALID = {
  E2E_USER_EMAIL: "e2e@example.com",
  E2E_USER_PASSWORD: "s3cret-pass",
  E2E_COMPANY_ID: "company-1",
};

function thrownBy(raw: NodeJS.ProcessEnv): Error {
  try {
    parseEnv(raw);
  } catch (error) {
    return error as Error;
  }
  throw new Error("parseEnv did not throw");
}

describe("parseEnv", () => {
  it("accepts the required variables and applies the defaults", () => {
    const env = parseEnv(VALID);

    expect(env).toMatchObject({
      E2E_PROFILE: "hybrid",
      E2E_USER_EMAIL: "e2e@example.com",
      E2E_COMPANY_ID: "company-1",
      E2E_ALLOW_REAL_SHIPMENTS: false,
    });
    expect(env.E2E_BASE_URL).toBeUndefined();
  });

  it("treats empty values as unset, like a copied .env.e2e.example", () => {
    const env = parseEnv({ ...VALID, E2E_BASE_URL: "", E2E_ALLOW_REAL_SHIPMENTS: "  " });

    expect(env.E2E_BASE_URL).toBeUndefined();
    expect(env.E2E_ALLOW_REAL_SHIPMENTS).toBe(false);
  });

  it.each(["true", "1"])("reads E2E_ALLOW_REAL_SHIPMENTS=%s as enabled", (value) => {
    expect(parseEnv({ ...VALID, E2E_ALLOW_REAL_SHIPMENTS: value }).E2E_ALLOW_REAL_SHIPMENTS).toBe(
      true,
    );
  });

  it("accepts a valid frontend override", () => {
    expect(parseEnv({ ...VALID, E2E_BASE_URL: "http://localhost:3000" }).E2E_BASE_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("names every missing variable in a single error", () => {
    const error = thrownBy({});

    expect(error).toBeInstanceOf(E2EConfigError);
    expect(error.message).toContain("E2E_USER_EMAIL");
    expect(error.message).toContain("E2E_USER_PASSWORD");
    expect(error.message).toContain("E2E_COMPANY_ID");
  });

  it("rejects an unknown profile", () => {
    expect(thrownBy({ ...VALID, E2E_PROFILE: "prod" }).message).toContain("E2E_PROFILE");
  });

  it("rejects a malformed email and never echoes the password", () => {
    const error = thrownBy({ ...VALID, E2E_USER_EMAIL: "not-an-email" });

    expect(error.message).toContain("E2E_USER_EMAIL");
    expect(error.message).not.toContain("s3cret-pass");
  });

  it("only reads variables in the E2E_ namespace", () => {
    const env = parseEnv({ ...VALID, PATH: "/bin", NEXT_PUBLIC_E2E_USER_EMAIL: "x@example.com" });

    expect(Object.keys(env).every((key) => key.startsWith("E2E_"))).toBe(true);
    expect(env.E2E_USER_EMAIL).toBe("e2e@example.com");
  });
});
