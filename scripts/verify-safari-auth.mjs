/**
 * Local WebKit verification of the real login/callback pages and Next auth routes.
 * Run: node scripts/verify-safari-auth.mjs
 * All credentials, tokens, subscriptions and business APIs are synthetic.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userId = "fixture-safari-user";
const companyId = "fixture-safari-company";
const cookieName = "powip_refresh_token";
const subscription = {
  id: "fixture-subscription",
  status: "ACTIVE",
  gateway: "FLOW",
  autoRenewal: true,
  startDate: "2026-10-14",
  endDate: "2026-11-14",
  plan: { id: "fixture-plan", name: "Plan de prueba", price: 249, durationInDays: 30 },
  addOns: [],
};
const state = {
  paid: false,
  refreshValue: null,
  rotation: 0,
  loginCount: 0,
  refreshCount: 0,
  logoutCount: 0,
  confirmationCount: 0,
  checkoutCount: 0,
  serviceClaims: [],
};
const evidence = {
  browser: "WebKit",
  fixturesOnly: true,
  browserAuthPaths: [],
  browserAuthHeaders: [],
  authResponseStatus: [],
  blockedExternalRequests: [],
  stubbedStaticAssets: [],
  pageErrors: [],
  checks: [],
};
let nextProcess;
let browser;
let nextOutput = "";
const artifactDir = process.env.SAFARI_AUTH_ARTIFACT_DIR || await mkdtemp(path.join(os.tmpdir(), "powip-safari-auth-"));
await mkdir(artifactDir, { recursive: true });

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    id: userId,
    email: "safari.fixture@example.test",
    name: "Safari Fixture",
    role: state.paid ? "ADMINISTRADOR" : "USUARIO",
    ...(state.paid ? { companyId } : {}),
    permissions: [],
    iat: now,
    exp: now + 3600,
  })}.fixture-signature`;
}

function claimsFromBearer(value) {
  if (!value?.startsWith("Bearer ")) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value.slice(7).split(".")[1], "base64url"));
    return { role: parsed.role, companyId: parsed.companyId || null };
  } catch {
    return null;
  }
}

function send(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(data === undefined ? "" : JSON.stringify(data));
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function rotate(response) {
  state.refreshValue = `fixture-refresh-${++state.rotation}`;
  // Deliberately model a cookie belonging to the other site, which Safari would
  // reject in a direct browser request. The Next proxy owns its separate cookie.
  response.setHeader("Set-Cookie", `refreshToken=${state.refreshValue}; Path=/api/v1/auth; HttpOnly; SameSite=None; Secure`);
  return { accessToken: jwt(), refreshToken: state.refreshValue };
}

const upstream = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (request.headers.origin) {
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Headers", "content-type,authorization");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }
    if (request.method === "OPTIONS") return send(response, 204);
    const body = await readBody(request);
    if (pathname === "/api/v1/auth/login") {
      assert.equal(body.email, "safari.fixture@example.test");
      assert.equal(body.password, "synthetic-only-password");
      state.loginCount++;
      return send(response, 200, rotate(response));
    }
    if (pathname === "/api/v1/auth/refresh") {
      state.refreshCount++;
      const cookieToken = /(?:^|;\s*)refreshToken=([^;]+)/.exec(request.headers.cookie || "")?.[1];
      if ((body.refreshToken || cookieToken) !== state.refreshValue || !state.refreshValue) {
        return send(response, 401, { error: "Fixture session unavailable" });
      }
      return send(response, 200, rotate(response));
    }
    if (pathname === "/api/v1/auth/logout") {
      state.logoutCount++;
      state.refreshValue = null;
      return send(response, 200, { message: "Fixture logout" });
    }
    const claims = claimsFromBearer(request.headers.authorization);
    if (pathname === "/subscription/subscriptions/flow/checkout") {
      state.checkoutCount++;
      return send(response, 500, { error: "Starting a payment is forbidden in this test" });
    }
    if (pathname === "/subscription/subscriptions/flow/confirm") {
      assert.equal(body.token, "fixture-paid-checkout");
      assert.ok(claims, "Callback confirmation requires the fixture access token");
      state.confirmationCount++;
      state.paid = true;
      return send(response, 200, subscription);
    }
    if (pathname === "/subscription/subscriptions/me") {
      assert.ok(claims, "Subscription reload requires the fixture access token");
      state.serviceClaims.push(claims);
      return send(response, 200, state.paid ? subscription : null);
    }
    if (pathname === `/company/user/${userId}` || pathname === `/company/${companyId}/with-stores`) {
      return send(response, 200, state.paid ? {
        id: companyId,
        user_id: userId,
        name: "Negocio de prueba Safari",
        stores: [],
      } : null);
    }
    if (pathname === "/subscription/plans") return send(response, 200, [subscription.plan]);
    if (pathname === "/subscription/add-ons") return send(response, 200, []);
    return send(response, 404, { error: `Unconfigured fixture route: ${pathname}` });
  } catch (error) {
    send(response, 500, { error: error.message });
  }
});

async function unusedPort() {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForNext(base) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (nextProcess.exitCode !== null) throw new Error(`Next exited ${nextProcess.exitCode}: ${nextOutput.slice(-4000)}`);
    try {
      const response = await fetch(`${base}/login`, { signal: AbortSignal.timeout(25_000) });
      if (response.ok) return;
      if (response.status >= 500) {
        throw new Error(`Local login compilation failed: ${nextOutput.slice(-4000)}`);
      }
    } catch (error) {
      if (error.message.startsWith("Local login compilation failed:")) throw error;
      /* Startup/compilation is still in progress. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next did not become ready: ${nextOutput.slice(-4000)}`);
}

function check(name) {
  evidence.checks.push(name);
  console.log(`PASS ${name}`);
}

try {
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamBase = `http://localhost:${upstream.address().port}`;
  const frontendPort = await unusedPort();
  const frontendBase = `http://127.0.0.1:${frontendPort}`;
  assert.notEqual(new URL(frontendBase).hostname, new URL(upstreamBase).hostname);
  evidence.origins = { frontend: frontendBase, upstream: upstreamBase };

  const fontMock = path.join(artifactDir, "fonts.cjs");
  await writeFile(fontMock, "module.exports = new Proxy({}, { get: () => \"@font-face { font-family: 'Local Fixture'; src: local('Arial'); font-weight: 100 900; font-style: normal; }\" });\n");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith("NEXT_PUBLIC_") && !key.startsWith("SENTRY_") && key !== "AUTH_API_BASE_URL",
  ));
  Object.assign(env, {
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontMock,
    AUTH_API_BASE_URL: `${upstreamBase}/api/v1`,
    NEXT_PUBLIC_API_USERS: `${upstreamBase}/api/v1`,
    NEXT_PUBLIC_API_GATEWAY: upstreamBase,
    NEXT_PUBLIC_API_COMPANY: upstreamBase,
    NEXT_PUBLIC_API_SUBS: `${upstreamBase}/api/v1`,
    NEXT_PUBLIC_API_INVENTORY: upstreamBase,
  });
  nextProcess = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(frontendPort)], { cwd: root, env });
  for (const stream of [nextProcess.stdout, nextProcess.stderr]) {
    stream.on("data", (chunk) => { nextOutput = (nextOutput + chunk.toString()).slice(-12_000); });
  }
  await waitForNext(frontendBase);
  // Compile every exercised route before opening WebKit. Next development HMR
  // can otherwise reload the previous page while a new callback route compiles.
  for (const pathname of ["/sin-plan", "/onboarding/callback"]) {
    const response = await fetch(`${frontendBase}${pathname}`, { signal: AbortSignal.timeout(60_000) });
    assert.equal(response.status, 200, `Precompile ${pathname}`);
  }
  for (const [action, status] of [["login", 400], ["refresh", 401], ["logout", 200]]) {
    const response = await fetch(`${frontendBase}/api/auth/${action}`, {
      method: "POST",
      headers: { Origin: frontendBase, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(60_000),
    });
    assert.equal(response.status, status, `Precompile ${action} with no credentials`);
  }
  check("Real Next server compiles login and uses only local fixture API configuration");

  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const authResponseChecks = [];
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === frontendBase && ["/api/auth/login", "/api/auth/refresh"].includes(url.pathname)) {
      authResponseChecks.push(response.json().then((body) => {
        assert.equal(Object.hasOwn(body, "refreshToken"), false, "No auth response exposes the refresh token");
        evidence.authResponseStatus.push({ path: url.pathname, status: response.status() });
      }));
    }
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.href === "https://www.svgrepo.com/show/17068/user.svg") {
      evidence.stubbedStaticAssets.push(url.href);
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#ddd"/></svg>' });
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      evidence.blockedExternalRequests.push(`${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname.startsWith("/api/v1/auth/")) {
      evidence.blockedExternalRequests.push(`${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname.startsWith("/api/auth/")) {
      evidence.browserAuthPaths.push(url.pathname);
      const headers = await route.request().allHeaders();
      evidence.browserAuthHeaders.push({ path: url.pathname, origin: headers.origin || null, referer: headers.referer || null, fetchSite: headers["sec-fetch-site"] || null });
    }
    return route.continue();
  });

  const initialRefresh = page.waitForResponse((response) => response.url() === `${frontendBase}/api/auth/refresh`, { timeout: 60_000 });
  await page.goto(`${frontendBase}/login`);
  assert.equal((await initialRefresh).status(), 401, `Initial session recovery failed; safe request headers: ${JSON.stringify(evidence.browserAuthHeaders)}`);
  await page.getByLabel("Correo electrónico", { exact: true }).fill("safari.fixture@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("synthetic-only-password");
  const loginResponsePromise = page.waitForResponse((response) => response.url() === `${frontendBase}/api/auth/login`, { timeout: 60_000 });
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  const loginResponse = await loginResponsePromise;
  assert.equal(loginResponse.status(), 200, `Login failed; safe request headers: ${JSON.stringify(evidence.browserAuthHeaders)}`);
  assert.equal(Object.hasOwn(await loginResponse.json(), "refreshToken"), false);
  await page.waitForURL("**/sin-plan", { timeout: 45_000 });
  const cookie = (await context.cookies()).find((value) => value.name === cookieName);
  assert.ok(cookie, "Next sets its own session cookie");
  assert.equal(cookie.domain, "127.0.0.1");
  assert.equal(cookie.path, "/api/auth");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "Lax");
  assert.equal(await page.evaluate((name) => document.cookie.includes(name), cookieName), false);
  assert.equal((await context.cookies()).some((value) => value.name === "refreshToken"), false);
  check("WebKit login UI receives first-party HttpOnly cookie; refresh token absent from response body and document.cookie");
  const beforePaidRefresh = state.refreshCount;
  await page.evaluate(({ userId, planId, subscriptionId }) => {
    localStorage.setItem("powip_onboarding", JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      state: { planId, planName: "Plan de prueba", price: 249, userId, cardToken: "fixture-paid-checkout", subscriptionId, addOnIds: [] },
    }));
  }, { userId, planId: subscription.plan.id, subscriptionId: subscription.id });
  await page.goto(`${frontendBase}/onboarding/callback?token=fixture-paid-checkout`);
  await page.getByRole("heading", { name: "¡Suscripción activada!" }).waitFor({ timeout: 45_000 });
  assert.ok(state.confirmationCount >= 1);
  assert.ok(state.refreshCount >= beforePaidRefresh + 2, "Full navigation restores the session, then payment activation renews it");
  assert.ok(state.serviceClaims.some((claims) => claims.role === "ADMINISTRADOR" && claims.companyId === companyId));
  assert.equal(state.checkoutCount, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("powip_onboarding")), null);
  check("Real callback confirms synthetic PAID checkout, refreshes ADMINISTRADOR/company claims and displays success without creating another checkout");
  await page.screenshot({ path: path.join(artifactDir, "webkit-activated.png"), fullPage: true });

  const refreshBeforeReload = state.refreshCount;
  await page.reload();
  await page.getByRole("heading", { name: "¡Suscripción activada!" }).waitFor({ timeout: 45_000 });
  assert.ok(state.refreshCount > refreshBeforeReload);
  assert.ok(state.serviceClaims.at(-1)?.role === "ADMINISTRADOR");
  assert.equal(state.serviceClaims.at(-1)?.companyId, companyId);
  assert.ok((await context.cookies()).some((value) => value.name === cookieName));
  const localStorageSnapshot = await page.evaluate(() => JSON.stringify(localStorage));
  assert.equal(localStorageSnapshot.includes("fixture-refresh-"), false);
  assert.equal(localStorageSnapshot.includes("fixture-signature"), false);
  check("WebKit full reload restores paid session and preserves updated role/company");

  const logout = await page.evaluate(async (accessToken) => {
    const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: "{}" });
    return response.status;
  }, jwt());
  assert.equal(logout, 200);
  assert.equal((await context.cookies()).some((value) => value.name === cookieName), false);
  await page.reload();
  await page.getByText("Retoma la activación de tu plan", { exact: true }).waitFor({ timeout: 30_000 });
  check("Same-origin logout clears HttpOnly cookie and callback returns to session recovery");
  assert.equal(evidence.pageErrors.length, 0);
  assert.equal(evidence.blockedExternalRequests.length, 0);
  assert.equal(state.loginCount, 1);
  assert.equal(state.logoutCount, 1);
  await Promise.all(authResponseChecks);
  evidence.fixtureCounts = {
    login: state.loginCount,
    refresh: state.refreshCount,
    confirmation: state.confirmationCount,
    newCheckout: state.checkoutCount,
    logout: state.logoutCount,
  };
  evidence.result = "PASS";
  await writeFile(path.join(artifactDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Artifacts: ${artifactDir}`);
} catch (error) {
  evidence.result = "FAIL";
  evidence.failure = error.message;
  await writeFile(path.join(artifactDir, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.error(error);
  console.error(nextOutput.slice(-4000));
  console.error(`Artifacts: ${artifactDir}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (nextProcess && nextProcess.exitCode === null) {
    nextProcess.kill("SIGTERM");
    await Promise.race([once(nextProcess, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (nextProcess.exitCode === null) nextProcess.kill("SIGKILL");
  }
  await new Promise((resolve) => upstream.close(resolve));
}
