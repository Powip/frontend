import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Browser → actual Next UI/hooks/axios → actual Partners HTTP/JDBC → owned PostgreSQL.
// Only browser Auth refresh, Company/Subscription protocol and font/avatar assets are explicit fixtures.
// Partners requests/responses are NEVER fulfilled, rewritten or fabricated by Playwright.
const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRoot = resolve(frontendRoot, "../ms-partners-partners-main-candidate");
const nativeRequire = createRequire(resolve(frontendRoot, "package.json"));
const { chromium } = nativeRequire("playwright");
const directory = "/private/tmp/powip-partners-auth-company-pg.qFnDIV/data";
const java = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java";
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");

function signedFixtureAccess(actorUserId, sequence, permissions = ["PARTNERS_VIEW"]) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  // Existing UI superadmin gate only: test identity, not a real login, grant or account.
  const payload = { id: actorUserId, sub: actorUserId, type: "access", email: "cuentaprueba@gmail.com",
    name: "Local", surname: "Fixture", role: "ADMINISTRADOR", permissions,
    jti: `browser-fixture-${sequence}`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 };
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return `${content}.${createHmac("sha256", key).update(content).digest("base64url")}`;
}

function launchMarked(command, args, options, prefix) {
  const child = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"] });
  const messages = [];
  const waiters = new Set();
  let buffer = "";
  let exit;
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => {
    exit = { code, signal };
    for (const waiter of waiters) waiter.reject(new Error("Local fixture exited before its milestone"));
    waiters.clear(); resolveExit(exit);
  }));
  child.stderr.resume(); // Never forward arbitrary framework/upstream logs or token/configuration content.
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (let separator; (separator = buffer.indexOf("\n")) >= 0;) {
      const line = buffer.slice(0, separator); buffer = buffer.slice(separator + 1);
      if (!line.startsWith(prefix)) continue;
      const metadata = JSON.parse(line.slice(prefix.length));
      if (metadata.type === "fixture-error") {
        const diagnosis = [metadata.code, metadata.causeClass, metadata.errorCode, metadata.stackFunction, metadata.fixtureFile].filter(Boolean).join(" / ");
        for (const waiter of waiters) waiter.reject(new Error(`Local fixture failed: ${diagnosis}`));
        waiters.clear(); continue;
      }
      const waiter = [...waiters].find((candidate) => candidate.type === metadata.type);
      if (waiter) { waiters.delete(waiter); waiter.resolve(metadata); } else messages.push(metadata);
    }
  });
  const waitFor = (type) => {
    const index = messages.findIndex((value) => value.type === type);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (exit) return Promise.reject(new Error("Local fixture is no longer running"));
    return new Promise((resolveWait, rejectWait) => {
      const waiter = { type, resolve: (value) => { clearTimeout(timeout); resolveWait(value); },
        reject: (error) => { clearTimeout(timeout); rejectWait(error); } };
      const timeout = setTimeout(() => { waiters.delete(waiter); rejectWait(new Error(`Local fixture timed out: ${type}`)); }, 60_000);
      waiters.add(waiter);
    });
  };
  const send = (value, type) => { const pending = waitFor(type); child.stdin.write(`${value}\n`); return pending; };
  const close = async () => {
    if (!exit) { const stopped = await send("stop", "stopped"); assert.equal(stopped.cleaned, true); }
    const result = await exited; assert.equal(result.code, 0, "Owned fixture process must exit successfully");
  };
  const abort = async () => {
    child.stdin.end();
    if (!exit) await Promise.race([exited, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000))]);
    if (!exit) child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000))]);
  };
  return { waitFor, send, close, abort };
}

