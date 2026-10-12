import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { frontendRoot, launchBackend, launchFrontend, seedLocalFinancial } from "./local-financial-runtime.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");

test("manual browser uses real Partners calculation and ledger with explicit synthetic external protocols", { timeout: 240_000 }, async (context) => {
  assert.equal(process.env.PARTNERS_FINANCIAL_BROWSER_LOCAL_TEST, "true", "Explicit local browser opt-in required");
  const protectedFiles = ["next-env.d.ts", "tsconfig.json", "next.config.ts", "package.json"];
  const digests = protectedFiles.map((file) => createHash("sha256").update(readFileSync(resolve(frontendRoot, file))).digest("hex"));
  context.after(() => protectedFiles.forEach((file, index) => assert.equal(
    createHash("sha256").update(readFileSync(resolve(frontendRoot, file))).digest("hex"), digests[index], "Private Next must preserve config files")));
  const backend = await launchBackend(); context.after(backend.close);
  const evidence = await seedLocalFinancial(backend);
  const frontend = await launchFrontend(backend); context.after(frontend.close);
  const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-component-update"] });
  context.after(() => browser.close());
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await browserContext.newPage(); page.setDefaultTimeout(20_000); page.setDefaultNavigationTimeout(90_000);
  const external = []; const attemptedExternal = new Map(); const blockedAssets = new Set();
  const responses = []; const pageErrors = [];
  // No Playwright response fulfillment: the private Next protocol handles Auth refresh,
  // and every Partners request reaches its actual Spring handler and PostgreSQL rows.
  browserContext.on("request", (request) => {
    const url = new URL(request.url());
    if (![frontend.ready.baseUrl, backend.ready.baseUrl].includes(url.origin) && !["data:", "blob:"].includes(url.protocol))
      attemptedExternal.set(request, { href: url.href, method: request.method(), type: request.resourceType() });
  });
  browserContext.on("requestfailed", (request) => {
    if (!attemptedExternal.has(request)) return;
    const failure = request.failure()?.errorText;
    attemptedExternal.get(request).failure = failure;
    // Chromium emits a request event even when CSP prevents any network access.
    if (failure === "csp" || failure === "net::ERR_BLOCKED_BY_CSP") blockedAssets.add(request);
  });
  browserContext.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === backend.ready.baseUrl) responses.push({ path: url.pathname, status: response.status() });
    else if (url.origin !== frontend.ready.baseUrl && !["data:", "blob:"].includes(url.protocol)) external.push(`${url.protocol}//${url.hostname}`);
  });
  page.on("pageerror", (failure) => pageErrors.push(failure.constructor.name));
  const evidenceDirectory = mkdtempSync("/private/tmp/powip-partners-financial-browser-");
  const visit = async (path) => {
    const response = await page.goto(`${frontend.ready.baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    assert.match(response.headers()["content-security-policy"], path.startsWith("/__partners-local")
      ? /default-src 'none'/ : /img-src 'self' data: blob:/);
  };
  const step = async (name, action) => {
    let failed = false;
    await context.test(name, async () => { try { await action(); } catch (failure) {
      failed = true;
      await page.screenshot({ path: resolve(evidenceDirectory, "first-boundary-failure.png"), fullPage: true }).catch(() => {});
      process.stdout.write(`PARTNERS_FINANCIAL_BROWSER_FAILURE ${JSON.stringify({ pathname: new URL(page.url()).pathname,
        partnersHttp: responses, pageErrors, external, blockedAssets: blockedAssets.size,
        attemptedExternal: [...attemptedExternal.values()], evidenceDirectory })}\n`);
      throw failure;
    } });
    if (failed) throw new Error("Financial browser verification stopped at the first broken boundary");
  };

  await step("private landing explicitly labels the synthetic data and uses no real account", async () => {
    await visit("/__partners-local");
    await page.getByRole("heading", { name: "Partners prueba local", exact: true }).waitFor();
    await page.getByText(/Auth y el cobro Flow son datos sintéticos explícitos/).waitFor();
    const selected = page.waitForURL(`${frontend.ready.baseUrl}/partners/comisiones/libro`);
    await page.getByRole("button", { name: "Entrar como partner de prueba", exact: true }).click(); await selected;
    const cookie = (await browserContext.cookies()).find((value) => value.name === "partners_local_fixture_actor");
    assert.equal(cookie?.value, "partner"); assert.equal(cookie?.httpOnly, true); assert.equal(cookie?.sameSite, "Strict");
  });
  await step("ledger UI displays the actual aggregate and stored posting, never a payable total", async () => {
    await page.getByRole("heading", { name: "Libro de comisiones", exact: true }).waitFor();
    const balance = page.getByRole("region", { name: "Saldo contable", exact: true });
    await balance.getByText("PEN 95.22", { exact: true }).waitFor();
    await balance.getByText("Movimientos contabilizados: 1", { exact: true }).waitFor();
    await page.getByText(/no dinero disponible para retirar/).waitFor();
    const table = page.getByRole("table", { name: "Libro financiero registrado", exact: true });
    await table.getByRole("cell", { name: "Comisión bruta", exact: true }).waitFor();
    await table.getByRole("cell", { name: "95.22", exact: true }).waitFor();
    assert.equal(await table.locator("tbody tr").count(), 1);
    await table.getByText(evidence.itemId, { exact: true }).waitFor();
    await page.screenshot({ path: resolve(evidenceDirectory, "ledger-real-postgres.png"), fullPage: true });
  });
  await step("calculation and durable replay preserve one annual item and one financial posting", async () => {
    await page.getByRole("link", { name: "Volver a los cálculos registrados", exact: true }).click();
    await page.getByRole("heading", { name: "Comisiones: evidencia registrada", exact: true }).waitFor();
    const table = page.getByRole("table", { name: "Cálculos de comisión registrados", exact: true });
    await table.getByRole("cell", { name: "Anual", exact: true }).waitFor();
    assert.equal(await table.locator("tbody tr").count(), 1);
    assert.equal(await table.getByRole("cell", { name: "95.22", exact: true }).count(), 2);
    const replay = await backend.send(`seed-financial:${evidence.policyVersionId}`, "financial-seeded");
    for (const key of ["observationId", "paymentId", "approvalId", "contextId", "itemId", "postingId", "postedLedgerBalance"])
      assert.equal(replay[key], evidence[key]);
    await page.getByRole("link", { name: "Ver libro y saldo contable", exact: true }).click();
    await page.getByRole("region", { name: "Saldo contable" }).getByText("PEN 95.22", { exact: true }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("region", { name: "Saldo contable" }).getByText("PEN 95.22", { exact: true }).waitFor();
  });
  await step("the second synthetic identity sees real admin data but not the partner cache", async () => {
    await visit("/__partners-local");
    await page.getByRole("button", { name: "Entrar como administrador de prueba", exact: true }).click();
    await page.getByRole("heading", { name: "Dashboard operativo", exact: true }).waitFor();
    await visit(`/partners/admin/partners/${backend.ready.partnerId}/libro`);
    await page.getByRole("heading", { name: "Libro financiero del partner", exact: true }).waitFor();
    await page.getByRole("region", { name: "Saldo contable del partner", exact: true }).getByText("PEN 95.22", { exact: true }).waitFor();
    await page.getByRole("table", { name: "Libro financiero del partner registrado", exact: true }).getByRole("cell", { name: "95.22", exact: true }).waitFor();
    await page.screenshot({ path: resolve(evidenceDirectory, "admin-ledger-real-postgres.png"), fullPage: true });
    await visit("/partners/comisiones/libro");
    await page.getByText("Esta cuenta no tiene un perfil de partner", { exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Saldo contable", exact: true }).count(), 0);
    await visit("/__partners-local");
    await page.getByRole("button", { name: "Entrar como partner de prueba", exact: true }).click();
    await page.getByRole("region", { name: "Saldo contable" }).getByText("PEN 95.22", { exact: true }).waitFor();
  });
  await step("only real local Partners HTTP was observed and no source or external state was changed", async () => {
    assert.deepEqual(external, []); assert.deepEqual(pageErrors, []);
    for (const [request, attempt] of attemptedExternal) {
      assert.equal(attempt.href, "https://www.svgrepo.com/show/17068/user.svg");
      assert.equal(attempt.method, "GET"); assert.equal(attempt.type, "image");
      assert.ok(blockedAssets.has(request), "Every external asset attempt must be rejected by CSP before network access");
    }
    for (const path of ["/v1/partners/me/financial-balance", "/v1/partners/me/financial-ledger", "/v1/partners/me/commissions", "/v1/partners/admin/dashboard-summary", "/v1/partners/admin/financial-balance", "/v1/partners/admin/financial-ledger"])
      assert.ok(responses.some((response) => response.path === path && response.status === 200), `Missing real HTTP200: ${path}`);
    const stats = await backend.send("write-status", "write-status");
    assert.equal(stats.commissionItems, 1); assert.equal(stats.nonDraftPolicies, 0);
    process.stdout.write(`PARTNERS_FINANCIAL_BROWSER_EVIDENCE ${JSON.stringify({ frontend: frontend.ready.baseUrl,
      backend: backend.ready.baseUrl, evidenceDirectory, postedLedgerBalance: "95.22", partnersHttp: responses,
      pageErrors, external, externalAssetsBlockedBeforeNetwork: blockedAssets.size,
      auth: "EXPLICIT_SYNTHETIC_LOCAL_PROTOCOL", provider: "EXPLICIT_SYNTHETIC_FLOW_PROTOCOL", envFilesRead: false })}\n`);
  });
});
