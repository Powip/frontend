import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

// Explicit local integration test against the candidate: real frontend adapter → Partners HTTP/JDBC → owned PostgreSQL.
// Auth is a clearly identified local protocol fixture. No Flow, onboarding or production services are called.
const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRoot = resolve(frontendRoot, "../ms-partners-partners-main-candidate");
const nativeRequire = createRequire(resolve(frontendRoot, "package.json"));
const typescript = nativeRequire("typescript");
const java = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java";
const directory = "/private/tmp/powip-partners-auth-company-pg.qFnDIV/data";
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");

function loadActualTypeScript(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = typescript.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return nativeRequire(specifier);
    const target = specifier.startsWith("@/") ? resolve(frontendRoot, "src", specifier.slice(2)) : resolve(dirname(file), specifier);
    const found = [target, `${target}.ts`, `${target}.tsx`, resolve(target, "index.ts")].find(existsSync);
    if (!found) throw new Error("Actual adapter dependency is missing");
    return loadActualTypeScript(found, cache);
  };
  runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, { filename: file })
    (localRequire, module, module.exports, file, dirname(file));
  return module.exports;
}

function signedAccess(actorUserId, expiresInSeconds = 900) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: actorUserId, sub: actorUserId, type: "access",
    role: "ADMINISTRADOR", permissions: ["PARTNERS_VIEW"], exp: Math.floor(Date.now() / 1000) + expiresInSeconds })}`;
  return `${content}.${createHmac("sha256", key).update(content).digest("base64url")}`;
}

function statusError(expected) {
  return (error) => error?.response?.status === expected || error?.status === expected;
}

async function fixture() {
  assert.equal(process.env.PARTNERS_ADMIN_READ_CONTRACT_LOCAL_TEST, "true", "Explicit local integration opt-in is required");
  const classpathFile = resolve(backendRoot, "target/billing-fixture-classpath.txt");
  assert.ok(existsSync(classpathFile), "Compile the real backend fixture/classpath before this test");
  const classpath = [resolve(backendRoot, "target/test-classes"), resolve(backendRoot, "target/classes"), readFileSync(classpathFile, "utf8").trim()].join(":");
  const child = spawn(java, ["-cp", classpath, "com.powip.partners.adminread.application.PartnerAdminLocalHttpFixture"], {
    cwd: backendRoot,
    env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR ?? "/private/tmp", PARTNERS_ADMIN_READ_LOCAL_TEST: "true",
      PARTNERS_TEST_POSTGRES_ISOLATED: "true", PARTNERS_TEST_POSTGRES_PORT: "55439", PARTNERS_TEST_POSTGRES_DATA_DIRECTORY: directory },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = [];
  const waiters = new Set();
  let buffer = "";
  let exit;
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => {
    exit = { code, signal };
    for (const waiter of waiters) waiter.reject(new Error("Local fixture exited before its expected milestone"));
    waiters.clear(); resolveExit(exit);
  }));
  // Never forward arbitrary JVM logs/configuration or upstream bodies to test output.
  child.stderr.resume();
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (let separator; (separator = buffer.indexOf("\n")) >= 0;) {
      const line = buffer.slice(0, separator); buffer = buffer.slice(separator + 1);
      if (!line.startsWith("PARTNERS_ADMIN_FIXTURE ")) continue;
      const metadata = JSON.parse(line.slice("PARTNERS_ADMIN_FIXTURE ".length));
      if (metadata.type === "fixture-error") {
        for (const waiter of waiters) waiter.reject(new Error(`Local fixture failed: ${metadata.code}`));
        waiters.clear(); continue;
      }
      const waiter = [...waiters].find((candidate) => candidate.type === metadata.type);
      if (waiter) { waiters.delete(waiter); waiter.resolve(metadata); }
      else messages.push(metadata);
    }
  });
  const waitFor = (type) => {
    const existing = messages.findIndex((message) => message.type === type);
    if (existing >= 0) return Promise.resolve(messages.splice(existing, 1)[0]);
    if (exit) return Promise.reject(new Error("Local fixture is no longer running"));
    return new Promise((resolveWait, rejectWait) => {
      const waiter = { type, resolve: (metadata) => { clearTimeout(timeout); resolveWait(metadata); },
        reject: (failure) => { clearTimeout(timeout); rejectWait(failure); } };
      const timeout = setTimeout(() => { waiters.delete(waiter); rejectWait(new Error(`Local fixture milestone timed out: ${type}`)); }, 30_000);
      waiters.add(waiter);
    });
  };
  const command = (value, type) => { const pending = waitFor(type); child.stdin.write(`${value}\n`); return pending; };
  const close = async () => {
    if (!exit) {
      const stopped = await command("stop", "stopped");
      assert.equal(stopped.cleaned, true, "Owned database cleanup must complete");
    }
    const result = await exited;
    assert.equal(result.code, 0, "Fixture JVM must terminate successfully");
  };
  try {
    const ready = await waitFor("ready");
    assert.match(ready.database, /^partners_run_[a-f0-9]{16}_admin_read_test$/);
    const origin = new URL(ready.baseUrl);
    assert.equal(origin.protocol, "http:"); assert.equal(origin.hostname, "127.0.0.1"); assert.ok(origin.port);
    return { ready, command, close };
  } catch (failure) {
    child.stdin.end();
    if (!exit) await Promise.race([exited, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000))]);
    if (!exit) child.kill("SIGTERM");
    throw failure;
  }
}

test("actual Partners administrative adapter and HTTP/PostgreSQL contract", async (context) => {
  const running = await fixture();
  context.after(running.close);
  const oldOrigin = process.env.NEXT_PUBLIC_API_PARTNERS;
  process.env.NEXT_PUBLIC_API_PARTNERS = `${running.ready.baseUrl}/v1/partners`;
  context.after(() => { if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_API_PARTNERS; else process.env.NEXT_PUBLIC_API_PARTNERS = oldOrigin; });
  const adapter = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-partners.api.ts"));
  const accessToken = signedAccess(running.ready.actorUserId);
  const credentials = { accessToken };
  const partner = { ...credentials, partnerId: running.ready.partnerId };
  for (const name of ["requestAdminPartners", "requestAdminPartner", "requestAdminPartnerReferrals", "requestAdminPartnerActivity", "requestAdminDashboardSummary", "requestAdminReviewQueue"]) {
    assert.equal(typeof adapter[name], "function", `Real frontend adapter export is required: ${name}`);
  }

  await context.test("empty PostgreSQL remains empty and financial fields are unavailable/null", async () => {
    const page = await adapter.requestAdminPartners({ ...credentials, limit: 2 });
    assert.deepEqual(page.items, []); assert.equal(page.hasMore, false); assert.equal(page.nextCursor, null);
    const summary = await adapter.requestAdminDashboardSummary(credentials);
    assert.ok(Object.values(summary.counts).every((value) => value === 0));
    assert.equal(summary.financial.availability, "NOT_AVAILABLE");
    assert.equal(summary.financial.reason, "FINANCIAL_ENGINE_NOT_IMPLEMENTED");
    for (const field of ["referredMrr", "monthlyCommissions", "discountsGiven", "channelCost", "ltvBrought", "channelRoiMultiplier"]) {
      assert.equal(summary.financial[field], null);
    }
  });
  await running.command("seed", "seeded");

  await context.test("real counts, detail and keyset pagination preserve all current records", async () => {
    const first = await adapter.requestAdminPartners({ ...credentials, limit: 2 });
    assert.equal(first.items.length, 2); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
    const second = await adapter.requestAdminPartners({ ...credentials, limit: 2, cursor: first.nextCursor });
    const third = await adapter.requestAdminPartners({ ...credentials, limit: 2, cursor: second.nextCursor });
    assert.equal(second.items.length, 2); assert.equal(second.hasMore, true); assert.equal(third.items.length, 1);
    assert.equal(third.hasMore, false); assert.equal(third.nextCursor, null);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size, 5);
    const active = await adapter.requestAdminPartners({ ...credentials, limit: 2, status: "ACTIVE" });
    assert.equal(active.items.length, 2); assert.equal(active.hasMore, false);
    const detail = await adapter.requestAdminPartner(partner);
    assert.equal(detail.id, running.ready.partnerId); assert.equal(detail.status, "ACTIVE");
    assert.equal(detail.referralCode, "admin-read-fixture-code");
    assert.equal(detail.manualReferralsCount, 1); assert.equal(detail.linkAttributionsCount, 1);
    assert.ok(!JSON.stringify(detail).includes("@example.test"));
    const summary = await adapter.requestAdminDashboardSummary(credentials);
    assert.deepEqual(summary.counts, { partnersTotal: 3, partnersActive: 2, partnersSuspended: 1, applicationsPending: 1,
      applicationsRejected: 1, manualReferrals: 1, codeReferrals: 1, legacyLinkReferrals: 1, linkAttributions: 1,
      capturedClaims: 1, attachedClaims: 1 });
    assert.equal(summary.financial.monthlyCommissions, null);
  });

  await context.test("manual/code/legacy/LINK evidence pages and safe activity come from PostgreSQL", async () => {
    const first = await adapter.requestAdminPartnerReferrals({ ...partner, limit: 2 });
    const second = await adapter.requestAdminPartnerReferrals({ ...partner, limit: 2, cursor: first.nextCursor });
    assert.equal(first.items.length, 2); assert.equal(second.items.length, 2); assert.equal(second.hasMore, false);
    const evidence = [...first.items, ...second.items];
    assert.deepEqual(new Set(evidence.map((item) => item.source)), new Set(["MANUAL", "CODE", "LINK_LEGACY", "LINK_ATTRIBUTION"]));
    const linked = evidence.find((item) => item.source === "LINK_ATTRIBUTION");
    assert.equal(linked.companyId, running.ready.companyId); assert.equal(linked.businessName, null);
    assert.equal(linked.state, "LINK_ATTRIBUTED"); assert.ok(linked.companyCreatedAt); assert.ok(linked.attributedAt);
    const activity = await adapter.requestAdminPartnerActivity({ ...partner, limit: 2 });
    assert.equal(activity.items.length, 1); assert.equal(activity.items[0].action, "LINK_ATTRIBUTION_DECIDED");
    assert.deepEqual(Object.keys(activity.items[0]).sort(), ["action", "entityId", "entityType", "occurredAt"]);
    assert.ok(!JSON.stringify(activity).includes("authSubject"));
  });

  await context.test("review queue pages only persisted pending MANUAL and CODE without contact or payment data", async () => {
    const first = await adapter.requestAdminReviewQueue({ ...credentials, limit: 1 });
    assert.equal(first.items.length, 1); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
    const second = await adapter.requestAdminReviewQueue({ ...credentials, limit: 1, cursor: first.nextCursor });
    assert.equal(second.items.length, 1); assert.equal(second.hasMore, false); assert.equal(second.nextCursor, null);
    const all = [...first.items, ...second.items];
    assert.deepEqual(new Set(all.map((row) => row.origin)), new Set(["MANUAL", "CODE"]));
    for (const row of all) {
      assert.equal(row.state, "CAPTURED"); assert.equal(row.partnerId, running.ready.partnerId);
      assert.equal(row.partnerDisplayName, "Admin fixture partner 0");
      assert.equal(row.businessName, `Synthetic ${row.origin} referral`);
      assert.equal(row.expiresAt, null);
      assert.deepEqual(Object.keys(row).sort(), ["businessName", "capturedAt", "expiresAt", "id", "origin", "partnerDisplayName", "partnerId", "partnerStatus", "state"]);
    }
    assert.ok(!JSON.stringify(all).includes("@example.test"));
    const onlyCode = await adapter.requestAdminReviewQueue({ ...credentials, origin: "CODE" });
    assert.equal(onlyCode.items.length, 1); assert.equal(onlyCode.items[0].origin, "CODE");
    await assert.rejects(adapter.requestAdminReviewQueue({ ...credentials, origin: "CODE", cursor: first.nextCursor }), statusError(400));
    const noBearer = await fetch(`${running.ready.baseUrl}/v1/partners/admin/review-queue`);
    assert.equal(noBearer.status, 401); assert.equal(noBearer.headers.get("cache-control"), "no-store");
  });

  await context.test("HTTP401 without Bearer and HTTP404 for unknown identifiers", async () => {
    const unauthenticated = await fetch(`${running.ready.baseUrl}/v1/partners/admin/partners`);
    assert.equal(unauthenticated.status, 401); assert.equal(unauthenticated.headers.get("cache-control"), "no-store");
    await assert.rejects(adapter.requestAdminPartner({ ...credentials, partnerId: "99999999-9999-4999-8999-999999999999" }), statusError(404));
  });

  await context.test("real JWT validation rejects expired and invalidly signed access tokens", async () => {
    const expired = await fetch(`${running.ready.baseUrl}/v1/partners/admin/partners`,
      { headers: { Authorization: `Bearer ${signedAccess(running.ready.actorUserId, -60)}` } });
    assert.equal(expired.status, 401);
    const invalid = await fetch(`${running.ready.baseUrl}/v1/partners/admin/partners`,
      { headers: { Authorization: `Bearer ${accessToken.slice(0, -10)}not-valid!` } });
    assert.equal(invalid.status, 401);
  });

  await context.test("real HTTP query validation rejects duplicated, unknown and cross-scope parameters", async () => {
    for (const query of ["?limit=2&limit=3", "?ownerUserId=client-controlled", "?limit=0", "?cursor=bad"]) {
      const result = await fetch(`${running.ready.baseUrl}/v1/partners/admin/partners${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } });
      assert.equal(result.status, 400); assert.equal(result.headers.get("cache-control"), "no-store");
    }
    const first = await adapter.requestAdminPartners({ ...credentials, limit: 2 });
    const crossScope = await fetch(`${running.ready.baseUrl}/v1/partners/admin/partners/${running.ready.partnerId}/referrals?cursor=${first.nextCursor}`,
      { headers: { Authorization: `Bearer ${accessToken}` } });
    assert.equal(crossScope.status, 400);
  });

  for (const [mode, status] of [["DENY", 403], ["REVOKED", 401], ["UNKNOWN", 503], ["WRONG_ACTOR", 503], ["UNAVAILABLE", 503]]) {
    await context.test(`current Auth ${mode} fails closed with HTTP${status}, even with signed staff claims`, async () => {
      await running.command(`auth:${mode}`, "auth");
      await assert.rejects(adapter.requestAdminPartners(credentials), statusError(status));
      await assert.rejects(adapter.requestAdminReviewQueue(credentials), statusError(status));
    });
  }
  await running.command("auth:ALLOW", "auth");
  await context.test("recovery reuses the actual backend without cached revoked authority", async () => {
    const page = await adapter.requestAdminPartners(credentials);
    assert.equal(page.items.length, 5);
    const metadata = await running.command("status", "status");
    assert.ok(metadata.authCalls >= 10);
  });
});