async function backendFixture() {
  const classpathFile = resolve(backendRoot, "target/billing-fixture-classpath.txt");
  assert.ok(existsSync(classpathFile), "Stable compiled backend fixture/classpath is required");
  const classpath = [resolve(backendRoot, "target/test-classes"), resolve(backendRoot, "target/classes"), readFileSync(classpathFile, "utf8").trim()].join(":");
  const processFixture = launchMarked(java, ["-cp", classpath, "com.powip.partners.adminread.application.PartnerAdminLocalHttpFixture"], {
    cwd: backendRoot, env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_READ_LOCAL_TEST: "true",
      PARTNERS_TEST_POSTGRES_ISOLATED: "true", PARTNERS_TEST_POSTGRES_PORT: "55439", PARTNERS_TEST_POSTGRES_DATA_DIRECTORY: directory },
  }, "PARTNERS_ADMIN_FIXTURE ");
  try {
    const ready = await processFixture.waitFor("ready");
    assert.match(ready.database, /^partners_run_[a-f0-9]{16}_admin_read_test$/);
    return { ...processFixture, ready };
  } catch (error) { await processFixture.abort(); throw error; }
}

async function frontendFixture(backend) {
  const processFixture = launchMarked(process.execPath, [resolve(frontendRoot, "test/partners-admin/local-next-server.cjs")], {
    cwd: frontendRoot, env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_BROWSER_LOCAL_TEST: "true",
      PARTNERS_ADMIN_BROWSER_DIST_ID: randomUUID().replaceAll("-", ""), PARTNERS_ADMIN_BROWSER_BACKEND_URL: backend.ready.baseUrl,
      NODE_OPTIONS: `--require=${resolve(frontendRoot, "test/partners-admin/local-env-guard.cjs")}` },
  }, "PARTNERS_BROWSER_SERVER ");
  try {
    const ready = await processFixture.waitFor("ready"); assert.equal(ready.envGuard, true);
    const url = new URL(ready.baseUrl); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.protocol, "http:");
    return { ...processFixture, ready };
  } catch (error) { await processFixture.abort(); throw error; }
}

