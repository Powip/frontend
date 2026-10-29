/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST as login } from "../login/route";
import { POST as logout } from "../logout/route";
import { POST as refresh } from "../refresh/route";

const APP_ORIGIN = "https://powip.tech";
const BACKEND = "https://auth.example.test";
const COOKIE_NAME = "powip_refresh_token";
const TOKENS = { accessToken: "access-token-fixture", refreshToken: "refresh-token-fixture" };
const originalFetch = globalThis.fetch;
let fetchMock: jest.MockedFunction<typeof fetch>;

function request(
  action: "login" | "refresh" | "logout",
  options: {
    body?: string;
    headers?: Record<string, string>;
    omitOrigin?: boolean;
    url?: string;
  } = {},
) {
  const url = options.url ?? `${APP_ORIGIN}/api/auth/${action}`;
  const headers = new Headers({
    Host: new URL(url).host,
    Origin: new URL(url).origin,
    "Sec-Fetch-Site": "same-origin",
    "Content-Type": "application/json",
    ...options.headers,
  });
  if (options.omitOrigin) headers.delete("origin");
  return new NextRequest(url, {
    method: "POST",
    headers,
    body:
      options.body ??
      JSON.stringify(
        action === "login" ? { email: "customer@example.test", password: "password-fixture" } : {},
      ),
  });
}

beforeEach(() => {
  jest.replaceProperty(process, "env", {
    ...process.env,
    NODE_ENV: "test",
    AUTH_API_BASE_URL: "",
    NEXT_PUBLIC_API_USERS: `${BACKEND}/api/v1`,
  });
  fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("login creates a host-only HttpOnly cookie and exposes only the access token", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      { ...TOKENS, userId: "internal-user", password: "do-not-return" },
      {
        headers: { "Set-Cookie": "refreshToken=upstream-only; Path=/api/v1/auth" },
      },
    ),
  );
  const response = await login(
    request("login", {
      body: JSON.stringify({
        email: " customer@example.test ",
        password: "password-fixture",
        target: "https://attacker.test",
      }),
      headers: { Cookie: "unrelated=private-cookie", Authorization: "Bearer unrelated-access" },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ accessToken: TOKENS.accessToken });
  const cookie = response.headers.get("set-cookie") ?? "";
  expect(cookie).toContain(`${COOKIE_NAME}=${TOKENS.refreshToken}`);
  expect(cookie).toContain("Path=/api/auth");
  expect(cookie).toContain("Max-Age=604800");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=lax");
  expect(cookie).not.toContain("Domain=");
  expect(cookie).not.toContain("upstream-only");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.has("access-control-allow-origin")).toBe(false);

  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`${BACKEND}/api/v1/auth/login`);
  expect(init).toEqual(
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      body: JSON.stringify({ email: "customer@example.test", password: "password-fixture" }),
    }),
  );
  expect(init?.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
});

it("refresh uses the server cookie instead of a browser-supplied token and rotates it", async () => {
  fetchMock.mockResolvedValue(Response.json(TOKENS));
  const response = await refresh(
    request("refresh", {
      headers: {
        Cookie: `${COOKIE_NAME}=old-cookie-token; refreshToken=untrusted-cookie`,
        Authorization: "Bearer stale-access",
      },
      body: JSON.stringify({ refreshToken: "injected-body-token" }),
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ accessToken: TOKENS.accessToken });
  expect(response.cookies.get(COOKIE_NAME)?.value).toBe(TOKENS.refreshToken);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`${BACKEND}/api/v1/auth/refresh`);
  expect(JSON.parse(init?.body as string)).toEqual({ refreshToken: "old-cookie-token" });
  expect(init?.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
});

it("refresh without its own cookie cannot import a body or legacy cookie session", async () => {
  const response = await refresh(
    request("refresh", {
      headers: { Cookie: "refreshToken=legacy-token" },
      body: JSON.stringify({ refreshToken: "injected-body-token" }),
    }),
  );
  expect(response.status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(await response.json()).toEqual(expect.objectContaining({ code: "AUTH_SESSION_REQUIRED" }));
});

it.each([400, 401, 403])(
  "clears a rejected refresh cookie on backend status %i without exposing backend data",
  async (status) => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "raw-secret-token", refreshToken: "do-not-return" }, { status }),
    );
    const response = await refresh(
      request("refresh", { headers: { Cookie: `${COOKIE_NAME}=old-token` } }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const body = await response.text();
    expect(body).not.toContain("raw-secret-token");
    expect(body).not.toContain("do-not-return");
  },
);

