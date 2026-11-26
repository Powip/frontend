import { describe, expect, it } from "vitest";
import {
  API_SERVICES,
  DEFAULT_PROFILE_NAME,
  getApiHosts,
  getProfile,
  NEXT_PUBLIC_API_VARS,
  PROFILE_NAMES,
  toNextPublicEnv,
} from "../environments";

describe("environment profiles", () => {
  it("registers the default profile", () => {
    expect(PROFILE_NAMES).toContain(DEFAULT_PROFILE_NAME);
  });

  it.each(PROFILE_NAMES)("profile %s has a valid URL per API, without trailing slash", (name) => {
    const profile = getProfile(name);

    for (const service of API_SERVICES) {
      const url = profile.apis[service];

      expect(() => new URL(url), `${name}.${service}`).not.toThrow();
      expect(url.endsWith("/"), `${name}.${service} ends with "/"`).toBe(false);
    }
  });

  it.each(PROFILE_NAMES)("profile %s starts from an allowed frontend host", (name) => {
    const profile = getProfile(name);

    expect(profile.allowedFrontendHosts).toContain(new URL(profile.frontendUrl).host);
  });

  it("hybrid keeps ms-integrations local until it is deployed", () => {
    const hybrid = getProfile("hybrid");

    expect(hybrid.apis.integrations).toBe("http://localhost:3007");
    expect(getApiHosts(hybrid)).toContain("localhost:3007");
  });
});

describe("getApiHosts", () => {
  it("returns each host once, keeping the port", () => {
    const profile = getProfile("hybrid");
    const hosts = getApiHosts(profile);

    expect(new Set(hosts).size).toBe(hosts.length);
    expect(hosts).toContain("ms-auth-production-71c9.up.railway.app");
    expect(hosts.every((host) => !host.includes("/"))).toBe(true);
  });
});

describe("toNextPublicEnv", () => {
  const profile = getProfile("hybrid");
  const env = toNextPublicEnv(profile, "http://localhost:3000");

  it("maps every API to the variable the frontend reads", () => {
    for (const service of API_SERVICES) {
      expect(env[NEXT_PUBLIC_API_VARS[service]]).toBe(profile.apis[service]);
    }
  });

  it("sets the frontend URL", () => {
    expect(env.NEXT_PUBLIC_FRONTEND_URL).toBe("http://localhost:3000");
  });

  it("only produces NEXT_PUBLIC_ variables, with no credentials", () => {
    expect(Object.keys(env).every((key) => key.startsWith("NEXT_PUBLIC_"))).toBe(true);
    expect(Object.keys(env).some((key) => /PASSWORD|EMAIL|SECRET/i.test(key))).toBe(false);
  });
});