test("browser administrative UI uses actual Partners/PostgreSQL and fails closed", { timeout: 240_000 }, async (context) => {
  assert.equal(process.env.PARTNERS_ADMIN_READ_BROWSER_LOCAL_TEST, "true", "Explicit isolated browser test opt-in required");
  const scenario = process.env.PARTNERS_ADMIN_BROWSER_SCENARIO ?? "all";
  assert.ok(["all", "revocation", "operations", "status-settings", "program-review"].includes(scenario), "Only defined browser scenarios are allowed");
  const onlyRevocation = scenario === "revocation";
  const onlyOperations = scenario === "operations";
  const onlyStatusSettings = scenario === "status-settings";
  const onlyProgramReview = scenario === "program-review";
  const protectedFiles = ["next-env.d.ts", "tsconfig.json", "next.config.ts", "package.json"];
  const sourceDigests = protectedFiles.map((file) => createHash("sha256").update(readFileSync(resolve(frontendRoot, file))).digest("hex"));
  context.after(() => protectedFiles.forEach((file, index) => {
    assert.equal(createHash("sha256").update(readFileSync(resolve(frontendRoot, file))).digest("hex"), sourceDigests[index], "Next fixture must preserve configuration source files");
  }));
  const backend = await backendFixture(); context.after(backend.close);
  const frontend = await frontendFixture(backend); context.after(frontend.close);
  const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-component-update"] });
  context.after(() => browser.close());
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const frontOrigin = frontend.ready.baseUrl;
  const backOrigin = backend.ready.baseUrl;
  const external = [];
  const responses = [];
  const pageErrors = [];
  let isolatedAvatarAssets = 0;
  let refreshSequence = 0;
  let browserActor = backend.ready.actorUserId;
  await browserContext.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    // Existing Sidebar's remote avatar is an explicit visual fixture, never an external fetch.
    // Restrict by full URL, method and resource type; no API response is substituted here.
    if (url.href === "https://www.svgrepo.com/show/17068/user.svg" &&
      route.request().method() === "GET" && route.request().resourceType() === "image") {
      ++isolatedAvatarAssets;
      await route.fulfill({ status: 200, contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="8" r="4" fill="#64748b"/><path d="M4 24v-4a8 8 0 0 1 16 0v4" fill="#64748b"/></svg>' });
      return;
    }
    if (url.hostname !== "127.0.0.1" || ![frontOrigin, backOrigin].includes(url.origin)) {
      external.push(`${url.protocol}//${url.hostname}`); await route.abort(); return;
    }
    if (url.origin === backOrigin) {
      assert.ok(url.pathname.startsWith("/v1/partners/"), "Only actual Partners backend calls are allowed");
      await route.continue(); return; // NEVER fabricate or rewrite a Partners response.
    }
    const method = route.request().method();
    if (url.pathname === "/fixture-auth/api/v1/auth/refresh" && method === "POST") {
      const hints = onlyProgramReview
        ? ["PARTNERS_VIEW", "PARTNERS_RESOLVE_REFERRAL"]
        : onlyStatusSettings
        ? ["PARTNERS_VIEW", "PARTNERS_MANAGE_PARTNERS"]
        : onlyOperations
        ? ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"]
        : ["PARTNERS_VIEW"];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accessToken: signedFixtureAccess(browserActor, ++refreshSequence, hints) }) }); return;
    }
    if (([backend.ready.actorUserId, backend.ready.partnerAuthSubject].some((id) => url.pathname === `/fixture-company/company/user/${id}`) || url.pathname === "/fixture-gateway/subscription/subscriptions/me") && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" }); return;
    }
    assert.ok(!url.pathname.startsWith("/fixture-"), "Unexpected simulated service endpoint must fail");
    await route.continue();
  });
  browserContext.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === backOrigin) responses.push({ path: url.pathname, status: response.status() });
  });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(90_000);
  page.on("pageerror", (error) => pageErrors.push(error.constructor.name));
  const evidence = mkdtempSync("/private/tmp/powip-partners-admin-browser-");
  const visit = async (path) => {
    const response = await page.goto(`${frontOrigin}${path}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, "Actual Next page must compile and return HTTP200 before UI assertions");
  };
  const readyHeading = async () => {
    await page.getByRole("heading", { name: "Dashboard operativo", exact: true }).waitFor();
  };
  const assertKpi = async (label, count) => {
    const card = page.getByText(label, { exact: true }).locator("..");
    await card.getByText(String(count), { exact: true }).waitFor();
  };
  const step = async (name, action) => {
    let failed = false;
    await context.test(name, async () => {
      try { await action(); } catch (error) {
        failed = true;
        await page.screenshot({ path: resolve(evidence, "failure-at-first-boundary.png"), fullPage: true }).catch(() => {});
        process.stdout.write(`PARTNERS_BROWSER_FAILURE ${JSON.stringify({ pathname: new URL(page.url()).pathname,
          authRefreshCalls: refreshSequence, partnersHttp: responses, pageErrors,
          nextDevPortals: await page.locator("nextjs-portal").count(), screenshot: resolve(evidence, "failure-at-first-boundary.png") })}\n`);
        throw error;
      }
    });
    if (failed) throw new Error("Browser verification stopped at the first broken boundary");
  };
  process.stdout.write(`PARTNERS_BROWSER_EVIDENCE ${JSON.stringify({ frontend: frontOrigin, backend: backOrigin, directory: evidence, auth: "EXPLICIT_LOCAL_FIXTURE", envFilesRead: false })}\n`);

  if (onlyProgramReview) {
    await backend.send("seed", "seeded"); browserActor = backend.ready.partnerAuthSubject;
    await backend.send("auth:PORTAL", "auth");
    await step("own program preferences require explicit choice and persist without activating a financial policy", async () => {
      await visit("/partners/plan");
      await page.getByText("Todavía no hay una preferencia guardada. Elegí explícitamente ambas opciones.", { exact: true }).waitFor();
      await page.getByLabel("Opción de comisión preferida", { exact: true }).selectOption("C");
      await page.getByLabel("Descuento preferido", { exact: true }).selectOption("5");
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Synthetic isolated explicit program selection");
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/me/program-preferences`);
      await page.getByRole("button", { name: "Guardar preferencias", exact: true }).click();
      const response = await saved; assert.equal(response.status(), 200); assert.equal(response.headers()["cache-control"], "no-store");
      const value = await response.json(); assert.equal(value.settings.optionCode, "C"); assert.equal(value.settings.discountPct, "5");
      assert.equal(value.settings.version, 0); assert.equal(value.effectiveTerms.policyVersion, null);
      await page.getByText("Preferencia guardada: opción C; descuento 5%.", { exact: true }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByLabel("Opción de comisión preferida", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Opción de comisión preferida", { exact: true }).inputValue(), "Opción C");
      assert.equal(await page.getByLabel("Opción de comisión preferida", { exact: true }).getAttribute("readonly"), "");
      await page.screenshot({ path: resolve(evidence, "own-program-real-pg.png"), fullPage: true });
    });
    await step("Link shows three persisted referral counters and the same frozen program preference", async () => {
      await visit("/partners/link");
      const counters = page.getByRole("region", { name: "Contadores de referido", exact: true });
      await counters.waitFor();
      for (const label of ["Capturas de referido", "Claims vinculados", "Empresas atribuidas"])
        assert.equal(await counters.getByText(label, { exact: true }).locator("..").locator("dd").textContent(), "1");
      await page.getByText("Preferencia guardada: opción C; descuento 5%.", { exact: true }).waitFor();
      await page.getByLabel("Descuento preferido", { exact: true }).selectOption("10");
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Synthetic isolated discount preference only");
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/me/program-preferences`);
      await page.getByRole("button", { name: "Guardar preferencias", exact: true }).click();
      const response = await saved; assert.equal(response.status(), 200); const value = await response.json();
      assert.equal(value.settings.version, 1); assert.equal(value.settings.optionCode, "C"); assert.equal(value.effectiveTerms.status, "NOT_CONFIGURED");
      await page.getByText("Preferencia guardada: opción C; descuento 10%.", { exact: true }).waitFor();
      await page.screenshot({ path: resolve(evidence, "link-counters-real-pg.png"), fullPage: true });
    });
    await backend.send("seed-billing", "billing-seeded");
    await step("Comisiones renders actual persisted blocked evaluation without turning an incomplete payment into income", async () => {
      await visit("/partners/comisiones");
      await page.getByRole("heading", { name: "Comisiones: evidencia registrada", exact: true }).waitFor();
      await page.getByRole("region", { name: "Cálculos registrados", exact: true }).getByText("Sin cálculos registrados. Esto no confirma elegibilidad financiera ni un saldo de cero.", { exact: true }).waitFor();
      const evaluations = page.getByRole("region", { name: "Evaluaciones registradas", exact: true });
      await evaluations.getByText("Bloqueado por evidencia", { exact: true }).waitFor();
      await evaluations.getByText("Falta contexto financiero aprobado.", { exact: true }).waitFor();
      await page.screenshot({ path: resolve(evidence, "commission-blocked-real-pg.png"), fullPage: true });
    });
    browserActor = backend.ready.actorUserId; await backend.send("auth:VIEW_REVIEW", "auth");
    await step("administrative pending rejection persists one real decision and removes only the selected row", async () => {
      const queueLoaded = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/v1/partners/admin/review-queue");
      await visit("/partners/admin/cola");
      assert.equal((await queueLoaded).status(), 200);
      const select = page.getByLabel("Referido a rechazar", { exact: true }); await select.waitFor();
      // The form is visible while the real query is still loading. Wait for persisted rows,
      // not merely the select itself; never manufacture data or relax the expected row count.
      await select.locator('option:not([value=""])').nth(1).waitFor({ state: "attached" });
      const options = await select.locator("option").evaluateAll((elements) => elements.map((element) => element.value).filter(Boolean));
      assert.equal(options.length, 2); await select.selectOption(options[0]);
      await page.getByLabel("Motivo del rechazo", { exact: true }).fill("Synthetic isolated pending rejection");
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/admin/review-queue/${options[0]}/reject`);
      await page.getByRole("button", { name: "Rechazar referido", exact: true }).click();
      const response = await saved; assert.equal(response.status(), 200); assert.equal(response.headers()["cache-control"], "no-store");
      const value = await response.json(); assert.equal(value.id, options[0]); assert.equal(value.state, "CANCELLED"); assert.equal(value.version, 1);
      await page.getByText("Rechazo confirmado. La cola se actualiza con los datos guardados.", { exact: true }).waitFor();
      const queueReloaded = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/v1/partners/admin/review-queue");
      await page.reload({ waitUntil: "domcontentloaded" }); await select.waitFor();
      assert.equal((await queueReloaded).status(), 200);
      await select.locator('option:not([value=""])').first().waitFor({ state: "attached" });
      const remaining = await select.locator("option").evaluateAll((elements) => elements.map((element) => element.value).filter(Boolean));
      assert.equal(remaining.length, 1); assert.equal(remaining.includes(options[0]), false);
      await page.screenshot({ path: resolve(evidence, "referral-rejected-real-pg.png"), fullPage: true });
    });
    const writes = await backend.send("write-status", "write-status");
    assert.equal(writes.programPreferences, 1);
    for (const field of ["programPreferencesHistory", "programPreferencesReceipts", "programPreferencesAudit"]) assert.equal(writes[field], 2);
    for (const field of ["referralReviewDecisions", "referralReviewReceipts", "referralReviewAudit"]) assert.equal(writes[field], 1);
    for (const field of ["commissionItems", "commissionApprovals", "commissionContexts"]) assert.equal(writes[field], 0);
    assert.equal(writes.nonDraftPolicies, 0); assert.deepEqual(external, []); assert.deepEqual(pageErrors, []);
    process.stdout.write(`PARTNERS_BROWSER_VERIFIED ${JSON.stringify({ scenario, actualPartnersHttp200: responses.filter((response) => response.status === 200).length,
      isolatedAvatarAssets, externalRequests: 0, pageErrors: 0, durablePreferenceChanges: 2, referralCounts: [1,1,1], durableReferralRejections: 1,
      blockedEvaluations: 1, commissionItems: 0, financialPoliciesActive: 0 })}\n`);
    return;
  }

  if (onlyStatusSettings) {
    await backend.send("seed", "seeded");
    await backend.send("auth:VIEW_PARTNERS", "auth");
    await step("actual status controls suspend and resume one already-approved Partner", async () => {
      await visit(`/partners/admin/partners/${backend.ready.partnerId}`);
      await page.getByRole("button", { name: "Suspender partner", exact: true }).waitFor();
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Synthetic isolated suspension");
      const suspended = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/admin/partners/${backend.ready.partnerId}/suspend`);
      await page.getByRole("button", { name: "Suspender partner", exact: true }).click();
      const suspendedResponse = await suspended;
      assert.equal(suspendedResponse.status(), 200); assert.equal(suspendedResponse.headers()["cache-control"], "no-store");
      const suspendedPartner = await suspendedResponse.json(); assert.equal(suspendedPartner.status, "SUSPENDED"); assert.equal(suspendedPartner.version, 1);
      await page.getByRole("button", { name: "Reactivar partner", exact: true }).waitFor();
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Synthetic isolated reactivation");
      const resumed = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/admin/partners/${backend.ready.partnerId}/resume`);
      await page.getByRole("button", { name: "Reactivar partner", exact: true }).click();
      const resumedResponse = await resumed;
      assert.equal(resumedResponse.status(), 200); const resumedPartner = await resumedResponse.json(); assert.equal(resumedPartner.status, "ACTIVE"); assert.equal(resumedPartner.version, 2);
      await page.getByRole("button", { name: "Suspender partner", exact: true }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Suspender partner", exact: true }).waitFor();
      await page.screenshot({ path: resolve(evidence, "status-real-pg.png"), fullPage: true });
    });
    browserActor = backend.ready.partnerAuthSubject;
    await backend.send("auth:PORTAL", "auth");
    await step("own-account form persists real settings without thresholds, payment history or transfers", async () => {
      await visit("/partners/pagos");
      await page.getByText("Todavía no registraste datos de cobro.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Registrar datos de cobro", exact: true }).click();
      await page.getByLabel("Número / cuenta", { exact: true }).fill("synthetic-local-account");
      await page.getByLabel("Titular", { exact: true }).fill("Synthetic local holder");
      await page.getByLabel("Motivo del cambio", { exact: true }).fill("Synthetic local owned settings");
      const saved = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/me/payout-settings`);
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      const response = await saved;
      assert.equal(response.status(), 200); assert.equal(response.headers()["cache-control"], "no-store");
      const settings = (await response.json()).settings;
      assert.equal(settings.version, 0); assert.equal(settings.accountNumber, "synthetic-local-account"); assert.equal(Object.hasOwn(settings, "minimumThreshold"), false);
      await page.getByText("synthetic-local-account", { exact: false }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Editar datos de cobro", exact: true }).waitFor();
      await page.getByText("synthetic-local-account", { exact: false }).waitFor();
      await page.screenshot({ path: resolve(evidence, "own-settings-real-pg.png"), fullPage: true });
    });
    const writes = await backend.send("write-status", "write-status");
    for (const field of ["partnerStatusHistory", "partnerStatusReceipts", "partnerStatusAudit"]) assert.equal(writes[field], 2);
    for (const field of ["payoutSettings", "payoutSettingsHistory", "payoutSettingsReceipts", "payoutSettingsAudit"]) assert.equal(writes[field], 1);
    assert.equal(writes.nonDraftPolicies, 0); assert.deepEqual(external, []); assert.deepEqual(pageErrors, []);
    process.stdout.write(`PARTNERS_BROWSER_VERIFIED ${JSON.stringify({ scenario, actualPartnersHttp200: responses.filter((response) => response.status === 200).length,
      isolatedAvatarAssets, externalRequests: 0, pageErrors: 0, durableStatusChanges: 2, durableOwnSettings: 1, financialPoliciesActive: 0 })}\n`);
    return;
  }

  if (onlyOperations) {
    await backend.send("seed", "seeded");
    await step("review queue renders actual pending PostgreSQL records without decision controls", async () => {
      await visit("/partners/admin/cola");
      await page.getByRole("heading", { name: "Cola de referidos · solo lectura", exact: true }).waitFor();
      for (const origin of ["MANUAL", "CODE"]) {
        await page.getByRole("heading", { name: `Synthetic ${origin} referral`, exact: true }).waitFor();
      }
      assert.equal(await page.getByRole("heading", { name: "Synthetic LINK referral", exact: true }).count(), 0);
      assert.equal(await page.getByRole("button", { name: /Aprobar|Rechazar|Resolver|Pagar/ }).count(), 0);
      await page.getByLabel("Origen", { exact: true }).selectOption("CODE");
      await page.getByRole("heading", { name: "Synthetic MANUAL referral", exact: true }).waitFor({ state: "hidden" });
      await page.getByRole("heading", { name: "Synthetic CODE referral", exact: true }).waitFor();
      await page.screenshot({ path: resolve(evidence, "queue-real-pg.png"), fullPage: true });
    });
    await backend.send("auth:WRITE_BOTH", "auth");
    const draftCode = `browser-draft-${randomUUID().slice(0, 8)}`;
    await step("policy form saves one immutable DRAFT through actual HTTP and reloads PostgreSQL", async () => {
      await visit("/partners/admin/reglas");
      await page.getByRole("heading", { name: "Versiones de comisiones · DRAFT", exact: true }).waitFor();
      await page.getByText("No hay versiones DRAFT guardadas.", { exact: true }).waitFor();
      await page.getByLabel("Código", { exact: true }).fill(draftCode);
      await page.getByLabel("Moneda ISO", { exact: true }).fill("PEN");
      await page.getByLabel("Tasa del primer pago", { exact: true }).fill("0.40");
      await page.getByLabel("Tasa de pagos recurrentes", { exact: true }).fill("0.06");
      await page.getByLabel("Motivo", { exact: true }).fill("Explicit isolated browser test; not an approved financial policy");
      const committed = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/admin/commission-policy-versions`);
      await page.getByRole("button", { name: "Guardar DRAFT", exact: true }).click();
      const response = await committed;
      assert.equal(response.status(), 201); assert.equal(response.headers()["cache-control"], "no-store");
      assert.equal((await response.json()).state, "DRAFT");
      await page.getByRole("heading", { name: `${draftCode} · PEN · DRAFT`, exact: true }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: `${draftCode} · PEN · DRAFT`, exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: /Activar|Pagar|Liquidar/ }).count(), 0);
      await page.screenshot({ path: resolve(evidence, "policy-draft-real-pg.png"), fullPage: true });
    });
    const title = `Isolated browser resource ${randomUUID().slice(0, 8)}`;
    await step("resource form creates actual DRAFT metadata and reloads PostgreSQL without fake files", async () => {
      await visit("/partners/admin/resources");
      await page.getByText("No hay recursos guardados.", { exact: true }).waitFor();
      await page.getByLabel("País ISO", { exact: true }).fill("PE");
      await page.getByLabel("Categoría", { exact: true }).fill("Isolated fixture");
      await page.getByLabel("Título", { exact: true }).fill(title);
      await page.getByLabel("Orden", { exact: true }).fill("1");
      await page.getByLabel("Tipo", { exact: true }).selectOption("PDF");
      await page.getByLabel("Motivo de creación", { exact: true }).fill("Explicit isolated metadata test, no document uploaded");
      const committed = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${backOrigin}/v1/partners/admin/resources`);
      await page.getByRole("button", { name: "Crear DRAFT", exact: true }).click();
      const response = await committed;
      assert.equal(response.status(), 201); assert.equal(response.headers()["cache-control"], "no-store");
      const resource = await response.json();
      assert.equal(resource.state, "DRAFT"); assert.equal(resource.version, 0); assert.equal(resource.publicUrl, null);
      await page.getByRole("heading", { name: `${title} · DRAFT`, exact: true }).waitFor();
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: `${title} · DRAFT`, exact: true }).waitFor();
      await page.screenshot({ path: resolve(evidence, "resource-draft-real-pg.png"), fullPage: true });
    });
    const writes = await backend.send("write-status", "write-status");
    for (const field of ["resources", "resourceRevisions", "resourceReceipts", "policyDrafts", "resourceAudit", "policyAudit"]) {
      assert.equal(writes[field], 1, `Exactly one durable ${field}`);
    }
    assert.equal(writes.nonDraftPolicies, 0);
    assert.deepEqual(external, []); assert.deepEqual(pageErrors, []);
    assert.equal(responses.filter((response) => response.status === 201).length, 2);
    assert.ok(responses.filter((response) => response.status === 200).length >= 5);
    process.stdout.write(`PARTNERS_BROWSER_VERIFIED ${JSON.stringify({ scenario, actualPartnersHttp200: responses.filter((response) => response.status === 200).length,
      actualPartnersHttp201: 2, isolatedAvatarAssets, externalRequests: 0, pageErrors: 0, durableDrafts: 2, financialPoliciesActive: 0 })}\n`);
    return;
  }

  if (!onlyRevocation) await step("empty PostgreSQL renders zero operational counts and unavailable finances", async () => {
    await visit("/partners/admin"); await readyHeading();
    await assertKpi("Partners activos", 0);
    await page.getByText("No disponible. El motor financiero todavía no está implementado: MRR, comisiones, descuentos, costo del canal, LTV y ROI no se calculan.", { exact: true }).waitFor();
    await visit("/partners/admin/partners"); await page.getByText("Todavía no hay partners", { exact: true }).waitFor();
  });
  await backend.send("seed", "seeded");

  if (!onlyRevocation) {
  await step("dashboard renders counts from actual PostgreSQL without financial zero substitutes", async () => {
    await visit("/partners/admin"); await readyHeading();
    await assertKpi("Partners (activos y suspendidos)", 3); await assertKpi("Partners activos", 2);
    await assertKpi("Atribuciones LINK", 1); await assertKpi("Referidos por código", 1);
    assert.equal(await page.getByText(/S\/\s*0|S\s*0\.00/).count(), 0);
    await page.screenshot({ path: resolve(evidence, "dashboard-real-pg.png"), fullPage: true });
  });

  await step("partner list and status filter render real records", async () => {
    await visit("/partners/admin/partners"); await page.getByText("Admin fixture partner 0", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Ver ficha", exact: true }).count(), 5);
    await page.getByLabel("Estado", { exact: true }).selectOption("ACTIVE");
    await page.getByText("Admin fixture partner 1", { exact: true }).waitFor();
    await page.getByText("Admin fixture partner 2", { exact: true }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("link", { name: "Ver ficha", exact: true }).count(), 2);
    await page.screenshot({ path: resolve(evidence, "partners-real-pg.png"), fullPage: true });
  });

  await step("detail renders four referral sources, LINK with unavailable name and actual activity", async () => {
    const row = page.getByRole("row").filter({ has: page.getByText("Admin fixture partner 0", { exact: true }) });
    await row.getByRole("link", { name: "Ver ficha", exact: true }).click();
    await page.getByRole("tab", { name: "Referidos y atribuciones", exact: true }).waitFor();
    await page.getByText("Atribución LINK", { exact: true }).waitFor();
    await page.getByText("Nombre no disponible", { exact: true }).waitFor();
    await page.getByText(backend.ready.companyId, { exact: true }).waitFor();
    for (const label of ["Manual", "Código", "LINK histórico"]) await page.getByText(label, { exact: true }).waitFor();
    await page.screenshot({ path: resolve(evidence, "partner-detail-real-pg.png"), fullPage: true });
    await page.getByRole("tab", { name: "Actividad", exact: true }).click();
    await page.getByText("LINK_ATTRIBUTION_DECIDED", { exact: true }).waitFor();
  });

  await step("unknown partner produces actual HTTP404 and safe UI state", async () => {
    await visit("/partners/admin/partners/99999999-9999-4999-8999-999999999999");
    await page.getByText("No encontramos este partner.", { exact: true }).waitFor();
    assert.ok(responses.some((response) => response.status === 404));
  });

  await step("actual Auth503 hides dashboard counts and retry recovers actual data", async () => {
    await backend.send("auth:UNAVAILABLE", "auth"); await visit("/partners/admin");
    await page.getByRole("alert").filter({ hasText: "El servicio de Partners no está disponible" }).waitFor();
    assert.equal(await page.getByText("Partners activos", { exact: true }).count(), 0);
    await backend.send("auth:ALLOW", "auth"); await page.getByRole("button", { name: "Reintentar", exact: true }).click();
    await assertKpi("Partners activos", 2); assert.ok(responses.some((response) => response.status === 503));
  });
  }

  await step("actual revocation on one endpoint hides cached administrative sibling data", async () => {
    await visit("/partners/admin/partners"); await page.getByText("Admin fixture partner 0", { exact: true }).waitFor();
    await backend.send("auth:DENY", "auth");
    await page.getByRole("navigation", { name: "Secciones de administración de Partners", exact: true }).getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.waitForURL(`${frontOrigin}/partners/admin`);
    await page.getByRole("alert").filter({ hasText: "No tenés permiso para esta acción" }).waitFor();
    await page.getByRole("navigation", { name: "Secciones de administración de Partners", exact: true }).getByRole("link", { name: "Partners", exact: true }).click();
    await page.waitForURL(`${frontOrigin}/partners/admin/partners`);
    await page.getByRole("alert").filter({ hasText: "No tenés permiso para esta acción" }).waitFor();
    assert.equal(await page.getByText("Admin fixture partner 0", { exact: true }).count(), 0);
    assert.ok(responses.some((response) => response.status === 403));
    await page.screenshot({ path: resolve(evidence, "revoked-no-cached-data.png"), fullPage: true });
    await backend.send("auth:ALLOW", "auth"); await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Admin fixture partner 0", { exact: true }).waitFor();
  });

  assert.deepEqual(external, [], "No unexpected external or production request is allowed; the single explicit avatar asset is served locally");
  assert.deepEqual(pageErrors, [], "No browser runtime exception is allowed");
  assert.ok(responses.filter((response) => response.status === 200).length >= (onlyRevocation ? 2 : 10), "Partners responses must come from actual HTTP handlers");
  process.stdout.write(`PARTNERS_BROWSER_VERIFIED ${JSON.stringify({ scenario, actualPartnersHttp200: responses.filter((response) => response.status === 200).length,
    actualPartnersHttp403: responses.filter((response) => response.status === 403).length, isolatedAvatarAssets, externalRequests: 0, pageErrors: 0 })}\n`);
});