it("preserves the refresh cookie on a transient service failure", async () => {
  fetchMock.mockRejectedValue(new Error("password-and-token-must-stay-private"));
  const response = await refresh(
    request("refresh", { headers: { Cookie: `${COOKIE_NAME}=old-token` } }),
  );
  expect(response.status).toBe(502);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(await response.text()).not.toContain("password-and-token-must-stay-private");
});

it("logout forwards only the caller bearer and deletes the browser cookie", async () => {
  fetchMock.mockResolvedValue(new Response("Sesión cerrada correctamente."));
  const response = await logout(
    request("logout", {
      headers: { Authorization: "Bearer caller-access", Cookie: `${COOKIE_NAME}=do-not-forward` },
      body: JSON.stringify({ refreshToken: "do-not-forward-either" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(response.headers.get("set-cookie")).toContain("Path=/api/auth");
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toBe(`${BACKEND}/api/v1/auth/logout`);
  expect(init?.headers).toEqual({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: "Bearer caller-access",
  });
  expect(init?.body).toBe("{}");
});

it.each(["rejection", "network"])(
  "logout still clears the cookie if upstream fails with %s",
  async (kind) => {
    if (kind === "network") fetchMock.mockRejectedValue(new Error("private-diagnostics"));
    else
      fetchMock.mockResolvedValue(Response.json({ error: "private-diagnostics" }, { status: 500 }));
    const response = await logout(
      request("logout", { headers: { Authorization: "Bearer caller-access" } }),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await response.text()).not.toContain("private-diagnostics");
  },
);

it("logout without a bearer deletes the local session without sending credentials upstream", async () => {
  const response = await logout(request("logout"));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each<Record<string, string>>([
  { Origin: "https://attacker.example" },
  { Origin: "null" },
  { "Sec-Fetch-Site": "cross-site" },
  { "Sec-Fetch-Site": "same-site" },
  { Origin: "https://attacker.example", "X-Forwarded-Host": "attacker.example" },
])(
  "rejects foreign request context before forwarding or modifying a session: %j",
  async (headers) => {
    const response = await logout(request("logout", { headers }));
    expect(response.status).toBe(403);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("requires Origin but accepts Safari requests without Sec-Fetch-Site", async () => {
  const rejected = await login(request("login", { omitOrigin: true }));
  expect(rejected.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();

  const safariRequest = request("login");
  safariRequest.headers.delete("sec-fetch-site");
  fetchMock.mockResolvedValue(Response.json(TOKENS));
  expect((await login(safariRequest)).status).toBe(200);
});

it("accepts WebKit's real loopback Origin when Next normalizes the request URL to localhost", async () => {
  fetchMock.mockResolvedValue(Response.json(TOKENS));
  const webkitRequest = request("login", { url: "http://127.0.0.1:3000/api/auth/login" });
  expect(webkitRequest.url).toContain("localhost:3000");
  expect(webkitRequest.headers.get("host")).toBe("127.0.0.1:3000");
  expect(webkitRequest.headers.get("origin")).toBe("http://127.0.0.1:3000");
  expect((await login(webkitRequest)).status).toBe(200);
});

it("matches the browser Host behind a TLS proxy without trusting a forwarded host", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  fetchMock.mockImplementation(async () => Response.json(TOKENS));
  const behindProxy = () =>
    request("login", {
      url: "http://internal.next:3000/api/auth/login",
      headers: { Host: "powip.tech", Origin: APP_ORIGIN, "X-Forwarded-Host": "attacker.example" },
    });
  const response = await login(behindProxy());
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Secure");

  const attacker = behindProxy();
  attacker.headers.set("origin", "https://attacker.example");
  expect((await login(attacker)).status).toBe(403);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("accepts a public www Host when the production Next server uses an internal bind address", async () => {
  Object.assign(process.env, { NODE_ENV: "production" });
  fetchMock.mockResolvedValue(Response.json(TOKENS));
  const response = await login(
    request("login", {
      url: "http://0.0.0.0:3000/api/auth/login",
      headers: { Host: "www.powip.tech", Origin: "https://www.powip.tech" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("Secure");
});

it.each<Record<string, string>>([
  { Host: "powip.tech:8443" },
  { Host: "powip.tech/attacker" },
  { Host: "powip.tech@attacker.example" },
  { Host: "powip.tech,attacker.example" },
  { Host: "powip.tech?attacker.example" },
  { Host: "powip.tech#attacker.example" },
  { Origin: "http://powip.tech" },
])("rejects malformed Host, different port or protocol: %j", async (headers) => {
  const response = await login(request("login", { headers }));
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])(
  "rejects %s content before forwarding",
  async (contentType) => {
    const response = await login(request("login", { headers: { "Content-Type": contentType } }));
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it.each([
  "{invalid",
  "null",
  "[]",
  JSON.stringify({ email: "customer@example.test" }),
  JSON.stringify({ email: "", password: "x" }),
])("rejects malformed or incomplete login input without upstream calls", async (body) => {
  const response = await login(request("login", { body }));
  expect(response.status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("uses the fixed server configuration instead of any requested upstream URL", async () => {
  process.env.AUTH_API_BASE_URL = "https://server-auth.example.test/";
  fetchMock.mockResolvedValue(Response.json(TOKENS));
  const response = await login(
    request("login", { url: `${APP_ORIGIN}/api/auth/login?upstream=https://attacker.test` }),
  );
  expect(response.status).toBe(200);
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "https://server-auth.example.test/api/v1/auth/login",
  );
});

it.each([
  "",
  "http://auth.example.test/api/v1",
  "https://user:pass@auth.example.test",
  "https://auth.example.test/api/v1?target=elsewhere",
  "https://auth.example.test/private",
])("fails safely for a missing or invalid backend configuration: %s", async (base) => {
  process.env.AUTH_API_BASE_URL = base;
  delete process.env.NEXT_PUBLIC_API_USERS;
  const response = await login(request("login"));
  expect(response.status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("user:pass");
});

it("permits localhost HTTP only in development and still secures production cookies", async () => {
  process.env.AUTH_API_BASE_URL = "http://localhost:8080/api/v1";
  fetchMock.mockImplementation(async () => Response.json(TOKENS));
  const local = await login(request("login", { url: "http://localhost:3000/api/auth/login" }));
  expect(local.status).toBe(200);
  expect(local.headers.get("set-cookie")).not.toContain("Secure");

  Object.assign(process.env, { NODE_ENV: "production" });
  const rejected = await login(request("login"));
  expect(rejected.status).toBe(503);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  process.env.AUTH_API_BASE_URL = BACKEND;
  const production = await login(
    request("login", {
      url: "http://internal.next:3000/api/auth/login",
      headers: { Host: "frontend.example.test", Origin: "https://frontend.example.test" },
    }),
  );
  expect(production.headers.get("set-cookie")).toContain("Secure");
});

it.each([
  { accessToken: "access-token" },
  { accessToken: "", refreshToken: "refresh-token" },
  { ...TOKENS, refreshToken: "unsafe token" },
])("does not create a browser session from malformed upstream tokens", async (tokens) => {
  fetchMock.mockResolvedValue(Response.json(tokens));
  const response = await login(request("login"));
  expect(response.status).toBe(502);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(await response.text()).not.toContain("refresh-token");
});

it("aborts a stalled upstream request and clears the cookie for logout", async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("upstream private timeout")),
          { once: true },
        );
      }),
  );
  const pending = logout(request("logout", { headers: { Authorization: "Bearer caller-access" } }));
  await jest.advanceTimersByTimeAsync(10_000);
  const response = await pending;
  expect(response.status).toBe(504);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(await response.text()).not.toContain("upstream private timeout");
});
